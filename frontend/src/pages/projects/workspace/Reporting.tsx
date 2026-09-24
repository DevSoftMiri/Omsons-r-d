import { useAppDispatch } from '../../../hooks';
import { completeStage } from '../../../store';
import { useProjectWorkspace } from './context';

export function Reporting() {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();

  return (
    <section className="panel">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Reporting</h2>
        <button className="primary-button" onClick={() => dispatch(completeStage({ projectId: project.id, stage: 'Reporting' }))}>Mark Reporting Complete</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <textarea className="field min-h-36" placeholder="Daily work done" />
        <div className="grid gap-3">
          <input className="field" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          <input className="field" type="number" placeholder="Hours" />
          <button className="secondary-button justify-center">Submit Report</button>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        {project.reports.length ? project.reports.map((report) => (
          <div key={report.id} className="rounded-lg border border-slate-200 p-4">
            <p className="font-semibold">{report.workDone}</p>
            <p className="mt-2 text-sm text-slate-500">{report.date} - {report.submittedBy} - {report.hours}h - {report.status}</p>
          </div>
        )) : <p className="text-sm text-slate-500">No reports submitted yet.</p>}
      </div>
    </section>
  );
}
