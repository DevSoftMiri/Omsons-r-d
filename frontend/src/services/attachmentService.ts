const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface ProjectAttachment {
  _id: string;
  project?: string;
  stage: string;
  sectionId?: string;
  name: string;
  mimeType: string;
  fileSize?: number;
  storagePath?: string;
  url?: string;
  fileUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function hasBackendAuth() {
  return Boolean(localStorage.getItem('token'));
}

function localKey(projectId: string, stage: string) {
  return `attachments:${projectId}:${stage}`;
}

function readLocal(projectId: string, stage: string) {
  const saved = localStorage.getItem(localKey(projectId, stage));
  return saved ? JSON.parse(saved) as ProjectAttachment[] : [];
}

function writeLocal(projectId: string, stage: string, attachments: ProjectAttachment[]) {
  localStorage.setItem(localKey(projectId, stage), JSON.stringify(attachments));
  return attachments;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json() as Promise<T>;
}

export async function fetchProjectAttachments(projectId: string, stage = 'Attachments') {
  if (!hasBackendAuth()) return readLocal(projectId, stage);

  const response = await fetch(`${API_BASE}/projects/${projectId}/attachments?stage=${encodeURIComponent(stage)}`, {
    headers: authHeaders()
  });
  return parseResponse<ProjectAttachment[]>(response);
}

export async function uploadProjectAttachment(projectId: string, stage: string, file: File, sectionId?: string) {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB upload limit.`);
  if (!hasBackendAuth()) {
    const url = URL.createObjectURL(file);
    const attachment: ProjectAttachment = {
      _id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      stage,
      sectionId,
      name: file.name,
      mimeType: file.type,
      fileSize: file.size,
      url,
      fileUrl: url,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    writeLocal(projectId, stage, [attachment, ...readLocal(projectId, stage)]);
    return attachment;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('stage', stage);
  if (sectionId) formData.append('sectionId', sectionId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/attachments/upload`, {
      method: 'POST', headers: authHeaders(), body: formData, signal: controller.signal
    });
    return await parseResponse<ProjectAttachment>(response);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Upload timed out. Please check the attachment list before trying again.');
    throw error;
  } finally { clearTimeout(timer); }

}

export async function deleteProjectAttachment(projectId: string, stage: string, attachmentId: string) {
  if (!hasBackendAuth()) {
    writeLocal(projectId, stage, readLocal(projectId, stage).filter((attachment) => attachment._id !== attachmentId));
    return;
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
}
