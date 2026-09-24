import { useAppDispatch } from '../../../hooks';
import { completeStage } from '../../../store';
import { useProjectWorkspace } from './context';
import { StagePanel } from './Prerequisites';

export function ProductDesign() {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  return (
    <StagePanel title="Product Design" action="Mark Design Complete" onAction={() => dispatch(completeStage({ projectId: project.id, stage: 'Product Design' }))}>
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="font-semibold">Design Details</p>
        <p className="mt-2 text-sm text-slate-600">{project.description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {['CAD Drawing', 'Prototype Image', 'Version History'].map((item) => (
          <div key={item} className="grid min-h-32 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600">{item}</div>
        ))}
      </div>
    </StagePanel>
  );
}
