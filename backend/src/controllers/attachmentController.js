import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Attachment } from '../models/Attachment.js';
import { Project } from '../models/Project.js';
import { createProjectDocumentUpload, deleteProjectDocument, uploadProjectDocument } from '../services/supabaseStorageService.js';

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
  if (req.query.sectionId) filter.sectionId = req.query.sectionId;
  const attachments = await Attachment.find(filter).sort({ updatedAt: -1 });
  res.json(attachments);
});

export const uploadAttachment = asyncHandler(async (req, res) => {
  const requestedStage = req.body.stage || req.query.stage || 'Attachments';
  const project = await findProject(req.params.id);
  const stage = requestedStage;
  const sectionId = req.body.sectionId || undefined;
  const note = req.body.note?.trim() || undefined;

  if (!req.file) {
    res.status(400);
    throw new Error('File is required');
  }

  const sectionPath = sectionId ? `/${safeStage(sectionId)}` : '';
  const path = `projects/${project._id}/${safeStage(stage)}${sectionPath}/${Date.now()}-${safeFileName(req.file.originalname)}`;
  const upload = await uploadProjectDocument({
    path,
    buffer: req.file.buffer,
    mimeType: req.file.mimetype
  });

  const attachment = await Attachment.create({
    project: project._id,
    stage,
    sectionId,
    name: req.file.originalname,
    mimeType: req.file.mimetype,
    fileSize: req.file.size,
    storagePath: upload.storagePath,
    url: upload.publicUrl,
    fileUrl: upload.publicUrl,
    uploadedBy: req.user?._id,
    note
  });

  res.status(201).json(attachment);
});

export const createAttachmentUpload = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const name = String(req.body.name || '').trim();
  if (!name) { res.status(400); throw new Error('File name is required'); }
  const stage = String(req.body.stage || 'Attachments');
  const sectionId = req.body.sectionId || undefined;
  const sectionPath = sectionId ? `/${safeStage(sectionId)}` : '';
  const path = `projects/${project._id}/${safeStage(stage)}${sectionPath}/${Date.now()}-${safeFileName(name)}`;
  res.json(await createProjectDocumentUpload({ path }));
});

export const completeAttachmentUpload = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const { storagePath, publicUrl, name, mimeType, fileSize, stage = 'Attachments', sectionId, note } = req.body;
  if (!storagePath || !name) { res.status(400); throw new Error('Upload metadata is incomplete'); }
  if (!storagePath.startsWith(`projects/${project._id}/`) || Number(fileSize) > 10 * 1024 * 1024) { res.status(400); throw new Error('Invalid attachment upload'); }
  const attachment = await Attachment.create({ project: project._id, stage, sectionId, name, mimeType, fileSize, storagePath, url: publicUrl, fileUrl: publicUrl, uploadedBy: req.user?._id, note: note?.trim() || undefined });
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
