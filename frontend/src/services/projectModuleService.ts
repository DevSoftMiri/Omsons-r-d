const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({ message: 'Request failed' }));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

export async function fetchProjectModule<T>(projectId: string, module: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/modules/${encodeURIComponent(module)}`, { headers: authHeaders() });
  return parseResponse<{ data: T | null; updatedAt: string | null }>(response);
}

export async function updateProjectModule<T>(projectId: string, module: string, data: T) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/modules/${encodeURIComponent(module)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ data })
  });
  return parseResponse<{ data: T; updatedAt: string }>(response);
}
