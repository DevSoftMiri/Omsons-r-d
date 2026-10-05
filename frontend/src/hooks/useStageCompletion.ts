import { completeStage, upsertProject } from '../store';
import type { Project, StageName } from '../types';
import { canCompleteStage } from '../utils/stages';
import { useAppDispatch } from '../hooks';
import { useToast } from '../components/ToastProvider';
import { updateProjectStage } from '../services/projectService';
import { getStageRoute } from '../utils/stages';
import { useNavigate } from 'react-router-dom';

export function useStageCompletion(project: Project) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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
      const next = sourceProject.stages.find((item) => item.status !== 'Completed');
      showToast({
        tone: 'success',
        title: `${stage} completed`,
        message: next && next.name !== stage ? `${next.name} is now unlocked.` : 'All stages are complete.'
      });
      if (next) {
        navigate(`/projects/${sourceProject.productCode}/${getStageRoute(next, sourceProject)}`);
      } else if (stage !== 'Final Stage') {
        navigate(`/projects/${sourceProject.productCode}/final-stage`);
      }
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
