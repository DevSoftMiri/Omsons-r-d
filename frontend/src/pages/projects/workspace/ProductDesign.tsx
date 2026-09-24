import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Filter,
  Info,
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

type DesignCategory = '3D Model' | 'Technical Drawing' | 'Rendering' | 'Concept' | 'Other';

type DesignFile = {
  id: string;
  title: string;
  fileName: string;
  category: DesignCategory;
  description: string;
  size: number;
  createdAt: string;
  mimeType: string;
  url: string;
};

type StoredDesignData = {
  designs: DesignFile[];
  notes: string;
  linked: string[];
  lastSaved: string;
};

const acceptedDesignTypes = '.pdf,.jpg,.jpeg,.png,.webp,.step,.stp,.stl,.obj';
const defaultNotes = 'Initial design based on standard 250ml beaker dimensions. Spout design reviewed with manufacturing team. Final 3D model pending approval.';
const projectAttachments = ['Material_Specification.pdf', 'Supplier_Quote.pdf', 'Requirement_Document.pdf', 'Benchmark_Reference.jpg'];

const seedDesigns: DesignFile[] = [
  { id: 'd1', title: 'Beaker 3D Model', fileName: 'Beaker_3D_Model.stp', category: '3D Model', description: 'Primary 3D model', size: 4.2 * 1024 * 1024, createdAt: '2026-09-12', mimeType: 'model/step', url: '' },
  { id: 'd2', title: 'Beaker Technical Drawing', fileName: 'Beaker_Technical_Drawing.pdf', category: 'Technical Drawing', description: 'Dimensioned drawing', size: 1.8 * 1024 * 1024, createdAt: '2026-09-10', mimeType: 'application/pdf', url: '' },
  { id: 'd3', title: 'Spout Detail', fileName: 'Spout_Detail.png', category: 'Rendering', description: 'Spout rendering detail', size: 650 * 1024, createdAt: '2026-09-08', mimeType: 'image/png', url: '' },
  { id: 'd4', title: 'Beaker Rendering', fileName: 'Beaker_Rendering.png', category: 'Rendering', description: 'Product rendering set', size: 2.4 * 1024 * 1024, createdAt: '2026-09-07', mimeType: 'image/png', url: '' },
  { id: 'd5', title: 'Design Concept', fileName: 'Design_Concept.jpg', category: 'Concept', description: 'Early design concept', size: 1.1 * 1024 * 1024, createdAt: '2026-09-06', mimeType: 'image/jpeg', url: '' },
  { id: 'd6', title: 'Beaker Wireframe', fileName: 'Beaker_Wireframe.png', category: '3D Model', description: 'Wireframe preview', size: 850 * 1024, createdAt: '2026-09-05', mimeType: 'image/png', url: '' },
  { id: 'd7', title: 'Exploded View', fileName: 'Exploded_View.pdf', category: 'Technical Drawing', description: 'Exploded drawing view', size: 950 * 1024, createdAt: '2026-09-05', mimeType: 'application/pdf', url: '' }
];

