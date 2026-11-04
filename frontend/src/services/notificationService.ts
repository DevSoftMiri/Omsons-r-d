import type { PersonalNotificationPreferences } from './adminModuleStorage';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function headers(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({ message: 'Request failed' }));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
  project?: { productCode: string; name: string };
}

export async function fetchNotifications() {
  return parse<{ notifications: NotificationItem[]; nextCursor: string | null }>(await fetch(`${API_BASE}/notifications?limit=20`, { headers: headers() }));
}

export async function fetchUnreadNotificationCount() {
  return parse<{ count: number }>(await fetch(`${API_BASE}/notifications/unread-count`, { headers: headers() }));
}

export async function markNotificationRead(id: string) {
  return parse<NotificationItem>(await fetch(`${API_BASE}/notifications/${id}/read`, { method: 'PATCH', headers: headers() }));
}

export async function markAllNotificationsRead() {
  return parse<{ message: string }>(await fetch(`${API_BASE}/notifications/read-all`, { method: 'PATCH', headers: headers() }));
}

export async function fetchNotificationPreferences() {
  return parse<PersonalNotificationPreferences>(await fetch(`${API_BASE}/notifications/preferences`, { headers: headers() }));
}

export async function saveNotificationPreferences(preferences: PersonalNotificationPreferences) {
  return parse<PersonalNotificationPreferences>(await fetch(`${API_BASE}/notifications/preferences`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...headers() }, body: JSON.stringify(preferences) }));
}
