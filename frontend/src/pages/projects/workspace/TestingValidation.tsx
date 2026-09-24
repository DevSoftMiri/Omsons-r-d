import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronRight, Download, Edit2, Eye, FileText, Filter, MoreVertical, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppDispatch } from '../../../hooks';
import { completeStage } from '../../../store';
import { useProjectWorkspace } from './context';

type TestResult = 'Pass' | 'Fail' | 'Retest';
type TestParam = { id: string; parameter: string; target: string; actual: string; result: TestResult };
type TestRecord = {
  id: string;
  name: string;
  type: string;
  date: string;
  result: TestResult;
  findings: string;
  document: string;
  documentSize: number;
  parameters: TestParam[];
};
type StoredValidation = { tests: TestRecord[]; findings: string; nextSteps: string[]; lastSaved: string };

const defaultFindings = 'Product meets dimensional requirements.\nNo visible glass defects in recent trials.\nThermal shock test needs retesting.\nGraduation alignment to be improved.';
const defaultNextSteps = ['Repeat thermal shock test with modified annealing cycle.', 'Improve printing alignment and revalidate graduation.', 'Conduct extended chemical resistance test.', 'Prepare final test report after successful retest.'];
const testTypes = ['Trial Run', 'Dimensional Check', 'Performance Test', 'Visual Inspection', 'Others'];

const seedTests: TestRecord[] = [
  { id: 't1', name: 'Production Trial - Batch 1', type: 'Trial Run', date: '2026-09-12', result: 'Pass', findings: 'Good shape and clarity. Minor air bubbles.', document: 'Trial_Report_B1.pdf', documentSize: 2.4 * 1024 * 1024, parameters: [] },
  { id: 't2', name: 'Dimensional Check', type: 'Dimensional Check', date: '2026-09-10', result: 'Pass', findings: 'All dimensions within tolerance.', document: 'Dimension_Test.xlsx', documentSize: 1.8 * 1024 * 1024, parameters: [{ id: 'p1', parameter: 'Capacity', target: '250 ml', actual: '251 ml', result: 'Pass' }, { id: 'p2', parameter: 'Height', target: '95 mm', actual: '94.8 mm', result: 'Pass' }] },
  { id: 't3', name: 'Thermal Shock Test', type: 'Performance Test', date: '2026-09-08', result: 'Retest', findings: 'Cracks observed in 2 out of 10 samples.', document: 'Thermal_Test.pdf', documentSize: 1.2 * 1024 * 1024, parameters: [] },
  { id: 't4', name: 'Visual Inspection', type: 'Visual Inspection', date: '2026-09-05', result: 'Pass', findings: 'No visible defects. Good surface finish.', document: 'Visual_Report.pdf', documentSize: 950 * 1024, parameters: [] },
  { id: 't5', name: 'Chemical Resistance Test', type: 'Performance Test', date: '2026-09-02', result: 'Pass', findings: 'No corrosion or reaction observed.', document: 'Chemical_Test.pdf', documentSize: 1.6 * 1024 * 1024, parameters: [] },
  { id: 't6', name: 'Graduation Accuracy Test', type: 'Others', date: '2026-08-30', result: 'Fail', findings: 'Graduation misalignment observed.', document: 'Graduation_Test.pdf', documentSize: 1.1 * 1024 * 1024, parameters: [] }
];

