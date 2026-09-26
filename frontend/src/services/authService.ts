import type { AuthUser, UserRole } from '../store';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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
