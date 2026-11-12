import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, FileImage, Plus, Trash2, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { deleteProjectAttachment, fetchProjectAttachments, uploadProjectAttachment, type ProjectAttachment } from '../../../services/attachmentService';
import {
  makePrototypeEntry,
  prototypeStatusOptions,
  readPrototyping,
  fetchPrototyping,
  savePrototyping,
  type PrototypeEntry
} from '../../../services/prototypingService';
import { resolveFileUrl } from '../../../utils/fileActions';
import { getMissingFields, showMissingFieldsToast } from '../../../utils/requiredFields';
import { useProjectWorkspace } from './context';

const stageName = 'Prototyping';
const acceptedImageTypes = 'image/jpeg,image/png,image/webp';

export function Prototyping() {
  const { project } = useProjectWorkspace();
  const { completeStage, canCompleteStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const initial = readPrototyping(project.productCode);
  const [entries, setEntries] = useState(initial.entries);
  const [lastSaved, setLastSaved] = useState(initial.lastSaved);
  const [saveState, setSaveState] = useState<'Saving...' | 'Saved'>('Saved');
  const [images, setImages] = useState<ProjectAttachment[]>([]);
  const [message, setMessage] = useState('');
  const didMount = useRef(false);
  const completion = canCompleteStage(stageName);

  useEffect(() => {
    let active = true;
    fetchPrototyping(project.productCode).then((saved) => {
      if (!active) return;
      setEntries(saved.entries);
      setLastSaved(saved.lastSaved);
      didMount.current = true;
    }).catch(() => undefined);
    return () => { active = false; };
  }, [project.productCode]);

  useEffect(() => {
    let active = true;
    fetchProjectAttachments(project.productCode, stageName)
      .then((attachments) => {
        if (active) setImages(attachments.filter((attachment) => attachment.mimeType?.startsWith('image/')));
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : 'Unable to load prototype images');
      });
    return () => {
      active = false;
    };
  }, [project.productCode]);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      void savePrototyping(project.productCode, { entries })
        .then((saved) => { setLastSaved(saved.lastSaved); setSaveState('Saved'); })
        .catch(() => setSaveState('Saving...'));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [entries, project.productCode]);

  const missingFields = useMemo(() => getMissingFields([
    { label: 'Prototype Entry', valid: entries.length > 0 },
    { label: 'Prototype Date', valid: entries.every((entry) => Boolean(entry.date)) },
    { label: 'Prototype Status', valid: entries.every((entry) => Boolean(entry.status)) },
    { label: completion.blockedBy ? `${completion.blockedBy} completed` : 'Previous stages completed', valid: completion.ok }
  ]), [completion.blockedBy, completion.ok, entries]);
  const canComplete = missingFields.length === 0 && saveState === 'Saved';

  function updateEntry(id: string, patch: Partial<PrototypeEntry>) {
    setEntries((current) => current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
  }

  function addEntry() { setEntries((current) => [makePrototypeEntry(), ...current]); }

  async function uploadImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []).filter((file) => acceptedImageTypes.split(',').includes(file.type));
    event.target.value = '';
    if (!files.length) {
      setMessage('Please upload JPG, PNG, or WebP images.');
      return;
    }
    try {
      for (const file of files) {
        const uploaded = await uploadProjectAttachment(project.productCode, stageName, file);
        setImages(current => [uploaded, ...current]);
      }
      setMessage(`${files.length} image(s) uploaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Image upload failed');
    }
  }

  async function deleteImage(imageId: string) {
    try {
      await deleteProjectAttachment(project.productCode, stageName, imageId);
      setImages((current) => current.filter((image) => image._id !== imageId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed');
    }
  }

  function handleCompleteStage() {
    const missing = [...missingFields, saveState !== 'Saved' ? 'Saved changes' : ''].filter(Boolean);
    if (showMissingFieldsToast(showToast, missing)) return;
    completeStage(stageName);
  }

  return (
    <div className="mx-auto min-w-0 max-w-full space-y-4 overflow-hidden text-sm 2xl:max-w-[1500px]">
      <TopCrumbs title={project.name} code={project.productCode} />
      <ProjectStageHeader project={project} currentStage={stageName} />
      <StageResponseBuilder projectCode={project.productCode} stageName={stageName} mode="controls" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Prototyping</h1>
            <p className="mt-1.5 text-sm text-slate-600">Capture first working sample details, images, issues, and approvals.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{saveState}</span>
        </div>
      </section>
      <StageResponseBuilder projectCode={project.productCode} stageName={stageName} mode="blocks" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Prototype Entries</h2><p className="text-sm text-slate-500">Record each prototype iteration with its date and outcome.</p></div><button className="primary-button h-10" onClick={addEntry}><Plus size={16} />Add Prototype Entry</button></div>
        <div className="space-y-4">{entries.map((entry, index) => <article key={entry.id} className="rounded-lg border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">Prototype Entry {entries.length - index}</h3><button className="text-sm font-semibold text-rose-600" onClick={() => setEntries((current) => current.filter((item) => item.id !== entry.id))}>Remove</button></div><div className="grid gap-3 md:grid-cols-2"><Field label="Date"><input className="field" type="date" value={entry.date} onChange={(event) => updateEntry(entry.id, { date: event.target.value })} /></Field><Field label="Status"><select className="field" value={entry.status} onChange={(event) => updateEntry(entry.id, { status: event.target.value as PrototypeEntry['status'] })}><option value="">Select status</option>{prototypeStatusOptions.map((option) => <option key={option}>{option}</option>)}</select></Field><TextAreaField label="Issue" value={entry.issue} onChange={(value) => updateEntry(entry.id, { issue: value })} /><TextAreaField label="Root Cause" value={entry.rootCause} onChange={(value) => updateEntry(entry.id, { rootCause: value })} /><TextAreaField label="Changes Made" value={entry.changesMade} onChange={(value) => updateEntry(entry.id, { changesMade: value })} /><TextAreaField label="Remarks" value={entry.remarks} onChange={(value) => updateEntry(entry.id, { remarks: value })} /></div></article>)}</div>
        {!entries.length ? <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No prototype entries yet.</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Prototype Images</h2>
            {message ? <p className="mt-1 text-sm font-semibold text-slate-600">{message}</p> : null}
          </div>
          <label className="secondary-button h-10 cursor-pointer">
            <UploadCloud size={16} />
            Upload Images
            <input className="sr-only" type="file" accept={acceptedImageTypes} multiple onChange={uploadImages} />
          </label>
        </div>

        {images.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {images.map((image) => (
              <div key={image._id} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <div className="grid aspect-video place-items-center bg-white">
                  {resolveFileUrl(image) ? (
                    <img className="h-full w-full object-cover" src={resolveFileUrl(image)} alt={image.name} />
                  ) : (
                    <FileImage className="text-slate-400" size={36} />
                  )}
                </div>
                <div className="flex items-center gap-2 p-3">
                  <p className="min-w-0 flex-1 truncate font-semibold" title={image.name}>{image.name}</p>
                  <button className="grid h-8 w-8 place-items-center rounded-md text-rose-600 hover:bg-rose-50" title="Delete image" onClick={() => deleteImage(image._id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            <FileImage className="mx-auto mb-3 text-slate-400" size={38} />
            No prototype images uploaded.
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>Last saved: {formatDateTime(lastSaved)}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            {saveState}
          </span>
        </div>
        <div className="text-right">
          {!canComplete ? <p className="mb-2 text-sm font-semibold text-amber-700">Fill required prototype fields and complete previous stages before completing this stage.</p> : null}
          <button className={`primary-button h-10 min-w-72 justify-center ${!canComplete ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`} aria-disabled={!canComplete} onClick={handleCompleteStage}>
            <Check size={18} />
            Mark Prototyping Complete
          </button>
        </div>
      </section>
    </div>
  );
}

function TopCrumbs({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link to="../overview" relative="path" className="icon-button h-10 w-10"><ChevronRight className="rotate-180" size={18} /></Link>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-primary">Projects</Link>
        <ChevronRight size={15} />
        <Link to="../overview" relative="path">{code}</Link>
        <ChevronRight size={15} />
        <span className="font-bold text-ink">{stageName}</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <label className="block">
        <span className="mb-2 block text-sm font-bold text-slate-600">{label}</span>
        <textarea className="field min-h-32 resize-y" value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </section>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
