import { useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { updateStageDetails } from '../../../store';
import type { StageName } from '../../../types';
import { canCompleteStage } from '../../../utils/stages';
import { showMissingFieldsToast } from '../../../utils/requiredFields';
import { useAppDispatch } from '../../../hooks';
import { useProjectWorkspace } from './context';

export function StandardStage({ stageName }: { stageName: StageName }) {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const stage = project.stages.find((item) => item.name === stageName);
  const [notes, setNotes] = useState(stage?.notes || '');
  const [checklistText, setChecklistText] = useState('');
  const completion = useMemo(
    () => stage ? canCompleteStage(project, stage.name) : { ok: false, blockedBy: 'Unknown stage' },
    [project, stage]
  );

  if (!stage) {
    return (
      <section className="panel">
        <h2 className="section-title">Stage not found</h2>
        <Link to="../overview" relative="path" className="mt-4 inline-flex text-sm font-bold text-primary">Back to overview</Link>
      </section>
    );
  }

  const activeStage = stage;
  const checklist = stage.checklist || [];
  const checked = checklist.filter((item) => item.completed).length;

  function saveStage(nextNotes = notes, nextChecklist = checklist) {
    if (!stage) return;
    dispatch(updateStageDetails({
      projectId: project.id,
      stageId: stage.id,
      notes: nextNotes,
      checklist: nextChecklist
    }));
  }

  function addChecklistItem() {
    const label = checklistText.trim();
    if (showMissingFieldsToast(showToast, label ? [] : ['Checklist Item'])) return;
    saveStage(notes, [...checklist, { id: crypto.randomUUID(), label, completed: false }]);
    setChecklistText('');
  }

  function toggleChecklistItem(id: string) {
    saveStage(notes, checklist.map((item) => item.id === id ? { ...item, completed: !item.completed } : item));
  }

  function removeChecklistItem(id: string) {
    saveStage(notes, checklist.filter((item) => item.id !== id));
  }

  function handleCompleteStage() {
    if (showMissingFieldsToast(showToast, completion.ok ? [] : [completion.blockedBy ? `${completion.blockedBy} completed` : 'Previous stages completed'])) return;
    completeStage(activeStage.name);
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-primary">Projects</Link>
        <ChevronRight size={15} />
        <Link to="../overview" relative="path" className="hover:text-primary">{project.productCode}</Link>
        <ChevronRight size={15} />
        <span className="font-bold text-ink">{stage.name}</span>
      </div>

      <ProjectStageHeader project={project} currentStage={activeStage.name} />
      <StageResponseBuilder projectCode={project.productCode} stageName={activeStage.name} mode="controls" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <h1 className="text-2xl font-bold">{activeStage.name}</h1>
        <p className="mt-1.5 text-sm text-slate-600">Track stage notes, checklist items, and completion status.</p>
      </section>
      <StageResponseBuilder projectCode={project.productCode} stageName={activeStage.name} mode="blocks" />


      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div>
          <p className="font-bold">Completion Status</p>
          <p className="text-sm text-slate-500">{completion.ok ? 'This stage can be completed.' : `${completion.blockedBy} must be completed first.`}</p>
        </div>
        <button className={`primary-button h-10 min-w-56 justify-center ${!completion.ok ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`} aria-disabled={!completion.ok} onClick={handleCompleteStage}>
          <Check size={18} />
          Mark Stage Complete
        </button>
      </section>
    </div>
  );
}
