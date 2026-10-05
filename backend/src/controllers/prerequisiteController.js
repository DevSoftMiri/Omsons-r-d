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

function uniqueDocumentTypes(values) {
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, list) => list.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
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

function getProjectDocumentTypes(project, certificates = []) {
  const exclusions = (project.prerequisiteDocumentExclusions || []).map((item) => item.toLowerCase());
  return uniqueDocumentTypes([
    ...REQUIRED_PREREQUISITE_DOCUMENTS,
    ...(project.prerequisiteDocuments || []),
    ...certificates.map((certificate) => certificate.type)
  ]).filter((type) => !exclusions.includes(type.toLowerCase()));
}

function buildPrerequisiteResponse(project, certificates) {
  return getProjectDocumentTypes(project, certificates).map((type) => {
    const certificate = certificates.find((item) => item.type === type);
    const normalizedCertificate = certificate
      ? {
          ...certificate.toObject(),
          publicUrl: certificate.publicUrl || certificate.fileUrl || '',
          fileUrl: certificate.fileUrl || certificate.publicUrl || ''
        }
      : null;
    return {
      type,
      required: true,
      status: normalizedCertificate?.status || 'Missing',
      certificate: normalizedCertificate
    };
  });
}

export const listPrerequisites = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const certificates = await Certificate.find({ project: project._id }).sort({ updatedAt: -1 });
  const documents = buildPrerequisiteResponse(project, certificates);
  res.json({
    documents,
    summary: {
      required: documents.length,
      uploaded: certificates.filter((item) => ['Uploaded', 'Approved', 'Rejected'].includes(item.status)).length,
      approved: certificates.filter((item) => item.status === 'Approved').length,
      missing: documents.length - certificates.filter((item) => ['Uploaded', 'Approved', 'Rejected'].includes(item.status)).length
    }
  });
});

export const addPrerequisiteDocument = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const type = String(req.body.type || '').trim();
  if (!type) {
    res.status(400);
    throw new Error('Document name is required');
  }

  const certificates = await Certificate.find({ project: project._id });
  if (getProjectDocumentTypes(project, certificates).some((item) => item.toLowerCase() === type.toLowerCase())) {
    res.status(409);
    throw new Error('A prerequisite document with this name already exists');
  }

  project.prerequisiteDocuments = uniqueDocumentTypes([...(project.prerequisiteDocuments || []), type]);
  await project.save();
  const updatedCertificates = await Certificate.find({ project: project._id }).sort({ updatedAt: -1 });
  res.status(201).json({
    documents: buildPrerequisiteResponse(project, updatedCertificates),
    summary: {
      required: getProjectDocumentTypes(project, updatedCertificates).length,
      uploaded: updatedCertificates.filter((item) => ['Uploaded', 'Approved', 'Rejected'].includes(item.status)).length,
      approved: updatedCertificates.filter((item) => item.status === 'Approved').length,
      missing: getProjectDocumentTypes(project, updatedCertificates).length - updatedCertificates.filter((item) => ['Uploaded', 'Approved', 'Rejected'].includes(item.status)).length
    }
  });
});

export const updatePrerequisiteDocument = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const oldType = decodeURIComponent(req.params.type);
  const nextType = String(req.body.type || '').trim();
  if (!nextType) {
    res.status(400);
    throw new Error('Document name is required');
  }
  const certificates = await Certificate.find({ project: project._id });
  const exists = getProjectDocumentTypes(project, certificates).some((item) => item.toLowerCase() === nextType.toLowerCase() && item.toLowerCase() !== oldType.toLowerCase());
  if (exists) {
    res.status(409);
    throw new Error('A prerequisite document with this name already exists');
  }

  project.prerequisiteDocuments = uniqueDocumentTypes([
    ...(project.prerequisiteDocuments || []).filter((item) => item.toLowerCase() !== oldType.toLowerCase()),
    nextType
  ]);
  if (REQUIRED_PREREQUISITE_DOCUMENTS.some((item) => item.toLowerCase() === oldType.toLowerCase())) {
    project.prerequisiteDocumentExclusions = uniqueDocumentTypes([...(project.prerequisiteDocumentExclusions || []), oldType]);
  }
  project.prerequisiteDocumentExclusions = (project.prerequisiteDocumentExclusions || []).filter((item) => item.toLowerCase() !== nextType.toLowerCase());
  await Certificate.updateMany({ project: project._id, type: oldType }, { type: nextType });
  await project.save();
  const updatedCertificates = await Certificate.find({ project: project._id }).sort({ updatedAt: -1 });
  res.json({
    documents: buildPrerequisiteResponse(project, updatedCertificates),
    summary: {
      required: getProjectDocumentTypes(project, updatedCertificates).length,
      uploaded: updatedCertificates.filter((item) => ['Uploaded', 'Approved', 'Rejected'].includes(item.status)).length,
      approved: updatedCertificates.filter((item) => item.status === 'Approved').length,
      missing: getProjectDocumentTypes(project, updatedCertificates).length - updatedCertificates.filter((item) => ['Uploaded', 'Approved', 'Rejected'].includes(item.status)).length
    }
  });
});

export const deletePrerequisiteDocument = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const type = decodeURIComponent(req.params.type);
  const certificates = await Certificate.find({ project: project._id, type });
  await Promise.all(certificates.map(async (certificate) => {
    if (certificate.storagePath) await deleteProjectDocument(certificate.storagePath);
    await certificate.deleteOne();
  }));
  project.prerequisiteDocuments = (project.prerequisiteDocuments || []).filter((item) => item.toLowerCase() !== type.toLowerCase());
  if (REQUIRED_PREREQUISITE_DOCUMENTS.some((item) => item.toLowerCase() === type.toLowerCase())) {
    project.prerequisiteDocumentExclusions = uniqueDocumentTypes([...(project.prerequisiteDocumentExclusions || []), type]);
  }
  await project.save();
  res.status(204).end();
});

export const uploadPrerequisite = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const type = decodeURIComponent(req.params.type);

  if (!getProjectDocumentTypes(project).some((item) => item.toLowerCase() === type.toLowerCase())) {
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
      publicUrl: upload.publicUrl || upload.fileUrl,
      fileUrl: upload.fileUrl || upload.publicUrl,
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