export function ProductDesign() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const storageKey = `product-design:${project.productCode}`;
  const initial = readStoredData(storageKey);
  const [designs, setDesigns] = useState(initial.designs);
  const [notes, setNotes] = useState(initial.notes);
  const [linked, setLinked] = useState(initial.linked);
  const [lastSaved, setLastSaved] = useState(initial.lastSaved);
  const [saveState, setSaveState] = useState<'Saving...' | 'Saved'>('Saved');
  const [activeCategory, setActiveCategory] = useState<'All Files' | DesignCategory>('All Files');
  const [query, setQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [preview, setPreview] = useState<DesignFile | null>(null);
  const [deleteFile, setDeleteFile] = useState<DesignFile | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);

  useEffect(() => {
    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      const timestamp = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ designs, notes, linked, lastSaved: timestamp }));
      setLastSaved(timestamp);
      setSaveState('Saved');
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [designs, linked, notes, storageKey]);

  const tabs = useMemo(() => {
    const counts = designs.reduce<Record<string, number>>((acc, design) => {
      acc[design.category] = (acc[design.category] || 0) + 1;
      return acc;
    }, {});
    return [{ category: 'All Files' as const, count: designs.length }, ...Object.entries(counts).map(([category, count]) => ({ category: category as DesignCategory, count }))];
  }, [designs]);

  const visibleDesigns = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return designs.filter((design) => {
      const categoryMatch = activeCategory === 'All Files' || design.category === activeCategory;
      const searchMatch = !normalized || [design.title, design.fileName, design.category, design.description].some((value) => value.toLowerCase().includes(normalized));
      return categoryMatch && searchMatch;
    });
  }, [activeCategory, designs, query]);

  const canComplete = designs.some((design) => design.category === 'Technical Drawing' || design.category === '3D Model');

  function addDesign(file: File, category: DesignCategory, title: string, description: string) {
    const design: DesignFile = {
      id: `design_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
      fileName: file.name,
      category,
      description: description.trim(),
      size: file.size,
      createdAt: new Date().toISOString(),
      mimeType: file.type || inferMime(file.name),
      url: URL.createObjectURL(file)
    };
    setDesigns((current) => [design, ...current]);
  }

  function removeDesign(id: string) {
    setDesigns((current) => current.filter((design) => design.id !== id));
    setDeleteFile(null);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-2.5 text-sm">
      <TopCrumbs title={project.name} code={project.productCode} />
      <ProjectStageHeader project={project} currentStage="Product Design" />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Product Design</h2>
          <p className="mt-1 max-w-4xl text-sm text-slate-600">Upload and manage design files such as 3D models, technical drawings, renderings and design concepts.</p>
        </div>
        <div className="flex gap-2">
          <button className="secondary-button h-9 gap-2"><Info size={15} />How to use</button>
          <button className="primary-button h-9" onClick={() => setShowUpload(true)}><Plus size={17} />Upload Design File</button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-soft">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.category}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${activeCategory === tab.category ? 'bg-blue-50 text-primary ring-1 ring-blue-200' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                onClick={() => setActiveCategory(tab.category)}
              >
                {pluralCategory(tab.category)} ({tab.count})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="relative block w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input className="field !pl-10" placeholder="Search files..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button className="secondary-button h-9 gap-2"><Filter size={15} />Filter</button>
          </div>
        </div>

        {designs.length ? (
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visibleDesigns.map((design) => (
              <DesignCard key={design.id} design={design} onDelete={() => setDeleteFile(design)} onPreview={() => setPreview(design)} />
            ))}
            <button className="grid min-h-[175px] place-items-center rounded-lg border border-dashed border-blue-300 bg-blue-50/30 p-3 text-center transition hover:bg-blue-50" onClick={() => setShowUpload(true)}>
              <div>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full border-2 border-primary text-primary"><Plus size={22} /></span>
                <p className="mt-2.5 font-bold text-primary">Upload Design File</p>
                <p className="mt-1.5 text-xs text-slate-500">PDF, JPG, PNG, WebP, STEP, STL etc.</p>
                <p className="text-xs text-slate-500">Max size: 25MB</p>
              </div>
            </button>
          </div>
        ) : (
          <EmptyState onUpload={() => setShowUpload(true)} />
        )}
      </section>

      <section className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-soft">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LinkIcon className="text-primary" size={18} />
              <div>
                <h3 className="font-bold">Linked Attachments</h3>
                <p className="text-xs text-slate-500">Link existing project attachments to avoid duplicate uploads.</p>
              </div>
            </div>
            <button className="text-sm font-bold text-primary" onClick={() => setShowLinkModal(true)}>View All</button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {linked.map((file) => (
              <div key={file} className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-600"><FileText size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{file}</p>
                  <p className="text-xs text-slate-500">Project attachment</p>
                </div>
                <button className="icon-button h-8 w-8 text-primary" onClick={() => setLinked((current) => current.filter((item) => item !== file))}><X size={15} /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-soft">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><FileText className="text-primary" size={18} /><h3 className="font-bold">Design Notes <span className="font-normal text-slate-500">(Optional)</span></h3></div>
            <span className="text-sm font-bold text-primary">Edit</span>
          </div>
          <textarea className="field min-h-16 resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-2.5 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>Last saved: {formatDateTime(lastSaved)}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{saveState}</span>
        </div>
        <div className="text-right">
          {!canComplete ? <p className="mb-2 text-sm font-semibold text-amber-700">Upload at least one technical drawing or 3D model to complete Product Design.</p> : null}
          <button className="primary-button h-9 min-w-56 justify-center disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!canComplete} onClick={() => completeStage('Product Design')}>
            <Check size={18} />
            Mark Product Design Complete
          </button>
        </div>
      </section>

      <input ref={uploadRef} className="hidden" type="file" accept={acceptedDesignTypes} />
      {showUpload ? <UploadModal onClose={() => setShowUpload(false)} onUpload={(file, category, title, description) => { addDesign(file, category, title, description); setShowUpload(false); }} /> : null}
      {preview ? <PreviewModal design={preview} onClose={() => setPreview(null)} /> : null}
      {deleteFile ? <DeleteDialog design={deleteFile} onCancel={() => setDeleteFile(null)} onDelete={() => removeDesign(deleteFile.id)} /> : null}
      {showLinkModal ? <LinkAttachmentModal linked={linked} onClose={() => setShowLinkModal(false)} onSave={(items) => { setLinked(items); setShowLinkModal(false); }} /> : null}
    </div>
  );
}

function DesignCard({ design, onPreview, onDelete }: { design: DesignFile; onPreview: () => void; onDelete: () => void }) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
      <button className="relative block h-32 w-full bg-slate-100 text-left" onClick={onPreview}>
        <span className={`absolute left-2.5 top-2.5 z-10 rounded-full px-2.5 py-1 text-[11px] font-bold ${categoryClass(design.category)}`}>{design.category}</span>
        <span className="absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-lg bg-white/90 text-slate-600"><MoreVertical size={15} /></span>
        <PreviewArt design={design} />
      </button>
      <div className="flex items-center justify-between gap-2.5 p-2.5">
        <div className="min-w-0">
          <p className="truncate font-bold">{design.fileName}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(design.createdAt)} - {formatBytes(design.size)}</p>
        </div>
        <div className="flex gap-2">
          <button className="icon-button h-8 w-8 text-primary" onClick={onPreview} title="Preview"><Eye size={14} /></button>
          <a className={`icon-button h-8 w-8 text-primary ${design.url ? '' : 'pointer-events-none opacity-50'}`} href={design.url || undefined} download={design.fileName} title="Download"><Download size={14} /></a>
          <button className="icon-button h-8 w-8 text-rose-600" onClick={onDelete} title="Delete"><Trash2 size={14} /></button>
        </div>
      </div>
    </article>
  );
}

function PreviewArt({ design }: { design: DesignFile }) {
  if (design.url && design.mimeType.startsWith('image/')) {
    return <img className="h-full w-full object-cover" src={design.url} alt={design.title} />;
  }
  if (design.mimeType === 'application/pdf') {
    return <div className="grid h-full place-items-center bg-white"><TechnicalDrawingArt /></div>;
  }
  if (design.category === '3D Model') {
    return <div className="grid h-full place-items-center bg-slate-100"><CadArt /></div>;
  }
  if (design.category === 'Rendering') {
    return <div className="grid h-full place-items-center bg-slate-100"><RenderingArt /></div>;
  }
  return <div className="grid h-full place-items-center bg-white"><ConceptArt /></div>;
}

function UploadModal({ onClose, onUpload }: { onClose: () => void; onUpload: (file: File, category: DesignCategory, title: string, description: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DesignCategory>('Technical Drawing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    onUpload(file, category, title, description);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <form className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-2xl" onSubmit={submit}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">Upload Design File</h3>
          <button type="button" className="icon-button h-9 w-9" onClick={onClose}><X size={16} /></button>
        </div>
        <label className="grid min-h-32 cursor-pointer place-items-center rounded-lg border border-dashed border-blue-300 bg-blue-50/40 p-4 text-center">
          <input className="hidden" type="file" accept={acceptedDesignTypes} onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <div>
            <Upload className="mx-auto text-primary" size={34} />
            <p className="mt-2 font-bold text-primary">{file ? file.name : 'Browse Design File'}</p>
            <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, WebP, STEP, STP, STL, OBJ</p>
          </div>
        </label>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Design Type *"><select className="field" value={category} onChange={(event) => setCategory(event.target.value as DesignCategory)}><option>Technical Drawing</option><option>3D Model</option><option>Rendering</option><option>Concept</option><option>Other</option></select></Field>
          <Field label="Optional title"><input className="field" value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
          <Field label="Optional description"><input className="field" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
          <Field label="Preview Image"><input className="field" type="file" accept="image/jpeg,image/png,image/webp" /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-button h-10" onClick={onClose}>Cancel</button>
          <button className="primary-button h-10" disabled={!file}>Upload Design</button>
        </div>
      </form>
    </div>
  );
}

function PreviewModal({ design, onClose }: { design: DesignFile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div><h3 className="text-lg font-bold">{design.title}</h3><p className="text-sm text-slate-500">{design.fileName}</p></div>
          <button className="icon-button h-9 w-9" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="grid min-h-[58vh] place-items-center bg-slate-100 p-4">
          {design.url && design.mimeType.startsWith('image/') ? <img className="max-h-[68vh] rounded-lg bg-white object-contain shadow-soft" src={design.url} alt={design.title} /> : <div className="grid h-[52vh] w-full place-items-center rounded-lg bg-white"><PreviewArt design={design} /></div>}
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${categoryClass(design.category)}`}>{design.category}</span>
          <a className={`primary-button h-10 ${design.url ? '' : 'pointer-events-none opacity-50'}`} href={design.url || undefined} download={design.fileName}><Download size={16} />Download</a>
        </div>
      </section>
    </div>
  );
}

