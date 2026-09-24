import asyncHandler from 'express-async-handler';
import { Report } from '../models/Report.js';

export const listReports = asyncHandler(async (req, res) => {
  const filter = req.query.project ? { project: req.query.project } : {};
  res.json(await Report.find(filter).populate('submittedBy', 'name').sort({ date: -1 }));
});

export const createReport = asyncHandler(async (req, res) => {
  res.status(201).json(await Report.create({ ...req.body, submittedBy: req.user._id }));
});

export const reviewReport = asyncHandler(async (req, res) => {
  const report = await Report.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status, reviewedBy: req.user._id },
    { new: true }
  );
  res.json(report);
});
