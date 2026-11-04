import { useEffect, useState } from 'react';
import { Check, ChevronRight, FileText, Trash2, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { deleteProjectAttachment, fetchProjectAttachments, uploadProjectAttachment, type ProjectAttachment } from '../../../services/attachmentService';
import { NO_FILE_AVAILABLE, openFile, resolveFileUrl } from '../../../utils/fileActions';
import { useProjectWorkspace } from './context';

const acceptedFileTypes = 'application/pdf,image/*,.csv,.txt,.doc,.docx,.xls,.xlsx';

export function ResearchData() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchProjectAttachments(project.productCode, 'Research Data')
      .then((items) => { if (active) setAttachments(items); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Unable to load research files.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [project.productCode]);

  async function uploadFile(file: File) {
    setUploading(true);
    setMessage('');
    try {
      const uploaded = await uploadProjectAttachment(project.productCode, 'Research Data', file, undefined, note);
      setAttachments((current) => [uploaded, ...current]);
      setNote('');
      showToast({ tone: 'success', title: 'Research file uploaded', message: note.trim() ? 'The file and note were saved.' : 'The file was saved.' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to upload research file.');
    } finally {
      setUploading(false);
    }
  }

  async function removeFile(attachment: ProjectAttachment) {
    try {
      await deleteProjectAttachment(project.productCode, 'Research Data', attachment._id);
      setAttachments((current) => current.filter((item) => item._id !== attachment._id));
      showToast({ tone: 'success', title: 'Research file removed' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to remove research file.');
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="../overview" relative="path" className="icon-button h-10 w-10" title="Back to overview"><ChevronRight className="rotate-180" size={18} /></Link>
          <h1 className="text-xl font-bold">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500"><Link to="/projects" className="hover:text-primary">Projects</Link><ChevronRight size={15} /><Link to="../overview" relative="path" className="hover:text-primary">{project.productCode}</Link><ChevronRight size={15} /><span className="font-bold text-ink">Research Data</span></div>
      </div>

      <ProjectStageHeader project={project} currentStage="Research Data" />
      <StageResponseBuilder projectCode={project.productCode} stageName="Research Data" mode="controls" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="text-2xl font-bold">Research Data</h2>
        <p className="mt-1.5 text-slate-600">Upload research files and add a note describing the source, findings, or relevance of each file.</p>
        {message ? <p className="mt-2 font-semibold text-rose-600">{message}</p> : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/30 p-4 text-center hover:bg-blue-50">
            <UploadCloud className="text-primary" size={30} />
            <span className="mt-2 font-bold text-primary">{uploading ? 'Uploading...' : 'Choose a research file'}</span>
            <span className="mt-1 text-xs text-slate-500">PDF, images, documents, spreadsheets, CSV, or text files</span>
            <input className="sr-only" type="file" accept={acceptedFileTypes} disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadFile(file); event.target.value = ''; }} />
          </label>
          <label className="grid gap-1.5 font-semibold text-slate-700"><span>Note for this file</span><textarea className="field min-h-28 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add source, findings, or context..." /></label>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <h3 className="text-lg font-bold">Uploaded Research Files ({attachments.length})</h3>
        {loading ? <p className="mt-4 text-slate-500">Loading research files...</p> : null}
        {!loading && !attachments.length ? <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">No research files uploaded yet.</p> : null}
        <div className="mt-3 grid gap-3">{attachments.map((attachment) => {
          const url = resolveFileUrl(attachment);
          return <article key={attachment._id} className="flex flex-wrap items-start gap-3 rounded-lg border border-slate-200 p-3">
            <FileText className="mt-0.5 shrink-0 text-primary" size={22} />
            <div className="min-w-0 flex-1"><button className="truncate text-left font-bold text-primary hover:underline disabled:text-slate-500" disabled={!url} title={url ? 'Open file' : NO_FILE_AVAILABLE} onClick={() => openFile(attachment)}>{attachment.name}</button><p className="mt-1 text-xs text-slate-500">{attachment.createdAt ? new Date(attachment.createdAt).toLocaleString('en-IN') : 'Uploaded file'}</p>{attachment.note ? <p className="mt-2 rounded-md bg-slate-50 p-2 text-sm text-slate-600"><span className="font-bold">Note:</span> {attachment.note}</p> : <p className="mt-2 text-xs italic text-slate-400">No note added</p>}</div>
            <button className="icon-button h-9 w-9 text-rose-600" title="Remove file" onClick={() => void removeFile(attachment)}><Trash2 size={16} /></button>
          </article>;
        })}</div>
      </section>

      <section className="flex justify-end rounded-lg border border-slate-200 bg-white p-3 shadow-soft"><button className="primary-button h-10" onClick={() => completeStage('Research Data')}><Check size={18} />Mark Research Data Complete</button></section>
      <StageResponseBuilder projectCode={project.productCode} stageName="Research Data" mode="blocks" />
    </div>
  );
}
