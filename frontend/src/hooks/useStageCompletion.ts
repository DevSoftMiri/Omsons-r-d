import { completeStage, upsertProject } from '../store';
import type { Project, StageName } from '../types';
import { canCompleteStage } from '../utils/stages';
import { useAppDispatch } from '../hooks';
import { useToast } from '../components/ToastProvider';
import { updateProjectStage } from '../services/projectService';

export function useStageCompletion(project: Project) {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();

  async function complete(stage: StageName) {
    const result = canCompleteStage(project, stage);
    if (!result.ok) {
      showToast({
        tone: 'error',
        title: 'Complete previous stage first',
        message: result.blockedBy ? `${result.blockedBy} must be completed before ${stage}.` : `${stage} cannot be completed yet.`
      });
      return false;
    }

    try {
      const updatedProject = await updateProjectStage(project.id, stage);
      if (updatedProject) {
        dispatch(upsertProject(updatedProject));
      } else {
        dispatch(completeStage({ projectId: project.id, stage }));
      }

      const sourceProject = updatedProject || project;
      const index = sourceProject.stages.findIndex((item) => item.name === stage);
      const next = sourceProject.stages[index + 1];
      showToast({
        tone: 'success',
        title: `${stage} completed`,
        message: next ? `${next.name} is now unlocked.` : 'All stages are complete.'
      });
      return true;
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Could not complete stage',
        message: error instanceof Error ? error.message : `${stage} could not be completed.`
      });
      return false;
    }
  }

  return { completeStage: complete, canCompleteStage: (stage: StageName) => canCompleteStage(project, stage) };
}
