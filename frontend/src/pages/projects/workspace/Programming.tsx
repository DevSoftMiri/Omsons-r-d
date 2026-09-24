import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  Edit2,
  Eye,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { useProjectWorkspace } from './context';

type ProgramStatus = 'Draft' | 'Testing' | 'Ready';

type ProgramParameter = {
  id: string;
  name: string;
  value: string;
  unit: string;
};

type ProgramFile = {
  fileName: string;
  fileSize: number;
  url: string;
};

type Program = {
  id: string;
  name: string;
  description: string;
  processMachine: string;
  version: string;
  file: ProgramFile | null;
  parameters: ProgramParameter[];
  status: ProgramStatus;
  updatedAt: string;
};

type StoredProgramming = {
  programs: Program[];
  references: string[];
  notes: string;
  lastSaved: string;
};

const defaultNotes = 'Forming parameters finalized after trial run.\nPrinting alignment requires final verification.\nAnnealing cycle based on standard 250ml beaker profile and may be adjusted after pilot production.';
const projectFiles = ['Beaker_Technical_Drawing.pdf', 'Material_Specification.pdf', 'Beaker_3D_Model.step', 'Requirement_Document.pdf', 'Supplier_Quote.pdf'];

const seedPrograms: Program[] = [
  {
    id: 'program-1',
    name: 'Beaker Forming Program',
    description: 'Main forming program for 250ml beaker',
    processMachine: 'Forming Machine',
    version: 'V3',
    file: { fileName: 'GLW250_Forming.nc', fileSize: 2.4 * 1024 * 1024, url: '' },
    parameters: [
      { id: 'p1', name: 'Forming Temperature', value: '1180', unit: 'C' },
      { id: 'p2', name: 'Rotation Speed', value: '85', unit: 'RPM' }
    ],
    status: 'Ready',
    updatedAt: '2026-09-12'
  },
  {
    id: 'program-2',
    name: 'Graduation Printing',
    description: 'Graduation and marking print program',
    processMachine: 'Printing Machine',
    version: 'V2',
    file: { fileName: 'GLW250_Print.prg', fileSize: 1.8 * 1024 * 1024, url: '' },
    parameters: [{ id: 'p3', name: 'Ink Passes', value: '2', unit: 'pass' }],
    status: 'Testing',
    updatedAt: '2026-09-10'
  },
  {
    id: 'program-3',
    name: 'Annealing Cycle',
    description: 'Annealing temperature cycle',
    processMachine: 'Annealing Lehr',
    version: 'V1',
    file: null,
    parameters: [
      { id: 'p4', name: 'Heating Time', value: '42', unit: 'sec' },
      { id: 'p5', name: 'Cooling Time', value: '28', unit: 'sec' }
    ],
    status: 'Draft',
    updatedAt: '2026-09-08'
  }
];

