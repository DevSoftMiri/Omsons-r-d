import type { ChangeEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileImage,
  FileText,
  Info,
  Pencil,
  MoreVertical,
  Plus,
  Save,
  Trash2,
  Upload,
  XCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import type { Project } from '../../../types';
import { downloadFile, openFile, resolveFileUrl, NO_FILE_AVAILABLE } from '../../../utils/fileActions';
import { showMissingFieldsToast } from '../../../utils/requiredFields';
import {
  addPrerequisiteDocument,
  deletePrerequisiteDocument,
  deletePrerequisite,
  fetchPrerequisites,
  reviewPrerequisite,
  type PrerequisiteDocument,
  type PrerequisitePayload,
  type PrerequisiteStatus,
  updatePrerequisiteDocument,
  uploadPrerequisite
} from '../../../services/prerequisiteService';
import { useProjectWorkspace } from './context';

const requiredDocuments = [
  {
    type: 'ISO Certificate',
    description: 'ISO certification for manufacturing facility.'
  },
  {
    type: 'Calibration Certificate',
    description: 'Calibration certificate for measuring equipment used in the lab.'
  },
  {
    type: 'Material Test Report',
    description: 'Material composition and test report from supplier.'
  },
  {
    type: 'Requirement Document',
    description: 'Detailed product requirements document.'
  },
  {
    type: 'Drawing Approval',
    description: 'Approved technical drawings from design team.'
  }
];

const acceptedFileTypes = 'application/pdf,image/jpeg,image/png,image/webp';

export function Prerequisites() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const [payload, setPayload] = useState<PrerequisitePayload>(() => buildLocalPayload());
  const [newDocumentName, setNewDocumentName] = useState('');
  const [editingType, setEditingType] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const documents = payload.documents;
  const uploadedCount = documents.filter((document) => document.status !== 'Missing').length;
  const canComplete = uploadedCount === documents.length;

  useEffect(() => {
    refreshPrerequisites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.productCode]);

  async function refreshPrerequisites() {
    setLoading(true);
    try {
      const data = await fetchPrerequisites(project.productCode);
      setPayload(data);
      setMessage('');
    } catch (error) {
      setPayload(buildLocalPayload());
      setMessage(error instanceof Error ? error.message : 'Unable to load prerequisite documents');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(type: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusyType(type);
    try {
      await uploadPrerequisite(project.productCode, type, file);
      await refreshPrerequisites();
      setMessage(`${type} uploaded successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setBusyType(null);
      event.target.value = '';
    }
  }

  async function handleReview(document: PrerequisiteDocument, status: 'Approved' | 'Rejected') {
    if (!document.certificate?._id) return;
    setBusyType(document.type);
    try {
      await reviewPrerequisite(project.productCode, document.certificate._id, status);
      await refreshPrerequisites();
      setMessage(`${document.type} marked ${status.toLowerCase()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review failed');
    } finally {
      setBusyType(null);
    }
  }

  async function handleDelete(document: PrerequisiteDocument) {
    if (!document.certificate?._id) return;
    setBusyType(document.type);
    try {
      await deletePrerequisite(project.productCode, document.certificate._id);
      await refreshPrerequisites();
      setMessage(`${document.type} removed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setBusyType(null);
    }
  }

  async function handleAddDocument() {
    const type = newDocumentName.trim();
    if (showMissingFieldsToast(showToast, type ? [] : ['Document Name'])) return;
    const exists = documents.some((document) => document.type.toLowerCase() === type.toLowerCase());
    if (exists) {
      setMessage('A document with this name already exists.');
      return;
    }
    setBusyType(type);
    try {
      setPayload(await addPrerequisiteDocument(project.productCode, type));
      setNewDocumentName('');
      setMessage(`${type} added to the prerequisite checklist.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add prerequisite document');
    } finally {
      setBusyType(null);
    }
  }

  function startEditDocument(document: PrerequisiteDocument) {
    setEditingType(document.type);
    setEditingName(document.type);
  }

  async function saveDocumentName(document: PrerequisiteDocument) {
    const nextType = editingName.trim();
    if (showMissingFieldsToast(showToast, nextType ? [] : ['Document Name'])) return;
    if (nextType === document.type) {
      setEditingType(null);
      return;
    }
    setBusyType(document.type);
    try {
      setPayload(await updatePrerequisiteDocument(project.productCode, document.type, nextType));
      setEditingType(null);
      setEditingName('');
      setMessage(`${document.type} renamed to ${nextType}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to rename prerequisite document');
    } finally {
      setBusyType(null);
    }
  }

  async function handleDeleteDocument(document: PrerequisiteDocument) {
    setBusyType(document.type);
    try {
      await deletePrerequisiteDocument(project.productCode, document.type);
      await refreshPrerequisites();
      setMessage(`${document.type} deleted from the prerequisite checklist.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete prerequisite document');
    } finally {
      setBusyType(null);
    }
  }

  function handleCompleteStage() {
    const missingDocuments = documents.filter((document) => document.required && document.status === 'Missing').map((document) => document.type);
    if (showMissingFieldsToast(showToast, missingDocuments.length ? [`Required documents (${missingDocuments.join(', ')})`] : [])) return;
    completeStage('Prerequisites');
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4 text-[15px]">
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-primary">Projects</Link>
        <ChevronRight size={15} />
        <Link to="../overview" relative="path" className="hover:text-primary">{project.productCode}</Link>
        <ChevronRight size={15} />
        <span className="font-bold text-ink">Prerequisites</span>
      </div>

      <ProjectStageHeader project={project} currentStage="Prerequisites" />

      <section>
        <h2 className="text-2xl font-bold tracking-normal">Prerequisites</h2>
        <p className="mt-1.5 text-sm text-slate-600">Upload the required R&D starting documents for this product.</p>
        {message ? <p className="mt-2 text-sm font-semibold text-amber-700">{message}</p> : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold">Required Documents</h3>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              <input
                className="field h-10 w-64"
                placeholder="Document name"
                value={newDocumentName}
                onChange={(event) => setNewDocumentName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleAddDocument();
                  }
                }}
              />
              <button className="primary-button h-10" onClick={handleAddDocument}>
                <Plus size={17} />
                Add Document
              </button>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span>PDF, JPG, PNG, WebP</span>
              <span className="h-5 w-px bg-slate-300" />
              <span>Max: 10MB</span>
              <Info size={18} className="text-primary" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-y-2 text-left">
            <thead>
              <tr className="text-sm text-slate-500">
                <th className="rounded-l-lg bg-slate-50 px-4 py-3 font-bold">#</th>
                <th className="bg-slate-50 px-4 py-3 font-bold">Document Name</th>
                <th className="bg-slate-50 px-4 py-3 font-bold">Description</th>
                <th className="bg-slate-50 px-4 py-3 font-bold">Status</th>
                <th className="bg-slate-50 px-4 py-3 font-bold">File</th>
                <th className="rounded-r-lg bg-slate-50 px-4 py-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document, index) => {
                const definition = requiredDocuments.find((item) => item.type === document.type);
                return (
                  <DocumentRow
                    key={document.type}
                    busy={busyType === document.type}
                    description={definition?.description || ''}
                    document={document}
                    editing={editingType === document.type}
                    editingName={editingName}
                    index={index}
                    loading={loading}
                    onCancelEdit={() => { setEditingType(null); setEditingName(''); }}
                    onDelete={() => handleDelete(document)}
                    onDeleteDocument={() => handleDeleteDocument(document)}
                    onEdit={() => startEditDocument(document)}
                    onEditingNameChange={setEditingName}
                    onReview={(status) => handleReview(document, status)}
                    onSaveEdit={() => saveDocumentName(document)}
                    onUpload={(event) => handleUpload(document.type, event)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={32} />
            </span>
            <div>
              <h3 className="text-base font-bold">{uploadedCount} of {documents.length} documents uploaded</h3>
              <p className="mt-1 text-sm text-slate-600">
                Upload all required documents to enable stage completion.
              </p>
            </div>
          </div>
          <div className="text-center">
            <button
              aria-disabled={!canComplete}
              onClick={handleCompleteStage}
              className={`primary-button min-w-72 justify-center ${!canComplete ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`}
            >
              <Check size={18} />
              Mark Prerequisites Complete
            </button>
            <p className="mt-2 text-sm text-slate-500">This will move the project to the next stage.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ProductSummary({ project }: { project: Project }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <div className="flex items-center gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center rounded-lg bg-slate-100">
          <BeakerVisual />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary">{project.productCode}</p>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold">{project.name}</h3>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-bold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              {project.status}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-700">Category: <span className="font-bold">Laboratory Glassware</span></p>
          <p className="mt-1.5 text-sm text-slate-700">Current Stage: <span className="font-bold">Prerequisites</span></p>
        </div>
      </div>
    </section>
  );
}

function DocumentRow({
  document,
  description,
  index,
  loading,
  busy,
  editing,
  editingName,
  onUpload,
  onReview,
  onDelete,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onEditingNameChange,
  onDeleteDocument
}: {
  document: PrerequisiteDocument;
  description: string;
  index: number;
  loading: boolean;
  busy: boolean;
  editing: boolean;
  editingName: string;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onReview: (status: 'Approved' | 'Rejected') => void;
  onDelete: () => void;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditingNameChange: (value: string) => void;
  onDeleteDocument: () => void;
}) {
  const fileUrl = resolveFileUrl(document.certificate);
  const isImage = document.certificate?.mimeType?.startsWith('image/');
  const inputId = `prerequisite-${document.type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <tr className="align-middle">
      <td className="rounded-l-lg border-y border-l border-slate-200 bg-white px-4 py-3 text-center font-semibold">{index + 1}</td>
      <td className="border-y border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="h-10 w-px bg-slate-200" />
          <div>
            <div className="flex items-center gap-3">
              {editing ? (
                <input
                  className="field h-9 min-w-60"
                  value={editingName}
                  onChange={(event) => onEditingNameChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSaveEdit();
                    if (event.key === 'Escape') onCancelEdit();
                  }}
                />
              ) : <p className="font-bold">{document.type}</p>}
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">Required</span>
            </div>
          </div>
        </div>
      </td>
      <td className="max-w-xs border-y border-slate-200 bg-white px-4 py-3 text-sm leading-5 text-slate-600">{description}</td>
      <td className="border-y border-slate-200 bg-white px-4 py-3">
        <StatusBadge status={document.status} />
      </td>
      <td className="border-y border-slate-200 bg-white px-4 py-3">
        {document.certificate ? (
          <div className="flex items-center gap-3">
            <span className={`grid h-9 w-8 place-items-center rounded-md text-white ${isImage ? 'bg-blue-500' : 'bg-rose-500'}`}>
              {isImage ? <FileImage size={18} /> : <FileText size={18} />}
            </span>
            <div>
              <button
                className={`text-left font-semibold ${fileUrl ? 'hover:text-primary' : 'cursor-not-allowed text-slate-500'}`}
                disabled={!fileUrl}
                title={fileUrl ? 'Open file' : NO_FILE_AVAILABLE}
                onClick={() => openFile(document.certificate)}
              >
                {document.certificate.fileName}
              </button>
              <p className="text-sm text-slate-500">{formatBytes(document.certificate.fileSize)} - {formatDate(document.certificate.updatedAt)}</p>
            </div>
          </div>
        ) : (
          <span className="text-lg text-slate-500">-</span>
        )}
      </td>
      <td className="rounded-r-lg border-y border-r border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <button className="secondary-button min-w-24 justify-center text-primary" disabled={busy} onClick={onSaveEdit}>
                <Save size={16} />
                Save
              </button>
              <button className="icon-button h-10 w-10" disabled={busy} title="Cancel" onClick={onCancelEdit}>
                <XCircle size={17} />
              </button>
            </>
          ) : (
            <>
          <input id={inputId} className="sr-only" type="file" accept={acceptedFileTypes} disabled={busy || loading} onChange={onUpload} />
          {fileUrl ? (
            <button className="secondary-button min-w-28 justify-center text-primary" onClick={() => openFile(document.certificate)}>
              <Eye size={17} />
              View
            </button>
          ) : (
            document.certificate ? (
              <button className="secondary-button min-w-28 cursor-not-allowed justify-center opacity-60" disabled title={NO_FILE_AVAILABLE}>
                <Eye size={17} />
                No file
              </button>
            ) : (
              <label className={`secondary-button min-w-28 justify-center text-primary ${busy || loading ? 'pointer-events-none cursor-not-allowed opacity-60' : 'cursor-pointer'}`} htmlFor={inputId}>
                <Upload size={17} />
                Upload
              </label>
            )
          )}
          {document.certificate ? (
            <div className="group relative">
              <button className="icon-button h-10 w-10" title="More actions">
                <MoreVertical size={18} />
              </button>
              <div className="invisible absolute right-0 top-11 z-20 w-44 rounded-lg border border-slate-200 bg-white p-2 opacity-0 shadow-soft transition group-hover:visible group-hover:opacity-100">
                <label className={`menu-action ${busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`} htmlFor={inputId}>
                  <Upload size={15} />
                  Replace
                </label>
                <button className="menu-action" disabled={busy} onClick={() => onReview('Approved')}>
                  <CheckCircle2 size={15} />
                  Approve
                </button>
                <button className="menu-action" disabled={busy} onClick={() => onReview('Rejected')}>
                  <XCircle size={15} />
                  Reject
                </button>
                <button className="menu-action disabled:cursor-not-allowed disabled:opacity-50" disabled={!fileUrl} title={fileUrl ? 'Download' : NO_FILE_AVAILABLE} onClick={() => downloadFile(document.certificate, document.certificate?.fileName)}>
                  <Download size={15} />
                  Download
                </button>
                <button className="menu-action text-rose-600" disabled={busy} onClick={onDelete}>
                  <Trash2 size={15} />
                  Delete File
                </button>
              </div>
            </div>
          ) : null}
          <button className="icon-button h-10 w-10" disabled={busy || loading} title="Rename prerequisite" onClick={onEdit}>
            <Pencil size={16} />
          </button>
          <button className="icon-button h-10 w-10 text-rose-600" disabled={busy || loading} title="Delete prerequisite" onClick={onDeleteDocument}>
            <Trash2 size={16} />
          </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: PrerequisiteStatus }) {
  const config: Record<PrerequisiteStatus, { label: string; className: string; icon: ReactNode }> = {
    Missing: {
      label: 'Missing',
      className: 'bg-rose-100 text-rose-700',
      icon: <AlertCircle size={17} />
    },
    Uploaded: {
      label: 'Pending Review',
      className: 'bg-amber-100 text-amber-700',
      icon: <AlertCircle size={17} />
    },
    Approved: {
      label: 'Approved',
      className: 'bg-emerald-100 text-emerald-700',
      icon: <CheckCircle2 size={17} />
    },
    Rejected: {
      label: 'Rejected',
      className: 'bg-rose-100 text-rose-700',
      icon: <XCircle size={17} />
    }
  };

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${config[status].className}`}>
      {config[status].icon}
      {config[status].label}
    </span>
  );
}

export function StagePanel({ title, action, onAction, children }: { title: string; action: string; onAction: () => void; children: ReactNode }) {
  return (
    <section className="panel">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <button className="primary-button" onClick={onAction}>{action}</button>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function buildLocalPayload(): PrerequisitePayload {
  return {
    documents: requiredDocuments.map((document) => ({
      type: document.type,
      required: true,
      status: 'Missing',
      certificate: null
    })),
    summary: {
      required: requiredDocuments.length,
      uploaded: 0,
      approved: 0,
      missing: requiredDocuments.length
    }
  };
}

function BeakerVisual() {
  return (
    <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none">
      <path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" />
      <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M45 82c8 5 22 5 30 0" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <path d="M49 76h22" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 64h21M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" />
    </svg>
  );
}

function formatBytes(value?: number) {
  if (!value) return '0 KB';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string) {
  if (!value) return 'Just now';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
