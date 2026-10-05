export type PrerequisiteStatus = 'Missing' | 'Uploaded' | 'Approved' | 'Rejected';

export interface UploadedCertificate {
  _id: string;
  type: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  publicUrl?: string;
  fileUrl?: string;
  status: PrerequisiteStatus;
  reviewNotes?: string;
  rejectedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PrerequisiteDocument {
  type: string;
  required: boolean;
  status: PrerequisiteStatus;
  certificate: UploadedCertificate | null;
}

export interface PrerequisitePayload {
  documents: PrerequisiteDocument[];
  summary: {
    required: number;
    uploaded: number;
    approved: number;
    missing: number;
  };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const REQUIRED_DOCUMENT_TYPES = [
  'ISO Certificate',
  'Calibration Certificate',
  'Material Test Report',
  'Requirement Document',
  'Drawing Approval'
];

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function hasBackendAuth() {
  return Boolean(localStorage.getItem('token'));
}

function localKey(projectId: string) {
  return `prerequisites:${projectId}`;
}

function createLocalPayload(projectId: string): PrerequisitePayload {
  const saved = localStorage.getItem(localKey(projectId));
  if (saved) return JSON.parse(saved) as PrerequisitePayload;

  const payload = buildPayload(
    REQUIRED_DOCUMENT_TYPES.map((type) => ({
      type,
      required: true,
      status: 'Missing',
      certificate: null
    }))
  );
  writeLocalPayload(projectId, payload);
  return payload;
}

function writeLocalPayload(projectId: string, payload: PrerequisitePayload) {
  localStorage.setItem(localKey(projectId), JSON.stringify(payload));
  return payload;
}

function normalizeCertificate(certificate: UploadedCertificate | null | undefined) {
  if (!certificate) return null;
  const url = certificate.fileUrl || certificate.publicUrl || '';
  return {
    ...certificate,
    fileUrl: url,
    publicUrl: certificate.publicUrl || url
  };
}

function normalizePayload(payload: PrerequisitePayload): PrerequisitePayload {
  return {
    ...payload,
    documents: payload.documents.map((document) => ({
      ...document,
      certificate: normalizeCertificate(document.certificate)
    }))
  };
}

function saveLocalUpload(projectId: string, type: string, file: File) {
  const payload = createLocalPayload(projectId);
  const certificate: UploadedCertificate = {
    _id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    fileUrl: URL.createObjectURL(file),
    status: 'Uploaded',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const documents = payload.documents.some((document) => document.type === type)
    ? payload.documents.map((document) => document.type === type
      ? { ...document, status: 'Uploaded' as const, certificate }
      : document)
    : [...payload.documents, { type, required: true, status: 'Uploaded' as const, certificate }];
  writeLocalPayload(projectId, buildPayload(documents));
  return certificate;
}

function buildPayload(documents: PrerequisiteDocument[]): PrerequisitePayload {
  return {
    documents,
    summary: {
      required: documents.filter((document) => document.required).length,
      uploaded: documents.filter((document) => document.status !== 'Missing').length,
      approved: documents.filter((document) => document.status === 'Approved').length,
      missing: documents.filter((document) => document.status === 'Missing').length
    }
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json() as Promise<T>;
}

export async function fetchPrerequisites(projectId: string) {
  if (!hasBackendAuth()) return createLocalPayload(projectId);

  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites`, {
    headers: authHeaders()
  });
  if (response.status === 404) return createLocalPayload(projectId);
  return parseResponse<PrerequisitePayload>(response).then(normalizePayload);
}

export async function uploadPrerequisite(projectId: string, type: string, file: File) {
  if (!hasBackendAuth()) {
    return saveLocalUpload(projectId, type, file);
  }

  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites/${encodeURIComponent(type)}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });
  if (response.ok) return (response.json() as Promise<UploadedCertificate>).then((certificate) => normalizeCertificate(certificate) as UploadedCertificate);

  const error = await response.json().catch(() => ({ message: 'Request failed' }));
  if (response.status === 404 || error.message === 'Project not found') {
    return saveLocalUpload(projectId, type, file);
  }
  throw new Error(error.message || 'Upload failed');
}

export async function addPrerequisiteDocument(projectId: string, type: string) {
  if (!hasBackendAuth()) {
    const payload = createLocalPayload(projectId);
    const exists = payload.documents.some((document) => document.type.toLowerCase() === type.toLowerCase());
    if (exists) throw new Error('A prerequisite document with this name already exists');
    return writeLocalPayload(projectId, buildPayload([...payload.documents, { type, required: true, status: 'Missing', certificate: null }]));
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({ type })
  });
  return parseResponse<PrerequisitePayload>(response).then(normalizePayload);
}

export async function updatePrerequisiteDocument(projectId: string, oldType: string, nextType: string) {
  if (!hasBackendAuth()) {
    const payload = createLocalPayload(projectId);
    const exists = payload.documents.some((document) => document.type.toLowerCase() === nextType.toLowerCase() && document.type.toLowerCase() !== oldType.toLowerCase());
    if (exists) throw new Error('A prerequisite document with this name already exists');
    const documents = payload.documents.map((document) => document.type === oldType
      ? {
        ...document,
        type: nextType,
        certificate: document.certificate ? { ...document.certificate, type: nextType, updatedAt: new Date().toISOString() } : null
      }
      : document);
    return writeLocalPayload(projectId, buildPayload(documents));
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites/documents/${encodeURIComponent(oldType)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({ type: nextType })
  });
  return parseResponse<PrerequisitePayload>(response).then(normalizePayload);
}

export async function deletePrerequisiteDocument(projectId: string, type: string) {
  if (!hasBackendAuth()) {
    const payload = createLocalPayload(projectId);
    writeLocalPayload(projectId, buildPayload(payload.documents.filter((document) => document.type !== type)));
    return;
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites/documents/${encodeURIComponent(type)}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
}

export async function reviewPrerequisite(projectId: string, certificateId: string, status: 'Approved' | 'Rejected') {
  if (!hasBackendAuth()) {
    const payload = createLocalPayload(projectId);
    const documents = payload.documents.map((document) => {
      if (document.certificate?._id !== certificateId) return document;
      return {
        ...document,
        status,
        certificate: {
          ...document.certificate,
          status,
          updatedAt: new Date().toISOString()
        }
      };
    });
    const updated = writeLocalPayload(projectId, buildPayload(documents));
    const certificate = updated.documents.find((document) => document.certificate?._id === certificateId)?.certificate;
    if (!certificate) throw new Error('Document not found');
    return certificate;
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites/${certificateId}/review`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({ status })
  });
  return parseResponse<UploadedCertificate>(response);
}

export async function deletePrerequisite(projectId: string, certificateId: string) {
  if (!hasBackendAuth()) {
    const payload = createLocalPayload(projectId);
    const documents = payload.documents.map((document) => document.certificate?._id === certificateId
      ? { ...document, status: 'Missing' as const, certificate: null }
      : document);
    writeLocalPayload(projectId, buildPayload(documents));
    return;
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites/${certificateId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
}