export function Programming() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const storageKey = `programming:${project.productCode}`;
  const initial = readStoredProgramming(storageKey);
  const [programs, setPrograms] = useState(initial.programs);
  const [references, setReferences] = useState(initial.references);
  const [notes, setNotes] = useState(initial.notes);
  const [lastSaved, setLastSaved] = useState(initial.lastSaved);
  const [saveState, setSaveState] = useState<'Saving...' | 'Saved'>('Saved');
  const [query, setQuery] = useState('');
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [deleteProgram, setDeleteProgram] = useState<Program | null>(null);
  const [showReferences, setShowReferences] = useState(false);

  useEffect(() => {
    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      const timestamp = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ programs, references, notes, lastSaved: timestamp }));
      setLastSaved(timestamp);
      setSaveState('Saved');
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [notes, programs, references, storageKey]);

  const visiblePrograms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return programs.filter((program) => !normalized || [program.name, program.description, program.processMachine, program.version, program.file?.fileName || '', program.status].some((value) => value.toLowerCase().includes(normalized)));
  }, [programs, query]);

  const canComplete = programs.length > 0 && programs.every((program) => program.name && program.version && program.status) && programs.some((program) => program.status === 'Ready');

  function saveProgram(program: Program) {
    const next = { ...program, updatedAt: new Date().toISOString() };
    setPrograms((current) => current.some((item) => item.id === next.id) ? current.map((item) => item.id === next.id ? next : item) : [...current, next]);
    setDrawerMode(null);
    setActiveProgram(null);
  }

  function duplicateProgram(program: Program) {
    setPrograms((current) => [{
      ...program,
      id: `program_${Date.now()}`,
      name: `${program.name} Copy`,
      file: null,
      status: 'Draft',
      updatedAt: new Date().toISOString()
    }, ...current]);
  }

  function removeProgram(id: string) {
    setPrograms((current) => current.filter((program) => program.id !== id));
    setDeleteProgram(null);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 text-sm">
      <TopCrumbs title={project.name} code={project.productCode} />
      <ProjectStageHeader project={project} currentStage="Programming" />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Programming</h2>
          <p className="mt-1.5 max-w-4xl text-sm text-slate-600">Manage machine programs, process parameters and production instructions for this product.</p>
        </div>
        <button className="primary-button h-10" onClick={() => { setActiveProgram(null); setDrawerMode('add'); }}>
          <Plus size={18} />
          Add Program
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">Programs ({programs.length})</h3>
          <label className="relative block w-80 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input className="field pl-10" placeholder="Search programs..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        {programs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="px-3 py-2.5 font-bold">#</th>
                  <th className="px-3 py-2.5 font-bold">Program Name</th>
                  <th className="px-3 py-2.5 font-bold">Process / Machine</th>
                  <th className="px-3 py-2.5 font-bold">Version</th>
                  <th className="px-3 py-2.5 font-bold">File</th>
                  <th className="px-3 py-2.5 font-bold">Status</th>
                  <th className="px-3 py-2.5 font-bold">Updated On</th>
                  <th className="px-3 py-2.5 text-center font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visiblePrograms.map((program, index) => (
                  <tr key={program.id} className="border-b border-slate-200">
                    <td className="px-3 py-3">{index + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-bold">{program.name}</p>
                      <p className="mt-1 max-w-xs text-xs text-slate-500">{program.description}</p>
                    </td>
                    <td className="px-3 py-3">{program.processMachine || '-'}</td>
                    <td className="px-3 py-3">{program.version}</td>
                    <td className="px-3 py-3">
                      {program.file ? (
                        <button className="inline-flex items-start gap-2 text-left text-primary">
                          <FileText size={19} />
                          <span><span className="block font-bold">{program.file.fileName}</span><span className="text-xs text-slate-500">{formatBytes(program.file.fileSize)}</span></span>
                        </button>
                      ) : (
                        <span className="text-slate-500">-<span className="block text-xs">No file uploaded</span></span>
                      )}
                    </td>
                    <td className="px-3 py-3"><StatusBadge status={program.status} /></td>
                    <td className="px-3 py-3">{formatDate(program.updatedAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-center gap-2">
                        <button className="icon-button h-9 w-9 text-primary" title="View" onClick={() => { setActiveProgram(program); setDrawerMode('view'); }}><Eye size={16} /></button>
                        <button className="icon-button h-9 w-9 text-primary" title="Edit" onClick={() => { setActiveProgram(program); setDrawerMode('edit'); }}><Edit2 size={16} /></button>
                        <div className="group relative">
                          <button className="icon-button h-9 w-9" title="More actions"><MoreVertical size={16} /></button>
                          <div className="invisible absolute right-0 top-10 z-20 w-44 rounded-lg border border-slate-200 bg-white p-2 opacity-0 shadow-soft transition group-hover:visible group-hover:opacity-100">
                            <button className="menu-action" onClick={() => duplicateProgram(program)}><Plus size={15} />Duplicate</button>
                            <button className="menu-action text-rose-600" onClick={() => setDeleteProgram(program)}><Trash2 size={15} />Delete</button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState onAdd={() => setDrawerMode('add')} />
        )}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <LinkIcon className="text-primary" size={20} />
              <div>
                <h3 className="font-bold">Reference Files</h3>
                <p className="text-xs text-slate-500">Link relevant design drawings, specifications or other project files.</p>
              </div>
            </div>
            <button className="text-sm font-bold text-primary" onClick={() => setShowReferences(true)}>Link Attachment</button>
          </div>
          <div className="grid gap-2">
            {references.map((file) => (
              <div key={file} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                <span className="grid h-10 w-12 place-items-center rounded-lg bg-slate-100 text-primary"><FileText size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{file}</p>
                  <p className="text-xs text-slate-500">Linked project file</p>
                </div>
                <button className="icon-button h-8 w-8 text-primary"><ExternalLink size={15} /></button>
                <button className="icon-button h-8 w-8" onClick={() => setReferences((current) => current.filter((item) => item !== file))}><MoreVertical size={15} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><FileText className="text-primary" size={20} /><h3 className="font-bold">Programming Notes <span className="font-normal text-slate-500">(Optional)</span></h3></div>
            <span className="text-sm font-bold text-primary">Edit</span>
          </div>
          <textarea className="field min-h-40 resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>Last saved: {formatDateTime(lastSaved)}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{saveState}</span>
        </div>
        <div className="text-right">
          {!canComplete ? <p className="mb-2 text-sm font-semibold text-amber-700">At least one program must be marked Ready before completing this stage.</p> : null}
          <button className="primary-button h-10 min-w-64 justify-center disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!canComplete} onClick={() => completeStage('Programming')}>
            <Check size={18} />
            Mark Programming Complete
          </button>
        </div>
      </section>

      {drawerMode ? <ProgramDrawer mode={drawerMode} program={activeProgram} onClose={() => setDrawerMode(null)} onEdit={() => setDrawerMode('edit')} onSave={saveProgram} /> : null}
      {deleteProgram ? <DeleteDialog program={deleteProgram} onCancel={() => setDeleteProgram(null)} onDelete={() => removeProgram(deleteProgram.id)} /> : null}
      {showReferences ? <ReferenceModal linked={references} onClose={() => setShowReferences(false)} onSave={(items) => { setReferences(items); setShowReferences(false); }} /> : null}
    </div>
  );
}

function ProgramDrawer({ mode, program, onClose, onEdit, onSave }: { mode: 'add' | 'edit' | 'view'; program: Program | null; onClose: () => void; onEdit: () => void; onSave: (program: Program) => void }) {
  const readOnly = mode === 'view';
  const [form, setForm] = useState<Program>(program || {
    id: `program_${Date.now()}`,
    name: '',
    description: '',
    processMachine: '',
    version: 'V1',
    file: null,
    parameters: [],
    status: 'Draft',
    updatedAt: new Date().toISOString()
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    if (!form.name.trim() || !form.version.trim()) return;
    onSave(form);
  }

  function setParameter(id: string, patch: Partial<ProgramParameter>) {
    setForm((current) => ({ ...current, parameters: current.parameters.map((parameter) => parameter.id === id ? { ...parameter, ...patch } : parameter) }));
  }

  function addParameter() {
    setForm((current) => ({ ...current, parameters: [...current.parameters, { id: `param_${Date.now()}`, name: '', value: '', unit: '' }] }));
  }

  function setFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setForm((current) => ({ ...current, file: { fileName: file.name, fileSize: file.size, url: URL.createObjectURL(file) } }));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40">
      <form className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-xl font-bold">{mode === 'add' ? 'Add Program' : mode === 'edit' ? 'Edit Program' : 'Program Details'}</h3>
          <button type="button" className="icon-button h-9 w-9" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-auto p-5">
          <Field label="Program Name *"><input className="field" disabled={readOnly} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Process / Machine"><input className="field" disabled={readOnly} value={form.processMachine} onChange={(event) => setForm({ ...form, processMachine: event.target.value })} /></Field>
          <Field label="Version *"><input className="field" disabled={readOnly} value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></Field>
          <Field label="Description (Optional)"><textarea className="field min-h-20 resize-none" disabled={readOnly} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>

          <section>
            <p className="mb-2 text-sm font-bold text-slate-600">Program File (Optional)</p>
            {form.file ? (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <FileText className="text-primary" size={24} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{form.file.fileName}</p>
                  <p className="text-xs text-slate-500">{formatBytes(form.file.fileSize)}</p>
                </div>
                {!readOnly ? <label className="secondary-button h-9 cursor-pointer"><input className="hidden" type="file" onChange={setFile} />Replace</label> : null}
              </div>
            ) : !readOnly ? (
              <label className="grid min-h-20 cursor-pointer place-items-center rounded-lg border border-dashed border-blue-300 text-center text-primary">
                <input className="hidden" type="file" onChange={setFile} />
                <span className="inline-flex items-center gap-2 font-bold"><Upload size={17} />Upload Program File</span>
              </label>
            ) : <p className="text-sm text-slate-500">No file uploaded</p>}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-600">Process Parameters</p>
              {!readOnly ? <button type="button" className="secondary-button h-9 gap-2" onClick={addParameter}><Plus size={15} />Add Parameter</button> : null}
            </div>
            <div className="grid gap-2">
              {form.parameters.map((parameter) => (
                <div key={parameter.id} className="grid grid-cols-[1fr_80px_70px_32px] gap-2">
                  <input className="field" disabled={readOnly} placeholder="Parameter" value={parameter.name} onChange={(event) => setParameter(parameter.id, { name: event.target.value })} />
                  <input className="field" disabled={readOnly} placeholder="Value" value={parameter.value} onChange={(event) => setParameter(parameter.id, { value: event.target.value })} />
                  <input className="field" disabled={readOnly} placeholder="Unit" value={parameter.unit} onChange={(event) => setParameter(parameter.id, { unit: event.target.value })} />
                  {!readOnly ? <button type="button" className="icon-button h-10 w-8 text-rose-600" onClick={() => setForm((current) => ({ ...current, parameters: current.parameters.filter((item) => item.id !== parameter.id) }))}><Trash2 size={15} /></button> : <span />}
                </div>
              ))}
            </div>
          </section>

          <Field label="Status *"><select className="field" disabled={readOnly} value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ProgramStatus })}><option>Draft</option><option>Testing</option><option>Ready</option></select></Field>
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button type="button" className="secondary-button h-10 min-w-28 justify-center" onClick={onClose}>Cancel</button>
          {readOnly ? <button type="button" className="primary-button h-10 min-w-32 justify-center" onClick={onEdit}>Edit Program</button> : <button className="primary-button h-10 min-w-32 justify-center">Save Program</button>}
        </div>
      </form>
    </div>
  );
}

function TopCrumbs({ title, code }: { title: string; code: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link to="../overview" relative="path" className="icon-button h-10 w-10" title="Back to overview"><ChevronRight className="rotate-180" size={18} /></Link><h1 className="text-xl font-bold">{title}</h1></div><div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500"><Link to="/projects" className="hover:text-primary">Projects</Link><ChevronRight size={15} /><Link to="../overview" relative="path" className="hover:text-primary">{code}</Link><ChevronRight size={15} /><span className="font-bold text-ink">Programming</span></div></div>;
}

function ProjectSummary({ currentStage }: { currentStage: string }) {
  const { project } = useProjectWorkspace();
  return <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft"><div className="flex flex-wrap items-center gap-4"><div className="grid h-24 w-32 shrink-0 place-items-center rounded-lg bg-slate-100"><BeakerVisual /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">{project.name}</h2><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{project.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Meta label="Product Code" value={project.productCode} /><Meta label="Category" value="Laboratory Glassware" /><Meta label="Current Stage" value={currentStage} /><Meta label="Priority" value={project.priority} pill /><Meta label="Target Date" value={formatDate(project.targetDate)} icon={<CalendarDays size={20} className="text-primary" />} /></div></div></div></section>;
}

function ReferenceModal({ linked, onClose, onSave }: { linked: string[]; onClose: () => void; onSave: (items: string[]) => void }) {
  const [selected, setSelected] = useState(linked);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"><section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl"><h3 className="text-xl font-bold">Link Project File</h3><div className="mt-4 grid gap-2">{projectFiles.map((file) => <label key={file} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"><input type="checkbox" checked={selected.includes(file)} onChange={() => setSelected((current) => current.includes(file) ? current.filter((item) => item !== file) : [...current, file])} /><span className="font-semibold">{file}</span></label>)}</div><div className="mt-5 flex justify-end gap-3"><button className="secondary-button h-10" onClick={onClose}>Cancel</button><button className="primary-button h-10" onClick={() => onSave(selected)}>Link Selected</button></div></section></div>;
}

function DeleteDialog({ program, onCancel, onDelete }: { program: Program; onCancel: () => void; onDelete: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"><section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl"><h3 className="text-xl font-bold">Delete Program?</h3><p className="mt-2 text-slate-600">"{program.name}" will be permanently removed.</p><div className="mt-5 flex justify-end gap-3"><button className="secondary-button h-10" onClick={onCancel}>Cancel</button><button className="primary-button h-10 bg-rose-600 hover:bg-rose-700" onClick={onDelete}>Delete Program</button></div></section></div>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="grid min-h-64 place-items-center text-center"><div><FileText className="mx-auto text-slate-400" size={52} /><h3 className="mt-4 text-xl font-bold">No programs added yet.</h3><p className="mt-2 max-w-lg text-slate-500">Add machine programs, process parameters or manufacturing instructions required to produce this product.</p><button className="primary-button mt-5" onClick={onAdd}><Plus size={18} />Add First Program</button></div></div>;
}

function StatusBadge({ status }: { status: ProgramStatus }) {
  const className = status === 'Ready' ? 'bg-emerald-100 text-emerald-700' : status === 'Testing' ? 'bg-blue-100 text-primary' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${className}`}>{status}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-600">{label}</span>{children}</label>;
}

function Meta({ label, value, pill, icon }: { label: string; value: string; pill?: boolean; icon?: ReactNode }) {
  return <div className="border-slate-200 xl:border-l xl:pl-6 first:xl:border-l-0 first:xl:pl-0"><p className="text-xs text-slate-500">{label}</p><div className="mt-1.5 flex items-center gap-2 font-bold">{icon}{pill ? <span className="rounded-full bg-rose-100 px-4 py-1.5 text-rose-600">{value}</span> : <span>{value}</span>}</div></div>;
}

function readStoredProgramming(key: string): StoredProgramming {
  const fallback = { programs: seedPrograms, references: ['Beaker_Technical_Drawing.pdf', 'Material_Specification.pdf', 'Beaker_3D_Model.step'], notes: defaultNotes, lastSaved: new Date().toISOString() };
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved) as Partial<StoredProgramming>;
    return {
      programs: Array.isArray(parsed.programs) ? parsed.programs : fallback.programs,
      references: Array.isArray(parsed.references) ? parsed.references : fallback.references,
      notes: typeof parsed.notes === 'string' ? parsed.notes : fallback.notes,
      lastSaved: typeof parsed.lastSaved === 'string' ? parsed.lastSaved : fallback.lastSaved
    };
  } catch {
    return fallback;
  }
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function BeakerVisual() {
  return <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none"><path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" /><path d="M49 76h22M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" /><rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" /></svg>;
}