export function TestingValidation() {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  const storageKey = `testing-validation:${project.productCode}`;
  const initial = readStored(storageKey);
  const [tests, setTests] = useState(initial.tests);
  const [findings, setFindings] = useState(initial.findings);
  const [nextSteps, setNextSteps] = useState(initial.nextSteps);
  const [lastSaved, setLastSaved] = useState(initial.lastSaved);
  const [saveState, setSaveState] = useState<'Saving...' | 'Saved'>('Saved');
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState('All Tests');
  const [drawer, setDrawer] = useState<TestRecord | null | 'new'>(null);
  const [deleteTest, setDeleteTest] = useState<TestRecord | null>(null);

  useEffect(() => {
    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      const timestamp = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ tests, findings, nextSteps, lastSaved: timestamp }));
      setLastSaved(timestamp);
      setSaveState('Saved');
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [findings, nextSteps, storageKey, tests]);

  const tabs = useMemo(() => ['All Tests', ...testTypes].map((type) => ({ type, count: type === 'All Tests' ? tests.length : tests.filter((test) => test.type === type).length })).filter((tab) => tab.count || tab.type === 'All Tests'), [tests]);
  const visibleTests = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tests.filter((test) => {
      const typeMatch = activeType === 'All Tests' || test.type === activeType;
      const searchMatch = !normalized || [test.name, test.type, test.findings, test.document, test.result].some((value) => value.toLowerCase().includes(normalized));
      return typeMatch && searchMatch;
    });
  }, [activeType, query, tests]);
  const canComplete = tests.length > 0 && tests.some((test) => test.result === 'Pass') && !tests.some((test) => test.result === 'Fail');

  function saveTest(test: TestRecord) {
    setTests((current) => current.some((item) => item.id === test.id) ? current.map((item) => item.id === test.id ? test : item) : [test, ...current]);
    setDrawer(null);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 text-sm">
      <TopCrumbs title={project.name} code={project.productCode} />
      <ProjectSummary currentStage="Testing & Validation" />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Testing & Validation</h2>
          <p className="mt-1.5 text-sm text-slate-600">Record manufacturing trials, dimensional checks, performance tests, inspections and validation results for this product.</p>
        </div>
        <button className="primary-button h-10" onClick={() => setDrawer('new')}><Plus size={18} />Add Test</button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => <button key={tab.type} className={`rounded-full px-3 py-1.5 text-xs font-bold ${activeType === tab.type ? 'bg-blue-50 text-primary ring-1 ring-blue-200' : 'bg-slate-50 text-slate-600'}`} onClick={() => setActiveType(tab.type)}>{tab.type} ({tab.count})</button>)}
          </div>
          <div className="flex gap-2">
            <label className="relative block w-72 max-w-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="field pl-10" placeholder="Search tests..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <button className="secondary-button h-10 gap-2"><Filter size={16} />Filter</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left">
            <thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="px-3 py-2.5">#</th><th className="px-3 py-2.5">Test Name</th><th className="px-3 py-2.5">Test Type</th><th className="px-3 py-2.5">Date</th><th className="px-3 py-2.5">Result</th><th className="px-3 py-2.5">Key Findings</th><th className="px-3 py-2.5">Documents</th><th className="px-3 py-2.5 text-center">Actions</th></tr></thead>
            <tbody>{visibleTests.map((test, index) => <tr key={test.id} className="border-b border-slate-200"><td className="px-3 py-3">{index + 1}</td><td className="px-3 py-3"><p className="font-bold">{test.name}</p><p className="text-xs text-slate-500">{test.findings}</p></td><td className="px-3 py-3"><TypeBadge type={test.type} /></td><td className="px-3 py-3">{formatDate(test.date)}</td><td className="px-3 py-3"><ResultBadge result={test.result} /></td><td className="px-3 py-3 max-w-[220px]">{test.findings}</td><td className="px-3 py-3"><button className="inline-flex items-start gap-2 text-left text-primary"><FileText size={19} /><span><span className="block font-bold">{test.document}</span><span className="text-xs text-slate-500">{formatBytes(test.documentSize)}</span></span></button></td><td className="px-3 py-3"><div className="flex justify-center gap-2"><button className="icon-button h-9 w-9 text-primary"><Eye size={16} /></button><button className="icon-button h-9 w-9 text-primary" onClick={() => setDrawer(test)}><Edit2 size={16} /></button><button className="icon-button h-9 w-9" onClick={() => setDeleteTest(test)}><MoreVertical size={16} /></button></div></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold">Recent Test Reports</h3><span className="text-sm font-bold text-primary">View All</span></div>
        <div className="grid gap-3 md:grid-cols-4">{tests.slice(0, 4).map((test) => <div key={test.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5"><span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-100 text-rose-600"><FileText size={20} /></span><div className="min-w-0"><p className="truncate font-bold">{test.document}</p><p className="text-xs text-slate-500">{formatDate(test.date)} - {formatBytes(test.documentSize)}</p></div><Download className="ml-auto text-primary" size={17} /></div>)}</div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft"><div className="mb-2 flex justify-between"><h3 className="font-bold">Key Findings <span className="font-normal text-slate-500">(Optional)</span></h3><span className="text-sm font-bold text-primary">Edit</span></div><textarea className="field min-h-28 resize-none" value={findings} onChange={(event) => setFindings(event.target.value)} /></div>
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft"><div className="mb-2 flex justify-between"><h3 className="font-bold">Next Steps <span className="font-normal text-slate-500">(Optional)</span></h3><span className="text-sm font-bold text-primary">Edit</span></div><div className="grid gap-2">{nextSteps.map((step, index) => <label key={step} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" defaultChecked={index === 1} onChange={() => undefined} />{step}</label>)}</div></div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500"><span>Last saved: {formatDateTime(lastSaved)}</span><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{saveState}</span></div>
        <div className="text-right">{!canComplete ? <p className="mb-2 text-sm font-semibold text-amber-700">Resolve failed tests before completing this stage.</p> : null}<button className="primary-button h-10 min-w-72 justify-center disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!canComplete} onClick={() => dispatch(completeStage({ projectId: project.id, stage: 'Testing & Validation' }))}><Check size={18} />Mark Testing & Validation Complete</button></div>
      </section>

      {drawer ? <TestDrawer test={drawer === 'new' ? null : drawer} onClose={() => setDrawer(null)} onSave={saveTest} /> : null}
      {deleteTest ? <DeleteDialog test={deleteTest} onCancel={() => setDeleteTest(null)} onDelete={() => { setTests((current) => current.filter((item) => item.id !== deleteTest.id)); setDeleteTest(null); }} /> : null}
    </div>
  );
}

