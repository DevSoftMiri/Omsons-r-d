import type { ChangeEvent, DragEvent, ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  Eye,
  FileImage,
  FileText,
  Info,
  MoreVertical,
  Search,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { useProjectWorkspace } from './context';

type AttachmentFile = {
  id: string;
  name: string;
  description: string;
  type: string;
  size: number;
  uploadedOn: string;
  uploadedBy: string;
  initials: string;
  url: string;
  mimeType: string;
};

const acceptedFileTypes = 'application/pdf,image/jpeg,image/png,image/webp';

const seedFiles: AttachmentFile[] = [];

export function Attachments() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState(seedFiles);
  const [query, setQuery] = useState('');
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [previewFile, setPreviewFile] = useState<AttachmentFile | null>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState('');

  const visibleFiles = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return files
      .filter((file) => !normalized || [file.name, file.description, file.type, file.uploadedBy].some((value) => value.toLowerCase().includes(normalized)))
      .sort((left, right) => {
        const diff = new Date(left.uploadedOn).getTime() - new Date(right.uploadedOn).getTime();
        return sortNewestFirst ? -diff : diff;
      });
  }, [files, query, sortNewestFirst]);

  function addFiles(selectedFiles: FileList | File[]) {
    const nextFiles = Array.from(selectedFiles)
      .filter((file) => acceptedFileTypes.split(',').includes(file.type))
      .map((file) => ({
        id: `local_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: file.name,
        description: 'Uploaded project attachment',
        type: getFileType(file),
        size: file.size,
        uploadedOn: new Date().toISOString(),
        uploadedBy: 'Current User',
        initials: 'CU',
        url: URL.createObjectURL(file),
        mimeType: file.type
      }));

    if (!nextFiles.length) {
      setMessage('Please upload PDF, JPG, PNG, or WebP files.');
      return;
    }

    setFiles((current) => [...nextFiles, ...current]);
    setMessage(`${nextFiles.length} file${nextFiles.length > 1 ? 's' : ''} uploaded.`);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) addFiles(event.target.files);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  }

  function deleteFile(fileId: string) {
    setFiles((current) => current.filter((file) => file.id !== fileId));
    if (previewFile?.id === fileId) setPreviewFile(null);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="../overview" relative="path" className="icon-button h-10 w-10" title="Back to overview">
            <ChevronRight className="rotate-180" size={18} />
          </Link>
          <h1 className="text-xl font-bold">{project.name}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
          <Link to="/projects" className="hover:text-primary">Projects</Link>
          <ChevronRight size={15} />
          <Link to="../overview" relative="path" className="hover:text-primary">{project.productCode}</Link>
          <ChevronRight size={15} />
          <span className="font-bold text-ink">Attachments</span>
        </div>
      </div>

      <ProjectStageHeader project={project} currentStage="Attachments" />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Attachments</h2>
          <p className="mt-1.5 max-w-4xl text-sm text-slate-600">
            Upload and manage project-related files such as drawings, designs, specifications, test reports, and other documents.
          </p>
          {message ? <p className="mt-2 text-sm font-semibold text-emerald-700">{message}</p> : null}
        </div>
        <button
          className="primary-button h-10 min-w-60 justify-center"
          onClick={() => completeStage('Attachments')}
        >
          <Check size={18} />
          Mark Attachments Complete
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div
            className={`grid min-h-32 place-items-center rounded-lg border-2 border-dashed p-4 text-center transition ${dragging ? 'border-primary bg-blue-50' : 'border-blue-300 bg-white'}`}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDrop={handleDrop}
          >
            <div>
              <UploadCloud className="mx-auto text-primary" size={36} />
              <p className="mt-3 font-semibold">
                Drag and drop files here, or{' '}
                <button className="font-bold text-primary" onClick={() => inputRef.current?.click()}>
                  click to upload
                </button>
              </p>
              <p className="mt-1.5 text-xs text-slate-500">Supported formats: PDF, JPG, PNG, WebP | Max file size: 10MB per file</p>
              <input ref={inputRef} className="hidden" type="file" accept={acceptedFileTypes} multiple onChange={handleInputChange} />
            </div>
          </div>
          <div className="border-slate-200 lg:border-l lg:pl-5">
            <div className="mb-3 flex items-center gap-3">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white">
                <Info size={15} />
              </span>
              <h3 className="font-bold">Upload Guidelines</h3>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600">
              {['You can upload PDF, JPG, PNG, and WebP files.', 'Maximum file size is 10MB per file.', 'Use clear and descriptive file names.', 'These files will be stored with this project only.'].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">Uploaded Files ({visibleFiles.length})</h3>
          <div className="flex flex-wrap gap-3">
            <label className="relative block w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input className="field pl-10" placeholder="Search files..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <button className="secondary-button h-10 gap-2" onClick={() => setSortNewestFirst((current) => !current)}>
              <ChevronRight className={sortNewestFirst ? 'rotate-90' : '-rotate-90'} size={17} />
              Sort
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-sm text-slate-500">
                <th className="px-3 py-2.5 font-bold">File Name</th>
                <th className="px-3 py-2.5 font-bold">Type</th>
                <th className="px-3 py-2.5 font-bold">Size</th>
                <th className="px-3 py-2.5 font-bold">Uploaded On</th>
                <th className="px-3 py-2.5 font-bold">Uploaded By</th>
                <th className="px-3 py-2.5 text-center font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleFiles.map((file) => (
                <tr key={file.id} className="border-b border-slate-200">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <FileTile file={file} />
                      <div>
                        <p className="font-bold">{file.name}</p>
                        <p className="text-xs text-slate-500">{file.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${file.type === 'PDF' ? 'bg-rose-100 text-rose-600' : file.type === 'WebP' ? 'bg-violet-100 text-violet-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {file.type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium">{formatBytes(file.size)}</td>
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{formatDate(file.uploadedOn)}</p>
                    <p className="text-xs text-slate-500">{formatTime(file.uploadedOn)}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-100 text-xs font-bold text-primary">{file.initials}</span>
                      <span>{file.uploadedBy}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-center gap-2">
                      <button className="icon-button h-9 w-10 text-primary" title="View file" onClick={() => setPreviewFile(file)}>
                        <Eye size={18} />
                      </button>
                      <a className={`icon-button h-9 w-10 text-primary ${file.url ? '' : 'pointer-events-none opacity-40'}`} href={file.url || undefined} download={file.name} title="Download file">
                        <Download size={18} />
                      </a>
                      <div className="group relative">
                        <button className="icon-button h-9 w-10" title="More actions">
                          <MoreVertical size={18} />
                        </button>
                        <div className="invisible absolute right-0 top-11 z-20 w-36 rounded-lg border border-slate-200 bg-white p-2 opacity-0 shadow-soft transition group-hover:visible group-hover:opacity-100">
                          <button className="menu-action text-rose-600" onClick={() => deleteFile(file.id)}>
                            <Trash2 size={15} />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {previewFile ? <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} /> : null}
    </div>
  );
}

function Meta({ label, value, pill, icon }: { label: string; value: string; pill?: boolean; icon?: ReactNode }) {
  return (
    <div className="border-slate-200 xl:border-l xl:pl-6 first:xl:border-l-0 first:xl:pl-0">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1.5 flex items-center gap-2 font-bold">
        {icon}
        {pill ? <span className="rounded-full bg-rose-100 px-4 py-1.5 text-rose-600">{value}</span> : <span>{value}</span>}
      </div>
    </div>
  );
}

function FileTile({ file }: { file: AttachmentFile }) {
  const isImage = file.mimeType.startsWith('image/');
  return (
    <span className={`grid h-10 w-12 shrink-0 place-items-center rounded-lg ${isImage ? 'bg-slate-100 text-slate-500' : 'bg-rose-100 text-rose-600'}`}>
      {isImage ? <FileImage size={20} /> : <FileText size={20} />}
    </span>
  );
}

function PreviewModal({ file, onClose }: { file: AttachmentFile; onClose: () => void }) {
  const canPreview = Boolean(file.url);
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">{file.name}</h3>
            <p className="text-sm text-slate-500">{file.description}</p>
          </div>
          <button className="icon-button h-10 w-10" onClick={onClose} title="Close preview">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-[55vh] overflow-auto bg-slate-100 p-4">
          {canPreview && isImage ? (
            <img className="mx-auto max-h-[70vh] rounded-lg bg-white object-contain shadow-soft" src={file.url} alt={file.name} />
          ) : canPreview && isPdf ? (
            <iframe className="h-[70vh] w-full rounded-lg bg-white" src={file.url} title={file.name} />
          ) : (
            <div className="grid min-h-[55vh] place-items-center rounded-lg border border-slate-200 bg-white text-center">
              <div>
                <FileText className="mx-auto text-slate-400" size={56} />
                <p className="mt-4 font-bold">Preview available after upload</p>
                <p className="mt-1 text-sm text-slate-500">Seeded sample files show metadata only. Uploaded files open here.</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BeakerVisual() {
  return (
    <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none">
      <path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" />
      <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M49 76h22M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" />
    </svg>
  );
}

function getFileType(file: File) {
  if (file.type === 'application/pdf') return 'PDF';
  const extension = file.name.split('.').pop();
  return extension ? extension.toUpperCase() : 'FILE';
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTargetDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
