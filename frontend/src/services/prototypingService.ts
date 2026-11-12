export type PrototypeEntryStatus = '' | 'Not Started' | 'In Progress' | 'Completed' | 'Failed' | 'Needs Improvement';
export interface PrototypeEntry { id: string; date: string; issue: string; rootCause: string; changesMade: string; status: PrototypeEntryStatus; remarks: string; }
export interface PrototypingData { entries: PrototypeEntry[]; lastSaved: string; }
const emptyData: PrototypingData = { entries: [], lastSaved: new Date().toISOString() };
export const prototypeStatusOptions: Exclude<PrototypeEntryStatus, ''>[] = ['Not Started', 'In Progress', 'Completed', 'Failed', 'Needs Improvement'];
export function prototypingStorageKey(projectCode: string) { return `prototyping:${projectCode}`; }
export function makePrototypeEntry(): PrototypeEntry { return { id: `prototype_${Date.now()}_${Math.random().toString(16).slice(2)}`, date: new Date().toISOString().slice(0, 10), issue: '', rootCause: '', changesMade: '', status: '', remarks: '' }; }
export function readPrototyping(projectCode: string): PrototypingData {
  return emptyData;
}
export async function fetchPrototyping(projectCode: string) {
  const { fetchProjectModule } = await import('./projectModuleService');
  const result = await fetchProjectModule<PrototypingData>(projectCode, 'prototyping');
  return result.data ? { entries: result.data.entries.map(normalizeEntry), lastSaved: result.updatedAt || result.data.lastSaved } : emptyData;
}
export async function savePrototyping(projectCode: string, data: Omit<PrototypingData, 'lastSaved'>) {
  const payload = { entries: data.entries.map(normalizeEntry), lastSaved: new Date().toISOString() };
  const { updateProjectModule } = await import('./projectModuleService');
  const result = await updateProjectModule(projectCode, 'prototyping', payload);
  return { ...payload, lastSaved: result.updatedAt };
}
function normalizeEntry(entry: Partial<PrototypeEntry>): PrototypeEntry { return { id: String(entry.id || `prototype_${Date.now()}`), date: String(entry.date || ''), issue: String(entry.issue || ''), rootCause: String(entry.rootCause || ''), changesMade: String(entry.changesMade || ''), status: prototypeStatusOptions.includes(entry.status as Exclude<PrototypeEntryStatus, ''>) ? entry.status as PrototypeEntryStatus : '', remarks: String(entry.remarks || '') }; }
