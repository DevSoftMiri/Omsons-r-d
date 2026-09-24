import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronRight, Download, Edit2, Eye, FileSpreadsheet, FileText, MoreVertical, Plus, Trash2, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppDispatch } from '../../../hooks';
import { completeStage } from '../../../store';
import type { Stage, StageName } from '../../../types';
import { useProjectWorkspace } from './context';

type Decision = 'approve' | 'further-development' | 'on-hold';
type FinalDocument = { id: string; fileName: string; description: string; uploadedOn: string; size: number; url: string };
type FinalStageData = { summary: string; issues: string; decision: Decision; documents: FinalDocument[]; approved: boolean; approvedBy: string; approvedAt: string; comments: string; lastSaved: string };

const defaultSummary = 'The product has met design, quality and manufacturing requirements. Trial production and testing results are satisfactory. The product is ready to proceed to production.';
const defaultIssues = 'No remaining issues.';
const stageRoutes: Record<StageName, string> = {
  Prerequisites: 'prerequisites',
  Benchmarking: 'benchmarking',
  Attachments: 'attachments',
  BOM: 'bom',
  'Product Design': 'product-design',
  Programming: 'programming',
  'Testing & Validation': 'testing-validation',
  'Final Stage': 'final-stage'
};

const seedDocuments: FinalDocument[] = [
  { id: 'doc1', fileName: 'Final_Approval_Report.pdf', description: 'Final evaluation and approval document', uploadedOn: '2026-09-16', size: 2.4 * 1024 * 1024, url: '' },
  { id: 'doc2', fileName: 'Production_Specification.pdf', description: 'Approved product specification', uploadedOn: '2026-09-15', size: 1.8 * 1024 * 1024, url: '' },
  { id: 'doc3', fileName: 'Manufacturing_Instructions.pdf', description: 'Final manufacturing guide', uploadedOn: '2026-09-15', size: 1.2 * 1024 * 1024, url: '' },
  { id: 'doc4', fileName: 'Final_BOM.xlsx', description: 'Final cost and BOM', uploadedOn: '2026-09-14', size: 950 * 1024, url: '' }
];

