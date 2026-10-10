export type PrototypeStatus = '' | 'Not Started' | 'In Progress' | 'Completed' | 'Failed' | 'Needs Improvement';
export type PrototypeApprovalStatus = '' | 'Approved for testing' | 'Rework required';

export interface PrototypingData {
  prototypeVersion: string;
  prototypeDate: string;
  buildNotes: string;
  prototypeStatus: PrototypeStatus;
  issuesFound: string;
  improvementsRequired: string;
  engineerRemarks: string;
  approvalStatus: PrototypeApprovalStatus;
  lastSaved: string;
}

const emptyPrototypingData: PrototypingData = {
  prototypeVersion: '',
  prototypeDate: '',
  buildNotes: '',
  prototypeStatus: '',
  issuesFound: '',
  improvementsRequired: '',
  engineerRemarks: '',
  approvalStatus: '',
  lastSaved: new Date().toISOString()
};

export const prototypeStatusOptions: Exclude<PrototypeStatus, ''>[] = ['Not Started', 'In Progress', 'Completed', 'Failed', 'Needs Improvement'];
export const prototypeApprovalOptions: Exclude<PrototypeApprovalStatus, ''>[] = ['Approved for testing', 'Rework required'];

export function prototypingStorageKey(projectCode: string) {
  return `prototyping:${projectCode}`;
}

export function readPrototyping(projectCode: string): PrototypingData {
  if (typeof window === 'undefined') return emptyPrototypingData;
  const saved = window.localStorage.getItem(prototypingStorageKey(projectCode));
  if (!saved) return { ...emptyPrototypingData, lastSaved: new Date().toISOString() };
  try {
    return normalizePrototyping(JSON.parse(saved) as Partial<PrototypingData>);
  } catch {
    return { ...emptyPrototypingData, lastSaved: new Date().toISOString() };
  }
}

export function savePrototyping(projectCode: string, data: Omit<PrototypingData, 'lastSaved'>) {
  const payload = normalizePrototyping({ ...data, lastSaved: new Date().toISOString() });
  window.localStorage.setItem(prototypingStorageKey(projectCode), JSON.stringify(payload));
  return payload;
}

function normalizePrototyping(data: Partial<PrototypingData>): PrototypingData {
  return {
    prototypeVersion: String(data.prototypeVersion || ''),
    prototypeDate: String(data.prototypeDate || ''),
    buildNotes: String(data.buildNotes || ''),
    prototypeStatus: prototypeStatusOptions.includes(data.prototypeStatus as Exclude<PrototypeStatus, ''>) ? data.prototypeStatus as PrototypeStatus : '',
    issuesFound: String(data.issuesFound || ''),
    improvementsRequired: String(data.improvementsRequired || ''),
    engineerRemarks: String(data.engineerRemarks || ''),
    approvalStatus: prototypeApprovalOptions.includes(data.approvalStatus as Exclude<PrototypeApprovalStatus, ''>) ? data.approvalStatus as PrototypeApprovalStatus : '',
    lastSaved: typeof data.lastSaved === 'string' ? data.lastSaved : new Date().toISOString()
  };
}
