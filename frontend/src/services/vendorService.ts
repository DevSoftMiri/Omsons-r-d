const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export type VendorStatus = 'Active' | 'Inactive';
export type VendorPaymentType = 'Advance' | 'Credit';

export interface VendorRecord {
  id: string;
  name: string;
  code?: string;
  category: string;
  contactPerson: string;
  designation?: string;
  phone?: string;
  email?: string;
  location?: string;
  suppliedComponents: string;
  paymentType: VendorPaymentType;
  advancePercentage: number;
  creditDays: number;
  paymentTerms?: string;
  status: VendorStatus;
  preferred: boolean;
  notes?: string;
}

export interface VendorPayload {
  name: string;
  code?: string;
  category: string;
  contactPerson: string;
  designation?: string;
  phone?: string;
  email?: string;
  location?: string;
  suppliedComponents: string;
  paymentType: VendorPaymentType;
  advancePercentage: number;
  creditDays: number;
  paymentTerms?: string;
  status: VendorStatus;
  preferred: boolean;
  notes?: string;
}

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

function normalizeVendor(raw: any): VendorRecord {
  return {
    id: raw._id || raw.id,
    name: raw.name || '',
    code: raw.code || '',
    category: raw.category || '',
    contactPerson: raw.contactPerson || '',
    designation: raw.designation || '',
    phone: raw.phone || '',
    email: raw.email || '',
    location: raw.location || '',
    suppliedComponents: raw.suppliedComponents || '',
    paymentType: raw.paymentType === 'Credit' ? 'Credit' : 'Advance',
    advancePercentage: Number(raw.advancePercentage || 0),
    creditDays: Number(raw.creditDays || 0),
    paymentTerms: raw.paymentTerms || '',
    status: raw.status === 'Inactive' ? 'Inactive' : 'Active',
    preferred: raw.preferred ?? true,
    notes: raw.notes || ''
  };
}

export async function fetchVendors() {
  const response = await fetch(`${API_BASE}/vendors`, {
    headers: authHeaders()
  });
  const vendors = await parseResponse<any[]>(response);
  return vendors.map(normalizeVendor);
}

export async function createVendor(payload: VendorPayload) {
  const response = await fetch(`${API_BASE}/vendors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify(payload)
  });
  return normalizeVendor(await parseResponse<any>(response));
}

export async function updateVendor(id: string, payload: VendorPayload) {
  const response = await fetch(`${API_BASE}/vendors/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify(payload)
  });
  return normalizeVendor(await parseResponse<any>(response));
}
