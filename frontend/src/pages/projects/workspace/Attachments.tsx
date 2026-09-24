import { useAppDispatch } from '../../../hooks';
import { completeStage } from '../../../store';
import { useProjectWorkspace } from './context';
import { StagePanel } from './Prerequisites';

export function Attachments() {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  return (
    <StagePanel title="Attachments" action="Mark Attachments Complete" onAction={() => dispatch(completeStage({ projectId: project.id, stage: 'Attachments' }))}>
      {['Drawing.pdf', 'Design.png', 'Tolerance-sheet.webp'].map((file) => (
        <div key={file} className="rounded-lg border border-slate-200 p-4">
          <p className="font-semibold">{file}</p>
          <p className="text-sm text-slate-500">Preview and download enabled for PDF, JPG, PNG, and WebP.</p>
        </div>
      ))}
    </StagePanel>
  );
}
