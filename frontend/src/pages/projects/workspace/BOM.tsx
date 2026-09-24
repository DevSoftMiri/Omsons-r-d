import { useAppDispatch } from '../../../hooks';
import { completeStage } from '../../../store';
import { useProjectWorkspace } from './context';

export function BOM() {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  const total = project.bom.reduce((sum, item) => sum + item.quantity * item.cost, 0);

  return (
    <section className="panel">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">BOM</h2>
          <p className="text-sm font-semibold text-primary">Total: Rs. {total.toLocaleString('en-IN')}</p>
        </div>
        <button className="primary-button" onClick={() => dispatch(completeStage({ projectId: project.id, stage: 'BOM' }))}>Mark BOM Complete</button>
      </div>
      <div className="grid gap-3">
        {project.bom.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">{item.materialName}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{item.procurementStage}</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{item.vendor} - Qty {item.quantity} - Rs. {item.cost} - {item.leadTimeDays} days</p>
          </div>
        ))}
      </div>
    </section>
  );
}
