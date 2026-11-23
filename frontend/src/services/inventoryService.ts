import { createClient } from '@supabase/supabase-js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
function getSupabaseClient() { const url = import.meta.env.VITE_SUPABASE_URL; const key = import.meta.env.VITE_SUPABASE_ANON_KEY; if (!url || !key) throw new Error('Supabase upload configuration is missing.'); return createClient(url, key); }

export interface InventoryAttachment { name: string; mimeType?: string; fileSize?: number; url?: string; }
export interface InventoryItem { id: string; itemCode: string; itemName: string; specification: string; unit: string; price: number; vendorId?: string; vendorName: string; attachment?: InventoryAttachment; }
export interface InventoryPayload { itemCode: string; itemName: string; specification: string; unit: string; price: number; vendor?: string; }
function authHeaders(): Record<string, string> { const token = localStorage.getItem('token'); return token ? { Authorization: `Bearer ${token}` } : {}; }
async function parse<T>(response: Response): Promise<T> { if (!response.ok) { const error = await response.json().catch(() => ({ message: 'Request failed' })); throw new Error(error.message || 'Request failed'); } return response.json(); }
function normalize(raw: any): InventoryItem { return { id: raw._id || raw.id, itemCode: raw.itemCode || '', itemName: raw.itemName || '', specification: raw.specification || '', unit: raw.unit || 'pcs', price: Number(raw.price || 0), vendorId: raw.vendor?._id || raw.vendor?.id || raw.vendor || '', vendorName: raw.vendor?.name || '', attachment: raw.attachment }; }
export async function fetchInventory() { return (await parse<any[]>(await fetch(`${API_BASE}/inventory`, { headers: authHeaders() }))).map(normalize); }
export async function createInventory(payload: InventoryPayload) { return normalize(await parse(await fetch(`${API_BASE}/inventory`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) }))); }
export async function updateInventory(id: string, payload: InventoryPayload) { return normalize(await parse(await fetch(`${API_BASE}/inventory/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(payload) }))); }
export async function deleteInventory(id: string) { return parse<{ id: string }>(await fetch(`${API_BASE}/inventory/${id}`, { method: 'DELETE', headers: authHeaders() })); }
export async function uploadInventoryAttachment(id: string, file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds the 10 MB upload limit.`);
  const info = await parse<any>(await fetch(`${API_BASE}/inventory/${id}/attachment/upload-url`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ name: file.name }) }));
  const { error } = await getSupabaseClient().storage.from(info.bucket).uploadToSignedUrl(info.storagePath, info.token, file);
  if (error) throw new Error(error.message);
  return normalize(await parse(await fetch(`${API_BASE}/inventory/${id}/attachment/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ storagePath: info.storagePath, publicUrl: info.publicUrl, name: file.name, mimeType: file.type, fileSize: file.size }) })));
}
