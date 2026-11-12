import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { ProjectModule } from '../models/ProjectModule.js';
import { Project } from '../models/Project.js';

async function findProject(identifier, user) {
  const query = mongoose.isValidObjectId(identifier) ? { _id: identifier } : { productCode: identifier };
  const project = await Project.findOne(query);
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  const assigned = project.teamMembers.some((member) => String(member) === String(user._id));
  const reporter = String(project.reportTo) === String(user._id);
  if (user.role !== 'Admin' && !assigned && !reporter) {
    const error = new Error('Project is not assigned to this account');
    error.statusCode = 403;
    throw error;
  }
  return project;
}

function validateData(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && JSON.stringify(data).length <= 10_000_000;
}

export const getProjectModule = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id, req.user);
  const moduleData = await ProjectModule.findOne({ project: project._id, module: req.params.module });
  res.json(moduleData ? { data: moduleData.data, updatedAt: moduleData.updatedAt } : { data: null, updatedAt: null });
});

export const updateProjectModule = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id, req.user);
  if (!validateData(req.body?.data)) {
    res.status(400);
    throw new Error('Module data must be an object smaller than 10 MB');
  }
  const moduleData = await ProjectModule.findOneAndUpdate(
    { project: project._id, module: req.params.module },
    { $set: { data: req.body.data, updatedBy: req.user._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ data: moduleData.data, updatedAt: moduleData.updatedAt });
});