export function FinalStage() {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  const storageKey = `final-stage:${project.productCode}`;
  const initial = readStored(storageKey);
  const [summary, setSummary] = useState(initial.summary);
  const [issues, setIssues] = useState(initial.issues);
  const [decision, setDecision] = useState<Decision>(initial.decision);
  const [documents, setDocuments] = useState(initial.documents);
  const [approved, setApproved] = useState(initial.approved);
  const [approvedBy, setApprovedBy] = useState(initial.approvedBy);
  const [approvedAt, setApprovedAt] = useState(initial.approvedAt);
  const [comments, setComments] = useState(initial.comments);
  const [lastSaved, setLastSaved] = useState(initial.lastSaved);
  const [saveState, setSaveState] = useState<'Saving...' | 'Saved'>('Saved');
  const [showApproval, setShowApproval] = useState(false);
  const [showDocument, setShowDocument] = useState(false);
  const [deleteDocument, setDeleteDocument] = useState<FinalDocument | null>(null);

  useEffect(() => {
    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      const timestamp = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ summary, issues, decision, documents, approved, approvedBy, approvedAt, comments, lastSaved: timestamp }));
      setLastSaved(timestamp);
      setSaveState('Saved');
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [approved, approvedAt, approvedBy, comments, decision, documents, issues, storageKey, summary]);

  const requiredStages = project.stages.filter((stage) => stage.name !== 'Final Stage');
  const blockers = requiredStages.filter((stage) => stage.status !== 'Completed');
  const canApprove = blockers.length === 0 && summary.trim() && decision && saveState === 'Saved' && !approved;
  const statusRows = useMemo(() => requiredStages.map((stage, index) => ({ stage, index, dueDate: getStageDate(stage, index), deadline: getDeadline(stage, index) })), [requiredStages]);

  function addDocument(file: File, description: string) {
    setDocuments((current) => [{
      id: `doc_${Date.now()}`,
      fileName: file.name,
      description: description || 'Final stage document',
      uploadedOn: new Date().toISOString(),
      size: file.size,
      url: URL.createObjectURL(file)
    }, ...current]);
    setShowDocument(false);
  }

  function approveProduct(data: { decision: Decision; date: string; approvedBy: string; comments: string }) {
    setDecision(data.decision);
    setApprovedBy(data.approvedBy);
    setApprovedAt(data.date);
    setComments(data.comments);
    if (data.decision === 'approve' && blockers.length === 0) {
      setApproved(true);
      dispatch(completeStage({ projectId: project.id, stage: 'Final Stage' }));
    }
    setShowApproval(false);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 text-sm">
      <TopCrumbs title={project.name} code={project.productCode} />
      <ProjectSummary currentStage="Final Stage" approved={approved} />

      <section>
        <h2 className="text-2xl font-bold">Final Stage</h2>
        <p className="mt-1.5 text-sm text-slate-600">Review project completion and approve the product for production.</p>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.95fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-start gap-3"><FileText className="mt-0.5 text-primary" size={20} /><div><h3 className="font-bold">Development Stages</h3><p className="text-xs text-slate-500">Status of all stages and time remaining.</p></div></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="px-3 py-2.5">#</th><th className="px-3 py-2.5">Stage</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Completed / Due</th><th className="px-3 py-2.5">Time Remaining</th></tr></thead>
              <tbody>{statusRows.map(({ stage, index, dueDate, deadline }) => <tr key={stage.name} className="border-b border-slate-200"><td className="px-3 py-3">{index + 1}</td><td className="px-3 py-3"><Link to={`../${stageRoutes[stage.name]}`} relative="path" className="font-bold hover:text-primary">{stage.name}</Link></td><td className="px-3 py-3"><StageBadge stage={stage} overdue={deadline.overdue} /></td><td className="px-3 py-3">{formatDate(dueDate)}</td><td className={`px-3 py-3 font-semibold ${deadline.className}`}>{stage.status === 'Completed' ? '-' : deadline.label}</td></tr>)}</tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><FileText className="text-primary" size={20} /><h3 className="font-bold">Final Evaluation</h3></div><button className="secondary-button h-9 gap-2"><Edit2 size={15} />Edit</button></div>
          <Field label="Overall Summary"><textarea className="field min-h-24 resize-none" value={summary} onChange={(event) => setSummary(event.target.value)} /></Field>
          <div className="mt-3"><Field label="Remaining Issues"><textarea className="field min-h-16 resize-none bg-emerald-50" value={issues} onChange={(event) => setIssues(event.target.value)} /></Field></div>
          <div className="mt-3"><p className="mb-2 font-bold">Final Decision</p><DecisionCards value={decision} onChange={setDecision} /></div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Final Documents</h3><p className="text-xs text-slate-500">Important documents for final approval and production handover.</p></div><button className="secondary-button h-10 gap-2 text-primary" onClick={() => setShowDocument(true)}><Plus size={17} />Add Document</button></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left"><thead><tr className="bg-slate-50 text-xs text-slate-500"><th className="px-3 py-2.5">#</th><th className="px-3 py-2.5">File Name</th><th className="px-3 py-2.5">Description</th><th className="px-3 py-2.5">Uploaded On</th><th className="px-3 py-2.5">Size</th><th className="px-3 py-2.5 text-center">Actions</th></tr></thead><tbody>{documents.map((doc, index) => <tr key={doc.id} className="border-b border-slate-200"><td className="px-3 py-3">{index + 1}</td><td className="px-3 py-3"><div className="flex items-center gap-2"><DocIcon fileName={doc.fileName} /><span className="font-bold">{doc.fileName}</span></div></td><td className="px-3 py-3">{doc.description}</td><td className="px-3 py-3">{formatDate(doc.uploadedOn)}</td><td className="px-3 py-3">{formatBytes(doc.size)}</td><td className="px-3 py-3"><div className="flex justify-center gap-2"><button className="icon-button h-8 w-8 text-primary"><Eye size={15} /></button><a className={`icon-button h-8 w-8 text-primary ${doc.url ? '' : 'pointer-events-none opacity-50'}`} href={doc.url || undefined} download={doc.fileName}><Download size={15} /></a><button className="icon-button h-8 w-8" onClick={() => setDeleteDocument(doc)}><MoreVertical size={15} /></button></div></td></tr>)}</tbody></table>
        </div>
      </section>

      <BlockerAlert blockers={blockers} />

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500"><span>Last saved: {formatDateTime(lastSaved)}</span><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{saveState}</span></div>
        <div className="text-right">{approved ? <div className="font-bold text-emerald-700">Product Approved for Production<br /><span className="text-xs font-normal text-slate-500">Approved by {approvedBy} on {formatDate(approvedAt)}</span></div> : <><p className="mb-2 text-sm font-semibold text-amber-700">{canApprove ? '' : blockers.length ? `${blockers.length} development stage${blockers.length > 1 ? 's are' : ' is'} still pending.` : 'Complete final evaluation before approval.'}</p><button className="primary-button h-10 min-w-56 justify-center disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!canApprove} onClick={() => setShowApproval(true)}><Check size={18} />Approve Product</button></>}</div>
      </section>

      {showApproval ? <ApprovalDrawer decision={decision} onClose={() => setShowApproval(false)} onApprove={approveProduct} /> : null}
      {showDocument ? <DocumentModal onClose={() => setShowDocument(false)} onUpload={addDocument} /> : null}
      {deleteDocument ? <DeleteDialog document={deleteDocument} onCancel={() => setDeleteDocument(null)} onDelete={() => { setDocuments((current) => current.filter((doc) => doc.id !== deleteDocument.id)); setDeleteDocument(null); }} /> : null}
    </div>
  );
}

