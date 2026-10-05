import type { AuthUser, UserRole } from '../store';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ApiUser {
  _id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Staff';
}

interface LoginResponse {
  user: ApiUser;
  token: string;
}

export async function authenticate(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json().catch(() => ({ message: 'Unable to connect to the login service' }));
  if (!response.ok) {
    throw new Error(data.message || 'Invalid email or password');
  }

  const result = data as LoginResponse;
  return {
    token: result.token,
    user: {
      id: result.user._id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role.toLowerCase() as UserRole
    }
  };
}

export interface StaffAccount {
  _id: string;
  name: string;
  email: string;
  role: 'Staff' | 'Admin';
  designation?: string;
  isActive: boolean;
}

async function parseAuthResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({ message: 'Request failed' }));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data as T;
}

export async function fetchStaffAccounts() {
  return parseAuthResponse<StaffAccount[]>(await fetch(`${API_BASE}/auth/staff`, { headers: authHeaders() }));
}

export async function createStaffAccount(payload: { name: string; email: string; password: string; designation: string; role: 'Staff' | 'Admin' }) {
  return parseAuthResponse<StaffAccount>(await fetch(`${API_BASE}/auth/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) }));
}

export async function updateStaffAccount(userId: string, payload: { name: string; email: string; designation: string; role: 'Staff' | 'Admin'; isActive: boolean }) {
  return parseAuthResponse<StaffAccount>(await fetch(`${API_BASE}/auth/staff/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload)
  }));
}

export async function resetStaffPassword(userId: string, password: string) {
  return parseAuthResponse<{ message: string }>(await fetch(`${API_BASE}/auth/staff/${userId}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ password })
  }));
}
