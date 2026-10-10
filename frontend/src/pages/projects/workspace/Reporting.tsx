import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Check, ChevronRight, FileText, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { getMissingFields, showMissingFieldsToast } from '../../../utils/requiredFields';
import { useProjectWorkspace } from './context';

type ReportEntry = {
  id: string;
  date: string;
  workDone: string;
  hours: number;
  submittedBy: string;
  status: 'Submitted' | 'Approved' | 'Rejected';
};

const emptyReport = {
  date: new Date().toISOString().slice(0, 10),
  workDone: '',
  hours: 1,
  submittedBy: 'Current User',
  status: 'Submitted' as const
};

export function Reporting() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const storageKey = `reporting:${project.productCode}`;
  const [reports, setReports] = useState<ReportEntry[]>(() => readReports(storageKey));
  const [form, setForm] = useState(emptyReport);
  const [message, setMessage] = useState('');

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(reports));
  }, [reports, storageKey]);

  function submitReport(event: FormEvent) {
    event.preventDefault();
    const missing = getMissingFields([
      { label: 'Date', value: form.date },
      { label: 'Work Done', value: form.workDone },
      { label: 'Hours', valid: Number.isFinite(form.hours) && form.hours > 0 },
      { label: 'Submitted By', value: form.submittedBy }
    ]);
    if (showMissingFieldsToast(showToast, missing)) {
      setMessage('Add work done before saving the report.');
      return;
    }

    setReports((current) => [
      { ...form, id: `report_${Date.now()}`, workDone: form.workDone.trim() },
      ...current
    ]);
    setForm(emptyReport);
    setMessage('Report saved.');
  }

  function handleCompleteStage() {
    if (showMissingFieldsToast(showToast, reports.length ? [] : ['At least one report'])) return;
    completeStage('Reporting');
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
          <span className="font-bold text-ink">Reporting</span>
        </div>
      </div>

      <ProjectStageHeader project={project} currentStage="Reporting" />
      <StageResponseBuilder projectCode={project.productCode} stageName="Reporting" mode="controls" />

      <section>
        <h2 className="text-2xl font-bold">Reporting</h2>
        <p className="mt-1.5 text-sm text-slate-600">Record daily work updates, hours, and submission status for this project.</p>
        {message ? <p className="mt-2 text-sm font-semibold text-primary">{message}</p> : null}
      </section>
      <StageResponseBuilder projectCode={project.productCode} stageName="Reporting" mode="blocks" />

      <section className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft" onSubmit={submitReport}>
          <div className="mb-3 flex items-center gap-2">
            <Plus className="text-primary" size={18} />
            <h3 className="font-bold">Add Report</h3>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-600">Date</span>
            <input className="field" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-sm font-bold text-slate-600">Work Done</span>
            <textarea className="field min-h-28 resize-none" value={form.workDone} onChange={(event) => setForm({ ...form, workDone: event.target.value })} />
          </label>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-600">Hours</span>
              <input className="field" type="number" min="0" max="24" step="0.5" value={form.hours} onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-slate-600">Submitted By</span>
              <input className="field" value={form.submittedBy} onChange={(event) => setForm({ ...form, submittedBy: event.target.value })} />
            </label>
          </div>
          <button className="primary-button mt-4 justify-center" type="submit">
            <FileText size={17} />
            Save Report
          </button>
        </form>

        <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-bold">Submitted Reports ({reports.length})</h3>
          </div>
          {reports.length ? (
            <div className="grid gap-2">
              {reports.map((report) => (
                <article key={report.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{formatDate(report.date)} - {report.hours} hours</p>
                      <p className="mt-1 text-sm text-slate-600">{report.workDone}</p>
                      <p className="mt-2 text-xs text-slate-500">Submitted by {report.submittedBy}</p>
                    </div>
                    <button className="icon-button h-8 w-8 text-rose-600" title="Delete report" onClick={() => setReports((current) => current.filter((item) => item.id !== report.id))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">No reports submitted yet.</div>
          )}
        </section>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <p className="text-sm text-slate-500">{reports.length ? 'Reports are ready for stage completion.' : 'Add at least one report to complete this stage.'}</p>
        <button className={`primary-button h-10 min-w-56 justify-center ${!reports.length ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`} aria-disabled={!reports.length} onClick={handleCompleteStage}>
          <Check size={18} />
          Mark Reporting Complete
        </button>
      </section>
    </div>
  );
}

function readReports(key: string): ReportEntry[] {
  const saved = localStorage.getItem(key);
  if (!saved) return [];
  try {
    return JSON.parse(saved) as ReportEntry[];
  } catch {
    return [];
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