function TestDrawer({ test, onClose, onSave }: { test: TestRecord | null; onClose: () => void; onSave: (test: TestRecord) => void }) {
  const [form, setForm] = useState<TestRecord>(test || { id: `test_${Date.now()}`, name: '', type: 'Dimensional Check', date: new Date().toISOString().slice(0, 10), result: 'Pass', findings: '', document: '', documentSize: 0, parameters: [] });
  function submit(event: FormEvent) { event.preventDefault(); if (!form.name.trim()) return; onSave(form); }
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"><form className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onSubmit={submit}><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h3 className="text-xl font-bold">{test ? 'Edit Test / Trial' : 'Add Test / Trial'}</h3><button type="button" className="icon-button h-9 w-9" onClick={onClose}><X size={16} /></button></div><div className="flex-1 space-y-4 overflow-auto p-5"><Field label="Test Name *"><input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Test Type *"><select className="field" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{testTypes.map((type) => <option key={type}>{type}</option>)}</select></Field><Field label="Date *"><input className="field" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field><Field label="Result *"><select className="field" value={form.result} onChange={(event) => setForm({ ...form, result: event.target.value as TestResult })}><option>Pass</option><option>Fail</option><option>Retest</option></select></Field><Field label="Description (Optional)"><textarea className="field min-h-20 resize-none" value={form.findings} onChange={(event) => setForm({ ...form, findings: event.target.value })} /></Field><section><div className="mb-2 flex items-center justify-between"><p className="text-sm font-bold text-slate-600">Test Parameters / Results</p><button type="button" className="secondary-button h-9 gap-2" onClick={() => setForm((current) => ({ ...current, parameters: [...current.parameters, { id: `param_${Date.now()}`, parameter: '', target: '', actual: '', result: 'Pass' }] }))}><Plus size={15} />Add Parameter</button></div><div className="grid gap-2">{form.parameters.map((param) => <div key={param.id} className="grid grid-cols-[1fr_70px_70px_70px_32px] gap-2"><input className="field" placeholder="Parameter" value={param.parameter} onChange={(event) => setForm((current) => ({ ...current, parameters: current.parameters.map((item) => item.id === param.id ? { ...item, parameter: event.target.value } : item) }))} /><input className="field" placeholder="Target" value={param.target} onChange={(event) => setForm((current) => ({ ...current, parameters: current.parameters.map((item) => item.id === param.id ? { ...item, target: event.target.value } : item) }))} /><input className="field" placeholder="Actual" value={param.actual} onChange={(event) => setForm((current) => ({ ...current, parameters: current.parameters.map((item) => item.id === param.id ? { ...item, actual: event.target.value } : item) }))} /><select className="field" value={param.result} onChange={(event) => setForm((current) => ({ ...current, parameters: current.parameters.map((item) => item.id === param.id ? { ...item, result: event.target.value as TestResult } : item) }))}><option>Pass</option><option>Fail</option><option>Retest</option></select><button type="button" className="icon-button h-10 w-8 text-rose-600" onClick={() => setForm((current) => ({ ...current, parameters: current.parameters.filter((item) => item.id !== param.id) }))}><Trash2 size={15} /></button></div>)}</div></section><Field label="Test Evidence / Document"><input className="field" placeholder="Dimension_Test.xlsx" value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value, documentSize: form.documentSize || 1.8 * 1024 * 1024 })} /></Field><Field label="Related Programs"><input className="field" placeholder="Beaker Forming Program" /></Field><Field label="Related Design Files"><input className="field" placeholder="Beaker_Technical_Drawing.pdf" /></Field></div><div className="flex justify-end gap-3 border-t border-slate-200 p-5"><button type="button" className="secondary-button h-10 min-w-28 justify-center" onClick={onClose}>Cancel</button><button className="primary-button h-10 min-w-32 justify-center">Save Test</button></div></form></div>;
}

