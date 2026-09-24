import asyncHandler from 'express-async-handler';
import { Project } from '../models/Project.js';
import { User } from '../models/User.js';
import { Benchmarking } from '../models/Benchmarking.js';
import { BomItem } from '../models/BomItem.js';
import { WORKFLOW_STAGES } from '../constants/workflow.js';

function nextProductCode() {
  return `GLW-${Date.now().toString().slice(-8)}`;
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
  const project = await Project.create({
    ...req.body,
    productCode: req.body.productCode || nextProductCode(),
    reportTo: req.body.reportTo || admin?._id
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
  const project = await Project.findById(req.params.id)
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