function DecisionCards({ value, onChange }: { value: Decision; onChange: (decision: Decision) => void }) {
  const options: { id: Decision; title: string; desc: string; className: string }[] = [
    { id: 'approve', title: 'Approve for Production', desc: 'Product is ready for production.', className: 'bg-emerald-50 border-emerald-100' },
    { id: 'further-development', title: 'Require Further Development', desc: 'Additional work is needed before production.', className: 'bg-orange-50 border-orange-100' },
    { id: 'on-hold', title: 'Put On Hold', desc: 'Temporarily hold this project.', className: 'bg-rose-50 border-rose-100' }
  ];
  return <div className="grid gap-2">{options.map((option) => <button key={option.id} className={`flex items-start gap-3 rounded-lg border p-3 text-left ${option.className}`} onClick={() => onChange(option.id)}><span className={`mt-1 h-4 w-4 rounded-full border ${value === option.id ? 'border-primary bg-primary' : 'border-slate-300'}`} /><span><span className="block font-bold">{option.title}</span><span className="text-xs text-slate-500">{option.desc}</span></span></button>)}</div>;
}

function ApprovalDrawer({ decision, onClose, onApprove }: { decision: Decision; onClose: () => void; onApprove: (data: { decision: Decision; date: string; approvedBy: string; comments: string }) => void }) {
  const [form, setForm] = useState({ decision, date: new Date().toISOString().slice(0, 10), approvedBy: 'R&D Manager', comments: 'All development stages completed. Product ready for production.' });
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"><form className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onSubmit={(event) => { event.preventDefault(); onApprove(form); }}><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h3 className="text-xl font-bold">Approve Product</h3><button type="button" className="icon-button h-9 w-9" onClick={onClose}><X size={16} /></button></div><div className="flex-1 space-y-4 overflow-auto p-5"><Field label="Final Decision *"><select className="field" value={form.decision} onChange={(event) => setForm({ ...form, decision: event.target.value as Decision })}><option value="approve">Approve for Production</option><option value="further-development">Require Further Development</option><option value="on-hold">Put On Hold</option></select></Field><Field label="Approval Date *"><input className="field" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></Field><Field label="Approved By *"><select className="field" value={form.approvedBy} onChange={(event) => setForm({ ...form, approvedBy: event.target.value })}><option>R&D Manager</option><option>QA Manager</option><option>Production Head</option></select></Field><Field label="Comments (Optional)"><textarea className="field min-h-28 resize-none" value={form.comments} onChange={(event) => setForm({ ...form, comments: event.target.value })} /></Field></div><div className="flex justify-end gap-3 border-t border-slate-200 p-5"><button type="button" className="secondary-button h-10 min-w-28 justify-center" onClick={onClose}>Cancel</button><button className="primary-button h-10 min-w-36 justify-center">Approve Product</button></div></form></div>;
}

function DocumentModal({ onClose, onUpload }: { onClose: () => void; onUpload: (file: File, description: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (file) onUpload(file, description); }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"><form className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl" onSubmit={submit}><div className="mb-4 flex items-center justify-between"><h3 className="text-xl font-bold">Add Final Document</h3><button type="button" className="icon-button h-9 w-9" onClick={onClose}><X size={16} /></button></div><label className="grid min-h-28 cursor-pointer place-items-center rounded-lg border border-dashed border-blue-300 text-center text-primary"><input className="hidden" type="file" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] || null)} /><span className="font-bold">{file ? file.name : 'Upload Document'}</span></label><div className="mt-4"><Field label="Description"><input className="field" value={description} onChange={(event) => setDescription(event.target.value)} /></Field></div><div className="mt-5 flex justify-end gap-3"><button type="button" className="secondary-button h-10" onClick={onClose}>Cancel</button><button className="primary-button h-10" disabled={!file}>Upload Document</button></div></form></div>;
}

function BlockerAlert({ blockers }: { blockers: Stage[] }) {
  if (!blockers.length) return <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"><p className="font-bold">All development stages completed</p><p className="text-sm">The product is ready for final review and approval.</p></section>;
  return <section className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-orange-800"><p className="font-bold">{blockers.length === 1 ? `${blockers[0].name} is still pending` : `${blockers.length} stages require completion`}</p><p className="mt-1 text-sm">These stages must be completed before the product can be approved for production.</p><div className="mt-3 grid gap-1 text-sm">{blockers.map((stage, index) => <Link key={stage.name} to={`../${stageRoutes[stage.name]}`} relative="path" className="font-semibold hover:text-primary">{stage.name} - {getDeadline(stage, index).label}</Link>)}</div></section>;
}

