import asyncHandler from 'express-async-handler';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Benchmarking } from '../models/Benchmarking.js';
import { BomItem } from '../models/BomItem.js';
import { Attachment } from '../models/Attachment.js';
import { Certificate } from '../models/Certificate.js';
import { Report } from '../models/Report.js';
import { WORKFLOW_STAGES } from '../constants/workflow.js';
import { deleteProjectDocument } from '../services/supabaseStorageService.js';

async function nextProductCode() {
  const count = await Project.countDocuments();
  return `GLW-${String(count + 101).padStart(4, '0')}`;
}

function uniqueStrings(values) {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, list) => list.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
}

function normalizeStageNames(body) {
  const requestedStages = Array.isArray(body.stageNames)
    ? body.stageNames
    : Array.isArray(body.selectedStages)
      ? body.selectedStages
      : Array.isArray(body.stages)
        ? body.stages.map((stage) => typeof stage === 'string' ? stage : stage.name)
        : WORKFLOW_STAGES;
  const customStages = Array.isArray(body.customStages) ? body.customStages : [];
  const withoutFinal = uniqueStrings([...requestedStages, ...customStages]).filter((stage) => stage !== 'Final Stage');
  return [...withoutFinal, 'Final Stage'];
}

function makeStages(stageNames) {
  return stageNames.map((name, index) => ({
    name,
    status: index === 0 ? 'Pending' : 'Locked',
    progress: 0
  }));
}

function findStageIndex(project, stageName) {
  return project.stages.findIndex((stage) => stage.name.toLowerCase() === String(stageName).toLowerCase());
}

function refreshStageLocks(project) {
  project.stages.forEach((stage, index) => {
    if (stage.status === 'Completed') {
      stage.progress = 100;
      return;
    }
    const previousComplete = index === 0 || project.stages.slice(0, index).every((candidate) => candidate.status === 'Completed');
    stage.status = previousComplete ? 'Pending' : 'Locked';
    stage.progress = 0;
  });
  project.currentStage = project.stages.find((stage) => stage.status !== 'Completed')?.name || 'Final Stage';
  if (project.stages.every((stage) => stage.status === 'Completed')) project.status = 'Completed';
  else if (project.status === 'Completed') project.status = 'Running';
}

async function resolveReportTo(value, fallbackUser) {
  if (!value) return fallbackUser?._id;
  if (String(value).match(/^[0-9a-fA-F]{24}$/)) return value;
  const user = await User.findOne({
    $or: [
      { name: value },
      { email: String(value).toLowerCase() }
    ]
  });
  return user?._id || fallbackUser?._id;
}

async function resolveTeamMembers(body) {
  const values = Array.isArray(body.teamMemberIds) && body.teamMemberIds.length
    ? body.teamMemberIds
    : Array.isArray(body.teamMembers)
      ? body.teamMembers.map((member) => member._id || member.id || member.email || member.name)
      : [];
  const objectIds = values.filter((value) => String(value).match(/^[0-9a-fA-F]{24}$/));
  const labels = values.filter((value) => !String(value).match(/^[0-9a-fA-F]{24}$/)).map(String);
  const users = labels.length
    ? await User.find({ $or: [{ name: { $in: labels } }, { email: { $in: labels.map((label) => label.toLowerCase()) } }] })
    : [];
  return [...objectIds, ...users.map((user) => user._id)];
}

function projectQuery(identifier) {
  return identifier.match(/^[0-9a-fA-F]{24}$/)
    ? { _id: identifier }
    : { productCode: identifier };
}

async function populateProjectTeam(project) {
  await project.populate('teamMembers', 'name email role designation isActive');
  await project.populate('reportTo', 'name email role designation isActive');
  return project;
}

function isStaffUser(user) {
  return user?.role === 'Staff';
}

function isAssignedToProject(project, user) {
  return project.teamMembers.some((member) => String(member._id || member) === String(user._id));
}

function serializeProjectForUser(project, user) {
  const serialized = project.toJSON();
  if (isStaffUser(user)) serialized.teamMembers = [];
  return serialized;
}

