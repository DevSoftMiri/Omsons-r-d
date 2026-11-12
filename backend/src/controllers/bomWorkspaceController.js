import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { BomWorkspace } from '../models/BomWorkspace.js';
import { Project } from '../models/Project.js';

async function findProject(identifier, user) {
  const query = mongoose.isValidObjectId(identifier) ? { _id: identifier } : { productCode: identifier };
  const project = await Project.findOne(query);
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  const assigned = (project.teamMembers || []).some((member) => String(member) === String(user._id));
  const isReporter = String(project.reportTo) === String(user._id);
  if (user.role !== 'Admin' && !assigned && !isReporter) {
    const error = new Error('Project is not assigned to this account');
    error.statusCode = 403;
    throw error;
  }
  return project;
}

export const getBomWorkspace = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id, req.user);
  const workspace = await BomWorkspace.findOne({ project: project._id });
  res.json(workspace ? { data: workspace.data, updatedAt: workspace.updatedAt } : { data: null, updatedAt: null });
});

export const updateBomWorkspace = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id, req.user);
  if (!req.body?.data || typeof req.body.data !== 'object' || Array.isArray(req.body.data)) {
    res.status(400);
    throw new Error('BOM data must be an object');
  }
  const serializedSize = JSON.stringify(req.body.data);
  if (serializedSize.length > 10_000_000) {
    res.status(413);
    throw new Error('BOM data is too large');
  }
  const workspace = await BomWorkspace.findOneAndUpdate(
    { project: project._id },
    { $set: { data: req.body.data, updatedBy: req.user._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.json({ data: workspace.data, updatedAt: workspace.updatedAt });
});
