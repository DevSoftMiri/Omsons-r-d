import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Edit3, Plus, Save, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import { addCustomStage, deleteCustomStage, updateCustomStage, upsertProject } from '../../../store';
import { canCompleteStage } from '../../../utils/stages';
import { useToast } from '../../../components/ToastProvider';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { showMissingFieldsToast } from '../../../utils/requiredFields';
import { useProjectWorkspace } from './context';
import { reorderProjectStages } from '../../../services/projectService';

export function CustomStage() {
  const { stageSlug } = useParams();
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { showToast } = useToast();
  const { completeStage } = useStageCompletion(project);
  const stage = project.stages.find((item) => item.slug === stageSlug && item.isCustom);
  const [newStageName, setNewStageName] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(stage?.name || '');
  const [notes, setNotes] = useState(stage?.notes || '');
  const [checklistText, setChecklistText] = useState('');
  const [reordering, setReordering] = useState(false);
  const completion = useMemo(() => stage ? canCompleteStage(project, stage.name) : { ok: false, blockedBy: 'Unknown stage' }, [project, stage]);

  if (!stage) {
    return (
      <section className="panel">
        <h2 className="section-title">Custom stage not found</h2>
        <Link to="../overview" relative="path" className="mt-4 inline-flex text-sm font-bold text-primary">Back to overview</Link>
      </section>
    );
  }

  const activeStage = stage;
  const checklist = activeStage.checklist || [];
  const checked = checklist.filter((item) => item.completed).length;

  function saveStage() {
    if (showMissingFieldsToast(showToast, draftName.trim() ? [] : ['Stage Name'])) return;
    dispatch(updateCustomStage({ projectId: project.id, stageId: activeStage.id, name: draftName, notes, checklist }));
    setEditing(false);
    showToast({ tone: 'success', title: 'Custom stage updated', message: `${draftName.trim()} was saved.` });
  }

  function addChecklistItem() {
    const label = checklistText.trim();
    if (showMissingFieldsToast(showToast, label ? [] : ['Checklist Item'])) return;
    dispatch(updateCustomStage({
      projectId: project.id,
      stageId: activeStage.id,
      name: activeStage.name,
      notes,
      checklist: [...checklist, { id: crypto.randomUUID(), label, completed: false }]
    }));
    setChecklistText('');
  }

  function toggleChecklistItem(id: string) {
    dispatch(updateCustomStage({
      projectId: project.id,
      stageId: activeStage.id,
      name: activeStage.name,
      notes,
      checklist: checklist.map((item) => item.id === id ? { ...item, completed: !item.completed } : item)
    }));
  }

  function removeChecklistItem(id: string) {
    dispatch(updateCustomStage({
      projectId: project.id,
      stageId: activeStage.id,
      name: activeStage.name,
      notes,
      checklist: checklist.filter((item) => item.id !== id)
    }));
  }

  function addStage() {
    const name = newStageName.trim();
    if (showMissingFieldsToast(showToast, name ? [] : ['Stage Name'])) return;
    dispatch(addCustomStage({ projectId: project.id, name }));
    setNewStageName('');
    showToast({ tone: 'success', title: 'Custom stage added', message: `${name} was added before Final Stage.` });
  }

  function deleteStage() {
    dispatch(deleteCustomStage({ projectId: project.id, stageId: activeStage.id }));
    showToast({ tone: 'success', title: 'Custom stage deleted', message: `${activeStage.name} was removed.` });
  }

  function handleCompleteStage() {
    if (showMissingFieldsToast(showToast, completion.ok ? [] : [completion.blockedBy ? `${completion.blockedBy} completed` : 'Previous stages completed'])) return;
    completeStage(activeStage.name);
  }

  async function moveStage(direction: 'up' | 'down') {
    const index = project.stages.findIndex((item) => item.id === activeStage.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= project.stages.length - 1) return;
    const orderedStages = project.stages.map((item) => item.name);
    const [stageName] = orderedStages.splice(index, 1);
    orderedStages.splice(targetIndex, 0, stageName);
    setReordering(true);
    try {
      dispatch(upsertProject(await reorderProjectStages(project.id, orderedStages)));
      showToast({ tone: 'success', title: 'Stage order updated' });
    } catch (err) {
      showToast({ tone: 'error', title: 'Reorder failed', message: err instanceof Error ? err.message : 'Unable to reorder stages' });
    } finally {
      setReordering(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-primary">Projects</Link>
        <ChevronRight size={15} />
        <Link to="../overview" relative="path" className="hover:text-primary">{project.productCode}</Link>
        <ChevronRight size={15} />
        <span className="font-bold text-ink">{activeStage.name}</span>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-primary">Custom Stage</p>
            {editing ? <input className="field mt-2 max-w-md text-2xl font-bold" value={draftName} onChange={(event) => setDraftName(event.target.value)} /> : <h1 className="mt-1 text-3xl font-bold">{activeStage.name}</h1>}
            <p className="mt-2 text-sm text-slate-600">Track stage-specific notes, checklist items, and completion status.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {user?.role === 'admin' ? (
              <>
                <button className="secondary-button h-10 disabled:cursor-not-allowed disabled:opacity-50" disabled={reordering || project.stages.findIndex((item) => item.id === activeStage.id) <= 0} onClick={() => moveStage('up')}><ArrowUp size={16} />Move Up</button>
                <button className="secondary-button h-10 disabled:cursor-not-allowed disabled:opacity-50" disabled={reordering || project.stages.findIndex((item) => item.id === activeStage.id) >= project.stages.length - 2} onClick={() => moveStage('down')}><ArrowDown size={16} />Move Down</button>
              </>
            ) : null}
            {editing ? <button className="primary-button h-10" onClick={saveStage}><Save size={16} />Save</button> : <button className="secondary-button h-10" onClick={() => setEditing(true)}><Edit3 size={16} />Edit</button>}
            <Link to="../overview" relative="path" className="secondary-button h-10 text-rose-600" onClick={deleteStage}><Trash2 size={16} />Delete</Link>
          </div>
        </div>
      </section>
      <StageResponseBuilder projectCode={project.productCode} stageName={activeStage.name} mode="controls" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <h2 className="text-lg font-bold">Add Another Custom Stage</h2>
        <div className="mt-3 flex gap-2">
          <input className="field" value={newStageName} onChange={(event) => setNewStageName(event.target.value)} placeholder="Stage name" />
          <button className="secondary-button h-11 shrink-0" onClick={addStage}><Plus size={16} />Add</button>
        </div>
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