function isPastTargetDate(targetDate) {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

async function applyAutomaticProjectStatus(project) {
  if (!project || ['Completed', 'On Hold'].includes(project.status)) return project;
  if (isPastTargetDate(project.targetDate) && project.status !== 'Delayed') {
    project.status = 'Delayed';
    await project.save();
  }
  return project;
}

async function deleteStoredProjectDocument(path) {
  try {
    await deleteProjectDocument(path);
  } catch (error) {
    console.warn(`Unable to delete project document "${path}": ${error.message}`);
  }
}

export const listProjects = asyncHandler(async (req, res) => {
  const query = isStaffUser(req.user) ? { teamMembers: req.user._id } : {};
  const projects = await Project.find(query)
    .populate('teamMembers', 'name email role designation isActive')
    .populate('reportTo', 'name email role designation isActive')
    .sort({ createdAt: 1, _id: 1 });
  await Promise.all(projects.map(applyAutomaticProjectStatus));
  res.json(projects.map((project) => serializeProjectForUser(project, req.user)));
});

export const createProject = asyncHandler(async (req, res) => {
  const startDate = new Date(req.body.startDate);
  const targetDate = new Date(req.body.targetDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(targetDate.getTime())) {
    res.status(400);
    throw new Error('Start Date and End Date are required');
  }
  if (targetDate.getTime() < startDate.getTime()) {
    res.status(400);
    throw new Error('End Date cannot be before Start Date');
  }

  const admin = req.user.role === 'Admin' ? req.user : await User.findOne({ role: 'Admin' });
  const stageNames = normalizeStageNames(req.body);
  const reportTo = await resolveReportTo(req.body.reportTo, admin);
  const teamMembers = await resolveTeamMembers(req.body);
  const project = await Project.create({
    name: req.body.name,
    productCode: req.body.productCode || await nextProductCode(),
    category: req.body.category,
    description: req.body.description,
    startDate,
    targetDate,
    priority: req.body.priority,
    status: req.body.status,
    reportTo,
    teamMembers,
    currentStage: stageNames[0],
    stages: makeStages(stageNames)
  });

  await Benchmarking.create({
    project: project._id,
    columns: [
      { key: 'srNo', label: 'Sr No.' },
      { key: 'name', label: 'Name' },
      { key: 'specification', label: 'Specification' },
      { key: 'license', label: 'License' }
    ],
    rows: []
  });

  await applyAutomaticProjectStatus(project);
  res.status(201).json(project);
});

export const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findOne(projectQuery(req.params.id))
    .populate('teamMembers', 'name email role designation isActive')
    .populate('reportTo', 'name email role designation isActive');
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }
  if (isStaffUser(req.user) && !isAssignedToProject(project, req.user)) {
    res.status(403);
    throw new Error('Project is not assigned to this staff account');
  }
  await applyAutomaticProjectStatus(project);
  const benchmarking = await Benchmarking.findOne({ project: project._id });
  const bom = await BomItem.find({ project: project._id }).populate('vendor', 'name');
  res.json({ project: serializeProjectForUser(project, req.user), benchmarking, bom, bomTotal: bom.reduce((sum, item) => sum + item.quantity * item.cost, 0) });
});

export const listProjectTeamCandidates = asyncHandler(async (_req, res) => {
  const users = await User.find({ role: 'Staff', $or: [{ isActive: true }, { isActive: { $exists: false } }] })
    .select('name email role designation isActive')
    .sort({ name: 1 });
  res.json(users);
});

export const addProjectTeamMember = asyncHandler(async (req, res) => {
  const project = await Project.findOne(projectQuery(req.params.id));
  const user = await User.findOne({
    _id: req.body.userId,
    role: 'Staff',
    $or: [{ isActive: true }, { isActive: { $exists: false } }]
  });
  if (!project || !user) {
    res.status(404);
    throw new Error('Project or team member not found');
  }
  if (!project.teamMembers.some((member) => String(member) === String(user._id))) project.teamMembers.push(user._id);
  await project.save();
  res.json(await populateProjectTeam(project));
});

export const removeProjectTeamMember = asyncHandler(async (req, res) => {
  const project = await Project.findOne(projectQuery(req.params.id));
  const user = await User.findOne({ _id: req.params.userId, role: 'Staff' });
  if (!project || !user) {
    res.status(404);
    throw new Error('Project or team member not found');
  }
  project.teamMembers = project.teamMembers.filter((member) => String(member) !== String(user._id));
  await project.save();
  res.json(await populateProjectTeam(project));
});

export const updateProjectReportTo = asyncHandler(async (req, res) => {
  const project = await Project.findOne(projectQuery(req.params.id));
  const user = await User.findOne({
    _id: req.body.userId,
    role: 'Admin',
    $or: [{ isActive: true }, { isActive: { $exists: false } }]
  });
  if (!project || !user) {
    res.status(404);
    throw new Error('Project or reporting admin not found');
  }
  project.reportTo = user._id;
  await project.save();
  res.json(await populateProjectTeam(project));
});

