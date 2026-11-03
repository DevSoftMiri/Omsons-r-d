export type PrototypeEntryStatus = '' | 'Not Started' | 'In Progress' | 'Completed' | 'Failed' | 'Needs Improvement';
export interface PrototypeEntry { id: string; date: string; issue: string; rootCause: string; changesMade: string; status: PrototypeEntryStatus; remarks: string; }
export interface PrototypingData { entries: PrototypeEntry[]; lastSaved: string; }
const emptyData: PrototypingData = { entries: [], lastSaved: new Date().toISOString() };
export const prototypeStatusOptions: Exclude<PrototypeEntryStatus, ''>[] = ['Not Started', 'In Progress', 'Completed', 'Failed', 'Needs Improvement'];
export function prototypingStorageKey(projectCode: string) { return `prototyping:${projectCode}`; }
export function makePrototypeEntry(): PrototypeEntry { return { id: `prototype_${Date.now()}_${Math.random().toString(16).slice(2)}`, date: new Date().toISOString().slice(0, 10), issue: '', rootCause: '', changesMade: '', status: '', remarks: '' }; }
export function readPrototyping(projectCode: string): PrototypingData {
  if (typeof window === 'undefined') return emptyData;
  const saved = window.localStorage.getItem(prototypingStorageKey(projectCode));
  if (!saved) return { ...emptyData, lastSaved: new Date().toISOString() };
  try {
    const parsed = JSON.parse(saved) as Partial<PrototypingData> & { prototypeDate?: string; issuesFound?: string; improvementsRequired?: string; engineerRemarks?: string; prototypeStatus?: PrototypeEntryStatus };
    const entries: PrototypeEntry[] = Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry) : (parsed.prototypeDate || parsed.issuesFound || parsed.improvementsRequired || parsed.engineerRemarks ? [{ id: `prototype_migrated_${Date.now()}`, date: parsed.prototypeDate || '', issue: parsed.issuesFound || '', rootCause: '', changesMade: parsed.improvementsRequired || '', status: (parsed.prototypeStatus || '') as PrototypeEntryStatus, remarks: parsed.engineerRemarks || '' }] : []);
    return { entries, lastSaved: typeof parsed.lastSaved === 'string' ? parsed.lastSaved : new Date().toISOString() };
  } catch { return { ...emptyData, lastSaved: new Date().toISOString() }; }
}
export function savePrototyping(projectCode: string, data: Omit<PrototypingData, 'lastSaved'>) { const payload = { entries: data.entries.map(normalizeEntry), lastSaved: new Date().toISOString() }; window.localStorage.setItem(prototypingStorageKey(projectCode), JSON.stringify(payload)); return payload; }
function normalizeEntry(entry: Partial<PrototypeEntry>): PrototypeEntry { return { id: String(entry.id || `prototype_${Date.now()}`), date: String(entry.date || ''), issue: String(entry.issue || ''), rootCause: String(entry.rootCause || ''), changesMade: String(entry.changesMade || ''), status: prototypeStatusOptions.includes(entry.status as Exclude<PrototypeEntryStatus, ''>) ? entry.status as PrototypeEntryStatus : '', remarks: String(entry.remarks || '') }; }
