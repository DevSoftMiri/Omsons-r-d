import type { BenchmarkingTableData } from '../components/benchmarking/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export interface TestingValidationWorkbook { _id?: string; project?: string; tables: BenchmarkingTableData[]; reviewStatus: 'draft' | 'completed'; completedAt?: string; updatedAt?: string; }
function authHeaders(): Record<string, string> { const token = localStorage.getItem('token'); return token ? { Authorization: `Bearer ${token}` } : {}; }
async function parse<T>(response: Response): Promise<T> { const data = await response.json().catch(() => ({ message: 'Request failed' })); if (!response.ok) throw new Error(data.message || 'Request failed'); return data as T; }
export function hasTestingValidationBackend() { return Boolean(localStorage.getItem('token')); }
export async function fetchTestingValidation(projectId: string) { return parse<TestingValidationWorkbook>(await fetch(`${API_BASE}/projects/${projectId}/testing-validation`, { headers: authHeaders() })); }
export async function saveTestingValidation(projectId: string, tables: BenchmarkingTableData[]) { return parse<TestingValidationWorkbook>(await fetch(`${API_BASE}/projects/${projectId}/testing-validation`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ tables }) })); }
export async function completeTestingValidation(projectId: string) { return parse<{ testingValidation: TestingValidationWorkbook; project: unknown }>(await fetch(`${API_BASE}/projects/${projectId}/testing-validation/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() } })); }
