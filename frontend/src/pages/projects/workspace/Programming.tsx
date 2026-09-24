import { useAppDispatch } from '../../../hooks';
import { completeStage } from '../../../store';
import { useProjectWorkspace } from './context';
import { StagePanel } from './Prerequisites';

export function Programming() {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  return (
    <StagePanel title="Programming" action="Complete Programming" onAction={() => dispatch(completeStage({ projectId: project.id, stage: 'Programming' }))}>
      {['Machine Parameters', 'PLC Logic', 'Testing Code', 'Final Validation'].map((item, index) => (
        <label key={item} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
          <input type="checkbox" defaultChecked={index < 2} />
          {item}
        </label>
      ))}
    </StagePanel>
  );
}
