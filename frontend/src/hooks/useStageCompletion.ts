import { completeStage } from '../store';
import type { Project, StageName } from '../types';
import { canCompleteStage } from '../utils/stages';
import { useAppDispatch } from '../hooks';
import { useToast } from '../components/ToastProvider';

export function useStageCompletion(project: Project) {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();

  function complete(stage: StageName) {
    const result = canCompleteStage(project, stage);
    if (!result.ok) {
      showToast({
        tone: 'error',
        title: 'Complete previous stage first',
        message: result.blockedBy ? `${result.blockedBy} must be completed before ${stage}.` : `${stage} cannot be completed yet.`
      });
      return false;
    }

    dispatch(completeStage({ projectId: project.id, stage }));
    const index = project.stages.findIndex((item) => item.name === stage);
    const next = project.stages[index + 1];
    showToast({
      tone: 'success',
      title: `${stage} completed`,
      message: next ? `${next.name} is now unlocked.` : 'All stages are complete.'
    });
    return true;
  }

  return { completeStage: complete, canCompleteStage: (stage: StageName) => canCompleteStage(project, stage) };
}
