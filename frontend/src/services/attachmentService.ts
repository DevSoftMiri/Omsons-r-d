const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export type UploadProgress = (progress: number) => void;

async function uploadSignedFile(uploadInfo: { storagePath: string; token: string }, file: File, onProgress?: UploadProgress) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase upload configuration is missing.');
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${url}/storage/v1/object/upload/sign/${uploadInfo.storagePath.split('/').map(encodeURIComponent).join('/')}?token=${encodeURIComponent(uploadInfo.token)}`);
    request.setRequestHeader('apikey', key);
    request.setRequestHeader('Authorization', `Bearer ${key}`);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => request.status >= 200 && request.status < 300
      ? resolve()
      : reject(new Error(`Supabase upload failed (${request.status}).`));
    request.onerror = () => reject(new Error('Supabase upload failed. Check your connection and try again.'));
    request.onabort = () => reject(new Error('Upload was cancelled.'));
    request.send(file);
  });
}

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
  note?: string;
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
    const error = await response.json().catch(async () => ({ message: await response.text().catch(() => 'Request failed') }));
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

export async function uploadProjectAttachment(projectId: string, stage: string, file: File, sectionId?: string, note?: string, onProgress?: UploadProgress) {
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
      note: note?.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    writeLocal(projectId, stage, [attachment, ...readLocal(projectId, stage)]);
    return attachment;
  }

  const uploadInfo = await parseResponse<any>(await fetch(`${API_BASE}/projects/${projectId}/attachments/upload-url`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name: file.name, stage, sectionId })
  }));
  await uploadSignedFile(uploadInfo, file, onProgress);
  return parseResponse<ProjectAttachment>(await fetch(`${API_BASE}/projects/${projectId}/attachments/complete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ storagePath: uploadInfo.storagePath, publicUrl: uploadInfo.publicUrl, name: file.name, mimeType: file.type, fileSize: file.size, stage, sectionId, note })
  }));

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
