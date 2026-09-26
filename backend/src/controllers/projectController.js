import asyncHandler from 'express-async-handler';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Benchmarking } from '../models/Benchmarking.js';
import { BomItem } from '../models/BomItem.js';
import { WORKFLOW_STAGES } from '../constants/workflow.js';

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

export const listProjects = asyncHandler(async (_req, res) => {
  const projects = await Project.find()
    .populate('teamMembers', 'name designation')
    .populate('reportTo', 'name')
    .sort({ updatedAt: -1 });
  res.json(projects);
});

export const createProject = asyncHandler(async (req, res) => {
  const admin = req.user.role === 'Admin' ? req.user : await User.findOne({ role: 'Admin' });
  const stageNames = normalizeStageNames(req.body);
  const reportTo = await resolveReportTo(req.body.reportTo, admin);
  const teamMembers = await resolveTeamMembers(req.body);
  const project = await Project.create({
    name: req.body.name,
    productCode: req.body.productCode || await nextProductCode(),
    category: req.body.category,
    description: req.body.description,
    startDate: req.body.startDate,
    targetDate: req.body.targetDate,
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

  res.status(201).json(project);
});

export const getProject = asyncHandler(async (req, res) => {
  const project = await Project.findOne(projectQuery(req.params.id))
    .populate('teamMembers', 'name designation')
    .populate('reportTo', 'name');
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }
  const benchmarking = await Benchmarking.findOne({ project: project._id });
  const bom = await BomItem.find({ project: project._id }).populate('vendor', 'name');
  res.json({ project, benchmarking, bom, bomTotal: bom.reduce((sum, item) => sum + item.quantity * item.cost, 0) });
});

export const updateStage = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404);
    throw new Error('Project not found');
  }

  const stageIndex = WORKFLOW_STAGES.indexOf(req.params.stage);
  const previousComplete = stageIndex === 0 || project.stages[stageIndex - 1]?.status === 'Completed';
  const canOverride = req.user.role === 'Admin' && req.body.adminOverride;

  if (!previousComplete && !canOverride) {
    res.status(409);
    throw new Error('Previous stage must be completed first');
  }

  project.stages[stageIndex] = {
    ...project.stages[stageIndex],
    ...req.body,
    name: req.params.stage,
    approvedBy: req.body.status === 'Completed' ? req.user._id : project.stages[stageIndex].approvedBy,
    completedAt: req.body.status === 'Completed' ? new Date() : project.stages[stageIndex].completedAt
  };

  project.currentStage = project.stages.find((stage) => stage.status !== 'Completed')?.name || 'Final Stage';
  if (project.stages.every((stage) => stage.status === 'Completed')) project.status = 'Completed';
  await project.save();
  res.json(project);
});
