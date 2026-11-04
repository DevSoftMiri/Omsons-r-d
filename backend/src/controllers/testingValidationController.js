import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Project } from '../models/Project.js';
import { TestingValidation } from '../models/TestingValidation.js';

function projectQuery(identifier) {
  return mongoose.isValidObjectId(identifier) ? { _id: identifier } : { productCode: identifier };
}

async function findAccessibleProject(req, res) {
  const project = await Project.findOne(projectQuery(req.params.id));
  if (!project) { res.status(404); throw new Error('Project not found'); }
  if (req.user.role === 'Staff' && !project.teamMembers.some((member) => String(member) === String(req.user._id))) {
    res.status(403); throw new Error('Project is not assigned to this staff account');
  }
  return project;
}

function validateTables(tables) {
  if (!Array.isArray(tables) || tables.length > 100) return false;
  return tables.every((table) => table && typeof table === 'object' && Array.isArray(table.columns) && Array.isArray(table.rows) && table.columns.length <= 100 && table.rows.length <= 1000);
}

function applyValidationResults(tables) {
  return tables.map((table) => {
    const headers = Object.fromEntries((table.columns || []).map((column) => [String(column.label || '').trim().toLowerCase(), column.id]));
    const required = headers['required parameter'];
    const tolerance = headers.tolerance;
    const observed = headers['observed parameter'];
    const results = headers.results;
    if (!required || !tolerance || !observed || !results) return table;
    return { ...table, rows: table.rows.map((row, index) => {
      if (index === 0) return row;
      const target = Number(row.cells?.[required]);
      const allowed = Number(row.cells?.[tolerance]);
      const measured = Number(row.cells?.[observed]);
      const result = [target, allowed, measured].every(Number.isFinite) && allowed >= 0 ? (Math.abs(measured - target) <= allowed ? 'Pass' : 'Fail') : 'Pending';
      return { ...row, cells: { ...row.cells, [results]: result } };
    }) };
  });
}

export const getTestingValidation = asyncHandler(async (req, res) => {
  const project = await findAccessibleProject(req, res);
  const data = await TestingValidation.findOne({ project: project._id });
  res.json(data || { project: project._id, tables: [], reviewStatus: 'draft', completedAt: null });
});

export const saveTestingValidation = asyncHandler(async (req, res) => {
  if (req.user.role !== 'Auditor') { res.status(403); throw new Error('Only auditors can edit Testing & Validation data'); }
  const project = await findAccessibleProject(req, res);
  if (!validateTables(req.body.tables)) { res.status(400); throw new Error('Invalid Testing & Validation tables'); }
  const data = await TestingValidation.findOneAndUpdate(
    { project: project._id },
    { project: project._id, tables: applyValidationResults(req.body.tables), reviewStatus: 'draft', completedAt: undefined, updatedBy: req.user._id },
    { new: true, upsert: true, runValidators: true }
  );
  res.json(data);
});

export const completeTestingValidation = asyncHandler(async (req, res) => {
  const project = await findAccessibleProject(req, res);
  const data = await TestingValidation.findOne({ project: project._id });
  if (!data?.tables?.length) { res.status(409); throw new Error('Testing & Validation data is required'); }
  const stageIndex = project.stages.findIndex((stage) => stage.name.toLowerCase() === 'testing & validation');
  if (stageIndex < 0) { res.status(404); throw new Error('Testing & Validation stage is not configured'); }
  const previousComplete = stageIndex === 0 || project.stages.slice(0, stageIndex).every((stage) => stage.status === 'Completed');
  if (!previousComplete && !(req.user.role === 'Admin' && req.body.adminOverride)) { res.status(409); throw new Error('Previous stage must be completed first'); }
  data.reviewStatus = 'completed';
  data.completedAt = new Date();
  data.updatedBy = req.user._id;
  project.stages[stageIndex].status = 'Completed';
  project.stages[stageIndex].progress = 100;
  project.stages[stageIndex].completedAt = new Date();
  project.stages.forEach((stage, index) => { if (stage.status !== 'Completed') stage.status = index > 0 && project.stages[index - 1].status !== 'Completed' ? 'Locked' : 'Pending'; });
  project.currentStage = project.stages.find((stage) => stage.status !== 'Completed')?.name || 'Final Stage';
  await Promise.all([data.save(), project.save()]);
  res.json({ testingValidation: data, project });
});
