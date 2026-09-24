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

const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json() as Promise<T>;
}

export async function fetchPrerequisites(projectId: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites`, {
    headers: authHeaders()
  });
  return parseResponse<PrerequisitePayload>(response);
}

export async function uploadPrerequisite(projectId: string, type: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites/${encodeURIComponent(type)}/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData
  });
  return parseResponse<UploadedCertificate>(response);
}

export async function reviewPrerequisite(projectId: string, certificateId: string, status: 'Approved' | 'Rejected') {
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
  const response = await fetch(`${API_BASE}/projects/${projectId}/prerequisites/${certificateId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
}
