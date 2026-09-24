import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Certificate } from '../models/Certificate.js';
import { Project } from '../models/Project.js';
import { REQUIRED_PREREQUISITE_DOCUMENTS } from '../constants/prerequisites.js';
import { deleteProjectDocument, uploadProjectDocument } from '../services/supabaseStorageService.js';

function safeFileName(name) {
  return name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .toLowerCase();
}

function safeDocumentType(type) {
  return type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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

function buildPrerequisiteResponse(certificates) {
  return REQUIRED_PREREQUISITE_DOCUMENTS.map((type) => {
    const certificate = certificates.find((item) => item.type === type);
    return {
      type,
      required: true,
      status: certificate?.status || 'Missing',
      certificate: certificate || null
    };
  });
}

export const listPrerequisites = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const certificates = await Certificate.find({ project: project._id }).sort({ updatedAt: -1 });
  res.json({
    documents: buildPrerequisiteResponse(certificates),
    summary: {
      required: REQUIRED_PREREQUISITE_DOCUMENTS.length,
      uploaded: certificates.filter((item) => ['Uploaded', 'Approved', 'Rejected'].includes(item.status)).length,
      approved: certificates.filter((item) => item.status === 'Approved').length,
      missing: REQUIRED_PREREQUISITE_DOCUMENTS.length - certificates.filter((item) => ['Uploaded', 'Approved', 'Rejected'].includes(item.status)).length
    }
  });
});

export const uploadPrerequisite = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const type = decodeURIComponent(req.params.type);

  if (!REQUIRED_PREREQUISITE_DOCUMENTS.includes(type)) {
    res.status(400);
    throw new Error('Invalid prerequisite document type');
  }

  if (!req.file) {
    res.status(400);
    throw new Error('File is required');
  }

  const existing = await Certificate.findOne({ project: project._id, type });
  if (existing?.storagePath) await deleteProjectDocument(existing.storagePath);

  const path = `projects/${project._id}/prerequisites/${safeDocumentType(type)}/${Date.now()}-${safeFileName(req.file.originalname)}`;
  const upload = await uploadProjectDocument({
    path,
    buffer: req.file.buffer,
    mimeType: req.file.mimetype
  });

  const certificate = await Certificate.findOneAndUpdate(
    { project: project._id, type },
    {
      project: project._id,
      type,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: upload.storagePath,
      publicUrl: upload.publicUrl,
      fileUrl: upload.publicUrl,
      status: 'Uploaded',
      uploadedBy: req.user?._id,
      approvedBy: undefined,
      reviewNotes: undefined,
      rejectedReason: undefined
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.status(201).json(certificate);
});

export const reviewPrerequisite = asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!['Approved', 'Rejected'].includes(status)) {
    res.status(400);
    throw new Error('Review status must be Approved or Rejected');
  }

  const certificate = await Certificate.findByIdAndUpdate(
    req.params.certificateId,
    {
      status,
      approvedBy: status === 'Approved' ? req.user?._id : undefined,
      reviewNotes: req.body.reviewNotes,
      rejectedReason: status === 'Rejected' ? req.body.rejectedReason : undefined
    },
    { new: true }
  );

  if (!certificate) {
    res.status(404);
    throw new Error('Prerequisite document not found');
  }

  res.json(certificate);
});

export const deletePrerequisite = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findById(req.params.certificateId);
  if (!certificate) {
    res.status(404);
    throw new Error('Prerequisite document not found');
  }

  await deleteProjectDocument(certificate.storagePath);
  await certificate.deleteOne();
  res.status(204).end();
});
