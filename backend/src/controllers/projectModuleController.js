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

function validateData(data, module) {
  const isObject = data && typeof data === 'object';
  const allowsArray = String(module).startsWith('stage-responses:');
  return isObject && (allowsArray || !Array.isArray(data)) && JSON.stringify(data).length <= 10_000_000;
}

export const getProjectModule = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id, req.user);
  const moduleData = await ProjectModule.findOne({ project: project._id, module: req.params.module });
  res.json(moduleData
    ? { data: moduleData.data, updatedAt: moduleData.updatedAt, module: req.params.module, projectId: String(project._id), exists: true }
    : { data: null, updatedAt: null, module: req.params.module, projectId: String(project._id), exists: false });
});

export const updateProjectModule = asyncHandler(async (req, res) => {
  if (String(req.params.module) === 'stage-responses:Testing & Validation' && req.user.role === 'Admin') {
    res.status(403);
    throw new Error('Admins have read-only access to Testing & Validation response sections');
  }
  const project = await findProject(req.params.id, req.user);
  if (!validateData(req.body?.data, req.params.module)) {
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