function LinkAttachmentModal({ linked, onClose, onSave }: { linked: string[]; onClose: () => void; onSave: (items: string[]) => void }) {
  const [selected, setSelected] = useState(linked);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <section className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <h3 className="text-xl font-bold">Link Project Attachment</h3>
        <div className="mt-4 grid gap-2">
          {projectAttachments.map((file) => (
            <label key={file} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
              <input type="checkbox" checked={selected.includes(file)} onChange={() => setSelected((current) => current.includes(file) ? current.filter((item) => item !== file) : [...current, file])} />
              <span className="font-semibold">{file}</span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-3"><button className="secondary-button h-10" onClick={onClose}>Cancel</button><button className="primary-button h-10" onClick={() => onSave(selected)}>Link Selected</button></div>
      </section>
    </div>
  );
}

function DeleteDialog({ design, onCancel, onDelete }: { design: DesignFile; onCancel: () => void; onDelete: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h3 className="text-xl font-bold">Delete Design File?</h3>
        <p className="mt-2 text-slate-600">"{design.fileName}" will be permanently removed.</p>
        <div className="mt-5 flex justify-end gap-3"><button className="secondary-button h-10" onClick={onCancel}>Cancel</button><button className="primary-button h-10 bg-rose-600 hover:bg-rose-700" onClick={onDelete}>Delete</button></div>
      </section>
    </div>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return <div className="grid min-h-72 place-items-center text-center"><div><Upload className="mx-auto text-slate-400" size={52} /><h3 className="mt-4 text-xl font-bold">No design files uploaded yet.</h3><p className="mt-2 max-w-md text-slate-500">Upload drawings, product concepts, renderings, or 3D models for this product.</p><button className="primary-button mt-5" onClick={onUpload}><Plus size={18} />Upload First Design</button></div></div>;
}

function TopCrumbs({ title, code }: { title: string; code: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link to="../overview" relative="path" className="icon-button h-10 w-10" title="Back to overview"><ChevronRight className="rotate-180" size={18} /></Link><h1 className="text-xl font-bold">{title}</h1></div><div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500"><Link to="/projects" className="hover:text-primary">Projects</Link><ChevronRight size={15} /><Link to="../overview" relative="path" className="hover:text-primary">{code}</Link><ChevronRight size={15} /><span className="font-bold text-ink">Product Design</span></div></div>;
}

function ProjectSummary({ currentStage }: { currentStage: string }) {
  const { project } = useProjectWorkspace();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-soft">
      <div className="flex flex-wrap items-center gap-3.5">
        <div className="grid h-20 w-28 shrink-0 place-items-center rounded-lg bg-slate-100"><BeakerVisual /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{project.name}</h2><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{project.status}</span></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Meta label="Product Code" value={project.productCode} />
            <Meta label="Category" value="Laboratory Glassware" />
            <Meta label="Current Stage" value={currentStage} />
            <Meta label="Priority" value={project.priority} pill />
            <Meta label="Target Date" value={formatDate(project.targetDate)} icon={<CalendarDays size={20} className="text-primary" />} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Meta({ label, value, pill, icon }: { label: string; value: string; pill?: boolean; icon?: ReactNode }) {
  return <div className="border-slate-200 xl:border-l xl:pl-6 first:xl:border-l-0 first:xl:pl-0"><p className="text-xs text-slate-500">{label}</p><div className="mt-1.5 flex items-center gap-2 font-bold">{icon}{pill ? <span className="rounded-full bg-rose-100 px-4 py-1.5 text-rose-600">{value}</span> : <span>{value}</span>}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-600">{label}</span>{children}</label>;
}

function readStoredData(key: string): StoredDesignData {
  const fallback = { designs: seedDesigns, notes: defaultNotes, linked: ['Material_Specification.pdf', 'Supplier_Quote.pdf'], lastSaved: new Date().toISOString() };
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved) as Partial<StoredDesignData>;
    return {
      designs: Array.isArray(parsed.designs) ? parsed.designs : fallback.designs,
      notes: typeof parsed.notes === 'string' ? parsed.notes : fallback.notes,
      linked: Array.isArray(parsed.linked) ? parsed.linked : fallback.linked,
      lastSaved: typeof parsed.lastSaved === 'string' ? parsed.lastSaved : fallback.lastSaved
    };
  } catch {
    return fallback;
  }
}

function categoryClass(category: DesignCategory) {
  if (category === '3D Model') return 'bg-violet-100 text-violet-700';
  if (category === 'Technical Drawing') return 'bg-blue-100 text-primary';
  if (category === 'Rendering') return 'bg-rose-100 text-rose-600';
  if (category === 'Concept') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
}

function pluralCategory(category: 'All Files' | DesignCategory) {
  if (category === '3D Model') return '3D Models';
  if (category === 'Technical Drawing') return 'Technical Drawings';
  if (category === 'Rendering') return 'Renderings';
  if (category === 'Concept') return 'Concepts';
  return category;
}

function inferMime(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg'].includes(extension || '')) return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'application/octet-stream';
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

function TechnicalDrawingArt() {
  return <svg className="h-full w-full" viewBox="0 0 320 180" fill="none"><rect width="320" height="180" fill="#fff" /><path d="M68 24h72v120H68zM196 32a55 55 0 110 110 55 55 0 010-110z" stroke="#334155" strokeWidth="2" /><path d="M82 44h44M82 70h44M82 96h44M82 122h44M34 24h22M34 144h22M152 24h22M152 144h22M196 18v18M196 142v18M142 87h18M232 87h18" stroke="#94a3b8" strokeWidth="1.5" /><path d="M60 20h88M60 148h88M194 28h4M194 152h4" stroke="#cbd5e1" /></svg>;
}

function CadArt() {
  return <svg className="h-20 w-20" viewBox="0 0 120 120" fill="none"><path d="M25 36l35-20 35 20v42L60 100 25 78V36z" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" /><path d="M25 36l35 22 35-22M60 58v42" stroke="#64748b" strokeWidth="2" /><path d="M40 45l35-20M45 70l35-20M45 84l35-20" stroke="#94a3b8" /></svg>;
}

function RenderingArt() {
  return <svg className="h-full w-full" viewBox="0 0 320 180" fill="none"><rect width="320" height="180" fill="#f8fafc" /><path d="M40 112c42-62 121-82 236-58" stroke="#94a3b8" strokeWidth="9" strokeLinecap="round" /><path d="M52 111c45-45 112-60 206-42" stroke="#e2e8f0" strokeWidth="20" strokeLinecap="round" /><path d="M55 116c66-23 137-29 212-16" stroke="#64748b" strokeWidth="3" strokeLinecap="round" /></svg>;
}

function ConceptArt() {
  return <svg className="h-full w-full" viewBox="0 0 320 180" fill="none"><rect width="320" height="180" fill="#fff" /><path d="M45 130c25-80 75-80 95 0M155 130c25-80 75-80 95 0" stroke="#94a3b8" strokeWidth="2" /><path d="M54 120h74M164 120h74M70 65h44M180 65h44" stroke="#cbd5e1" /><path d="M62 45h70v92H62zM172 45h70v92h-70z" stroke="#64748b" strokeWidth="1.5" /></svg>;
}
