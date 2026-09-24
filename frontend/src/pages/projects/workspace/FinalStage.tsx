import { CheckCircle2 } from 'lucide-react';
import { useAppDispatch } from '../../../hooks';
import { completeStage } from '../../../store';
import { useProjectWorkspace } from './context';

export function FinalStage() {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  return (
    <section className="panel">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Final Product Status</h2>
          <p className="text-sm text-slate-500">Current stage: {project.currentStage}</p>
        </div>
        <button className="primary-button" onClick={() => dispatch(completeStage({ projectId: project.id, stage: 'Final Stage' }))}>Mark Project Complete</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {['Programming Complete', 'Testing', 'Ready for Production'].map((item) => (
          <div key={item} className="rounded-lg border border-slate-200 p-4">
            <CheckCircle2 size={20} className="text-emerald-500" />
            <p className="mt-4 font-semibold">{item}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 h-4 rounded-full bg-slate-200">
        <div className="h-4 rounded-full bg-emerald-500" style={{ width: `${project.progress}%` }} />
      </div>
      <p className="mt-3 text-sm font-semibold">{project.progress}% Completed</p>
    </section>
  );
}