export const addProjectStage = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const project = await Project.findOne(projectQuery(req.params.id));
  if (!project || !name) {
    res.status(400);
    throw new Error('Project and stage name are required');
  }
  if (project.stages.some((stage) => stage.name.toLowerCase() === name.toLowerCase())) {
    res.status(409);
    throw new Error('A stage with this name already exists');
  }
  const finalIndex = project.stages.findIndex((stage) => stage.name === 'Final Stage');
  project.stages.splice(finalIndex < 0 ? project.stages.length : finalIndex, 0, {
    name,
    status: 'Locked',
    progress: 0
  });
  refreshStageLocks(project);
  await project.save();
  res.json(await populateProjectTeam(project));
});

export const reorderProjectStages = asyncHandler(async (req, res) => {
  const orderedStageNames = Array.isArray(req.body.stages)
    ? req.body.stages
    : Array.isArray(req.body.stageNames)
      ? req.body.stageNames
      : [];
  const project = await Project.findOne(projectQuery(req.params.id));
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const normalizedNames = orderedStageNames.map((stage) => String(stage || '').trim()).filter(Boolean);
  if (!normalizedNames.length) {
    res.status(400);
    throw new Error('Stage order is required');
  }
  if (normalizedNames[normalizedNames.length - 1] !== 'Final Stage') {
    res.status(400);
    throw new Error('Final Stage must remain last');
  }

  const uniqueNames = new Set(normalizedNames.map((stage) => stage.toLowerCase()));
  if (uniqueNames.size !== normalizedNames.length) {
    res.status(400);
    throw new Error('Stage order cannot contain duplicates');
  }
  if (normalizedNames.length !== project.stages.length) {
    res.status(400);
    throw new Error('Stage order must include every project stage');
  }

  const stagesByName = new Map(project.stages.map((stage) => [stage.name.toLowerCase(), stage]));
  const reorderedStages = normalizedNames.map((name) => stagesByName.get(name.toLowerCase()));
  if (reorderedStages.some((stage) => !stage)) {
    res.status(400);
    throw new Error('Stage order contains an unknown stage');
  }

  project.stages = reorderedStages;
  refreshStageLocks(project);
  await project.save();
  res.json(await populateProjectTeam(project));
});

export const updateProjectStatus = asyncHandler(async (req, res) => {
  const status = String(req.body.status || '').trim();
  if (!['Running', 'On Hold', 'Completed', 'Delayed'].includes(status)) {
    res.status(400);
    throw new Error('Project status must be Running, On Hold, Completed, or Delayed');
  }

  const project = await Project.findOne(projectQuery(req.params.id));
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  project.status = status;
  await applyAutomaticProjectStatus(project);
  await project.save();
  res.json(await populateProjectTeam(project));
});

export const deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findOne(projectQuery(req.params.id));
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const [attachments, certificates] = await Promise.all([
    Attachment.find({ project: project._id }).select('storagePath'),
    Certificate.find({ project: project._id }).select('storagePath')
  ]);
  const storagePaths = [...attachments, ...certificates]
    .map((item) => item.storagePath)
    .filter(Boolean);

  await Promise.all(storagePaths.map((path) => deleteStoredProjectDocument(path)));
  await Promise.all([
    Attachment.deleteMany({ project: project._id }),
    Benchmarking.deleteMany({ project: project._id }),
    BomItem.deleteMany({ project: project._id }),
    Certificate.deleteMany({ project: project._id }),
    Report.deleteMany({ project: project._id })
  ]);
  await project.deleteOne();

  res.json({ message: 'Project deleted successfully', id: String(project._id), productCode: project.productCode });
});

export const updateStage = asyncHandler(async (req, res) => {
  const project = await Project.findOne(projectQuery(req.params.id));
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }
  if (isStaffUser(req.user) && !isAssignedToProject(project, req.user)) {
    res.status(403);
    throw new Error('Project is not assigned to this staff account');
  }

  const stageIndex = findStageIndex(project, req.params.stage);
  if (stageIndex < 0) {
    res.status(404);
    throw new Error('Stage not found in this project');
  }

  const previousComplete = stageIndex === 0 || project.stages[stageIndex - 1]?.status === 'Completed';
  const canOverride = req.user.role === 'Admin' && req.body.adminOverride;

  if (!previousComplete && !canOverride) {
    res.status(409);
    throw new Error('Previous stage must be completed first');
  }

  project.stages[stageIndex] = {
    ...project.stages[stageIndex],
    ...req.body,
    name: project.stages[stageIndex].name,
    approvedBy: req.body.status === 'Completed' ? req.user._id : project.stages[stageIndex].approvedBy,
    completedAt: req.body.status === 'Completed' ? new Date() : project.stages[stageIndex].completedAt
  };

  refreshStageLocks(project);
  await project.save();
  res.json(await populateProjectTeam(project));
});