function TopCrumbs({ title, code }: { title: string; code: string }) { return <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link to="../overview" relative="path" className="icon-button h-10 w-10"><ChevronRight className="rotate-180" size={18} /></Link><h1 className="text-xl font-bold">{title}</h1></div><div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500"><Link to="/projects" className="hover:text-primary">Projects</Link><ChevronRight size={15} /><Link to="../overview" relative="path">{code}</Link><ChevronRight size={15} /><span className="font-bold text-ink">Testing & Validation</span></div></div>; }
function ProjectSummary({ currentStage }: { currentStage: string }) { const { project } = useProjectWorkspace(); return <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft"><div className="flex flex-wrap items-center gap-4"><div className="grid h-24 w-32 shrink-0 place-items-center rounded-lg bg-slate-100"><BeakerVisual /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">{project.name}</h2><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{project.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Meta label="Product Code" value={project.productCode} /><Meta label="Category" value="Laboratory Glassware" /><Meta label="Current Stage" value={currentStage} /><Meta label="Priority" value={project.priority} pill /><Meta label="Target Date" value={formatDate(project.targetDate)} icon={<CalendarDays size={20} className="text-primary" />} /></div></div></div></section>; }
function TypeBadge({ type }: { type: string }) { const cls = type === 'Dimensional Check' ? 'bg-violet-100 text-violet-700' : type === 'Performance Test' ? 'bg-orange-100 text-orange-600' : type === 'Visual Inspection' ? 'bg-rose-100 text-rose-600' : type === 'Trial Run' ? 'bg-blue-100 text-primary' : 'bg-slate-100 text-slate-600'; return <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{type.replace(' Check', '')}</span>; }
function ResultBadge({ result }: { result: TestResult }) { const cls = result === 'Pass' ? 'bg-emerald-100 text-emerald-700' : result === 'Fail' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'; return <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{result}</span>; }
function DeleteDialog({ test, onCancel, onDelete }: { test: TestRecord; onCancel: () => void; onDelete: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"><section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl"><h3 className="text-xl font-bold">Delete Test?</h3><p className="mt-2 text-slate-600">"{test.name}" will be removed.</p><div className="mt-5 flex justify-end gap-3"><button className="secondary-button h-10" onClick={onCancel}>Cancel</button><button className="primary-button h-10 bg-rose-600 hover:bg-rose-700" onClick={onDelete}>Delete</button></div></section></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-600">{label}</span>{children}</label>; }
function Meta({ label, value, pill, icon }: { label: string; value: string; pill?: boolean; icon?: ReactNode }) { return <div className="border-slate-200 xl:border-l xl:pl-6 first:xl:border-l-0 first:xl:pl-0"><p className="text-xs text-slate-500">{label}</p><div className="mt-1.5 flex items-center gap-2 font-bold">{icon}{pill ? <span className="rounded-full bg-rose-100 px-4 py-1.5 text-rose-600">{value}</span> : <span>{value}</span>}</div></div>; }
function readStored(key: string): StoredValidation { const fallback = { tests: seedTests, findings: defaultFindings, nextSteps: defaultNextSteps, lastSaved: new Date().toISOString() }; const saved = localStorage.getItem(key); if (!saved) return fallback; try { const parsed = JSON.parse(saved) as Partial<StoredValidation>; return { tests: Array.isArray(parsed.tests) ? parsed.tests : fallback.tests, findings: typeof parsed.findings === 'string' ? parsed.findings : fallback.findings, nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : fallback.nextSteps, lastSaved: typeof parsed.lastSaved === 'string' ? parsed.lastSaved : fallback.lastSaved }; } catch { return fallback; } }
function formatBytes(value: number) { if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatDateTime(value: string) { return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function BeakerVisual() { return <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none"><path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" /><path d="M49 76h22M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" /><rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" /></svg>; }