function TopCrumbs({ title, code }: { title: string; code: string }) { return <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link to="../overview" relative="path" className="icon-button h-10 w-10"><ChevronRight className="rotate-180" size={18} /></Link><h1 className="text-xl font-bold">{title}</h1></div><div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500"><Link to="/projects" className="hover:text-primary">Projects</Link><ChevronRight size={15} /><Link to="../overview" relative="path">{code}</Link><ChevronRight size={15} /><span className="font-bold text-ink">Final Stage</span></div></div>; }
function ProjectSummary({ currentStage, approved }: { currentStage: string; approved: boolean }) { const { project } = useProjectWorkspace(); return <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft"><div className="flex flex-wrap items-center gap-4"><div className="grid h-24 w-32 shrink-0 place-items-center rounded-lg bg-slate-100"><BeakerVisual /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">{project.name}</h2><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{approved ? 'Completed' : project.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Meta label="Product Code" value={project.productCode} /><Meta label="Category" value="Laboratory Glassware" /><Meta label="Current Stage" value={currentStage} /><Meta label="Priority" value={project.priority} pill /><Meta label="Target Date" value={formatDate(project.targetDate)} icon={<CalendarDays size={20} className="text-primary" />} /></div></div></div></section>; }
function StageBadge({ stage, overdue }: { stage: Stage; overdue: boolean }) { const cls = stage.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : overdue ? 'bg-rose-100 text-rose-700' : stage.status === 'In Progress' ? 'bg-blue-100 text-primary' : 'bg-orange-100 text-orange-700'; return <span className={`rounded-full px-3 py-1 text-xs font-bold ${cls}`}>{overdue && stage.status !== 'Completed' ? 'Overdue' : stage.status}</span>; }
function DocIcon({ fileName }: { fileName: string }) { const xls = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls'); return <span className={`grid h-8 w-8 place-items-center rounded-lg ${xls ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'}`}>{xls ? <FileSpreadsheet size={17} /> : <FileText size={17} />}</span>; }
function DeleteDialog({ document, onCancel, onDelete }: { document: FinalDocument; onCancel: () => void; onDelete: () => void }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4"><section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl"><h3 className="text-xl font-bold">Delete Document?</h3><p className="mt-2 text-slate-600">"{document.fileName}" will be removed.</p><div className="mt-5 flex justify-end gap-3"><button className="secondary-button h-10" onClick={onCancel}>Cancel</button><button className="primary-button h-10 bg-rose-600 hover:bg-rose-700" onClick={onDelete}>Delete</button></div></section></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-600">{label}</span>{children}</label>; }
function Meta({ label, value, pill, icon }: { label: string; value: string; pill?: boolean; icon?: ReactNode }) { return <div className="border-slate-200 xl:border-l xl:pl-6 first:xl:border-l-0 first:xl:pl-0"><p className="text-xs text-slate-500">{label}</p><div className="mt-1.5 flex items-center gap-2 font-bold">{icon}{pill ? <span className="rounded-full bg-rose-100 px-4 py-1.5 text-rose-600">{value}</span> : <span>{value}</span>}</div></div>; }
function readStored(key: string): FinalStageData { const fallback = { summary: defaultSummary, issues: defaultIssues, decision: 'approve' as Decision, documents: seedDocuments, approved: false, approvedBy: 'R&D Manager', approvedAt: new Date().toISOString().slice(0, 10), comments: '', lastSaved: new Date().toISOString() }; const saved = localStorage.getItem(key); if (!saved) return fallback; try { return { ...fallback, ...JSON.parse(saved) }; } catch { return fallback; } }
function getStageDate(_stage: Stage, index: number) { const base = new Date('2026-09-01T00:00:00'); base.setDate(base.getDate() + index * 2 + (index > 4 ? 3 : 0)); return base.toISOString(); }
function getDeadline(stage: Stage, index: number) { if (stage.status === 'Completed') return { label: '-', overdue: false, className: 'text-slate-500' }; const due = new Date(getStageDate(stage, index)); const today = new Date(); today.setHours(0, 0, 0, 0); due.setHours(0, 0, 0, 0); const days = Math.ceil((due.getTime() - today.getTime()) / 86400000); if (days < 0) return { label: `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`, overdue: true, className: 'text-rose-700' }; if (days === 0) return { label: 'Due today', overdue: false, className: 'text-orange-700' }; return { label: `${days} day${days === 1 ? '' : 's'} remaining`, overdue: false, className: days <= 3 ? 'text-orange-700' : 'text-emerald-700' }; }
function formatBytes(value: number) { if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`; return `${(value / (1024 * 1024)).toFixed(1)} MB`; }
function formatDate(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function formatDateTime(value: string) { return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function BeakerVisual() { return <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none"><path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" /><path d="M49 76h22M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" /><rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" /></svg>; }
