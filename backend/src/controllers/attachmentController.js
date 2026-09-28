import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Attachment } from '../models/Attachment.js';
import { Project } from '../models/Project.js';
import { deleteProjectDocument, uploadProjectDocument } from '../services/supabaseStorageService.js';

function safeFileName(name) {
  return name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
}

function safeStage(stage) {
  return String(stage || 'attachments').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function findProject(identifier) {
  const query = mongoose.isValidObjectId(identifier)
    ? { _id: identifier }
    : { productCode: identifier };
  const project = await Project.findOne(query);
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  return project;
}

export const listAttachments = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const filter = { project: project._id };
  if (req.query.stage) filter.stage = req.query.stage;
  const attachments = await Attachment.find(filter).sort({ updatedAt: -1 });
  res.json(attachments);
});

export const uploadAttachment = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const stage = req.body.stage || req.query.stage || 'Attachments';

  if (!req.file) {
    res.status(400);
    throw new Error('File is required');
  }

  const path = `projects/${project._id}/${safeStage(stage)}/${Date.now()}-${safeFileName(req.file.originalname)}`;
  const upload = await uploadProjectDocument({
    path,
    buffer: req.file.buffer,
    mimeType: req.file.mimetype
  });

  const attachment = await Attachment.create({
    project: project._id,
    stage,
    name: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    storagePath: upload.storagePath,
    url: upload.publicUrl,
    fileUrl: upload.publicUrl,
    uploadedBy: req.user?._id
  });

  res.status(201).json(attachment);
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  const attachment = await Attachment.findById(req.params.attachmentId);
  if (!attachment) {
    res.status(404);
    throw new Error('Attachment not found');
  }

  await deleteProjectDocument(attachment.storagePath);
  await attachment.deleteOne();
  res.status(204).end();
});
