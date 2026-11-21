import { useEffect, useMemo, useState } from 'react';
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
import { fetchProjectModule, updateProjectModule } from '../../../services/projectModuleService';
import { useProjectWorkspace } from './context';

export function StandardStage({ stageName }: { stageName: StageName }) {
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const stage = project.stages.find((item) => item.name === stageName);
  const [notes, setNotes] = useState(stage?.notes || '');
  const [checklistText, setChecklistText] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
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

  useEffect(() => {
    let active = true;
    setDetailsLoading(true);
    fetchProjectModule<{ notes?: string; checklist?: typeof checklist }>(project.productCode, `stage-details:${stageName}`)
      .then(({ data }) => {
        if (!active || !data) return;
        setNotes(data.notes || '');
        if (Array.isArray(data.checklist)) {
          dispatch(updateStageDetails({ projectId: project.id, stageId: activeStage.id, notes: data.notes || '', checklist: data.checklist }));
        }
        setDetailsError('');
      })
      .catch((error) => {
        if (active) setDetailsError(error instanceof Error ? error.message : 'Unable to load stage details.');
      })
      .finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [dispatch, project.id, project.productCode, stageName]);

  function saveStage(nextNotes = notes, nextChecklist = checklist) {
    if (!stage) return;
    dispatch(updateStageDetails({
      projectId: project.id,
      stageId: stage.id,
      notes: nextNotes,
      checklist: nextChecklist
    }));
    setSavingDetails(true);
    updateProjectModule(project.productCode, `stage-details:${stageName}`, { notes: nextNotes, checklist: nextChecklist })
      .then(() => setDetailsError(''))
      .catch((error) => setDetailsError(error instanceof Error ? error.message : 'Unable to save stage details.'))
      .finally(() => setSavingDetails(false));
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

      {detailsError ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{detailsError}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <h1 className="text-2xl font-bold">{activeStage.name}</h1>
        <p className="mt-1.5 text-sm text-slate-600">Track stage notes, checklist items, and completion status.</p>
        {detailsLoading ? <p className="mt-4 text-sm text-slate-500">Loading stage details...</p> : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-slate-700">Stage notes</span>
              <textarea className="field min-h-32 resize-y" value={notes} onChange={(event) => { setNotes(event.target.value); saveStage(event.target.value, checklist); }} placeholder="Add notes for this stage..." />
            </label>
            <div>
              <div className="mb-1 flex items-center justify-between"><span className="text-sm font-bold text-slate-700">Checklist</span><span className="text-xs text-slate-500">{checked}/{checklist.length} complete</span></div>
              <div className="space-y-2">
                {checklist.map((item) => <label key={item.id} className="flex items-center gap-2 rounded-md border border-slate-200 p-2"><input type="checkbox" checked={item.completed} onChange={() => toggleChecklistItem(item.id)} /><span className={item.completed ? 'text-slate-400 line-through' : ''}>{item.label}</span><button type="button" className="ml-auto text-rose-600" onClick={() => removeChecklistItem(item.id)}><Trash2 size={14} /></button></label>)}
              </div>
              <div className="mt-2 flex gap-2"><input className="field" value={checklistText} placeholder="Add checklist item" onChange={(event) => setChecklistText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addChecklistItem(); } }} /><button type="button" className="secondary-button shrink-0" onClick={addChecklistItem}><Plus size={16} />Add</button></div>
              {savingDetails ? <p className="mt-2 text-xs text-slate-500">Saving...</p> : null}
            </div>
          </div>
        )}
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
