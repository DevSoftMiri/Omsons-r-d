import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, Edit3, Plus, Save, Trash2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../../hooks';
import { addCustomStage, deleteCustomStage, moveCustomStage, updateCustomStage } from '../../../store';
import { canCompleteStage } from '../../../utils/stages';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { useProjectWorkspace } from './context';

export function CustomStage() {
  const { stageSlug } = useParams();
  const { project } = useProjectWorkspace();
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const { completeStage } = useStageCompletion(project);
  const stage = project.stages.find((item) => item.slug === stageSlug && item.isCustom);
  const [newStageName, setNewStageName] = useState('');
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(stage?.name || '');
  const [notes, setNotes] = useState(stage?.notes || '');
  const [checklistText, setChecklistText] = useState('');
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
    dispatch(updateCustomStage({ projectId: project.id, stageId: activeStage.id, name: draftName, notes, checklist }));
    setEditing(false);
    showToast({ tone: 'success', title: 'Custom stage updated', message: `${draftName.trim()} was saved.` });
  }

  function addChecklistItem() {
    const label = checklistText.trim();
    if (!label) return;
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
    if (!name) return;
    dispatch(addCustomStage({ projectId: project.id, name }));
    setNewStageName('');
    showToast({ tone: 'success', title: 'Custom stage added', message: `${name} was added before Final Stage.` });
  }

  function deleteStage() {
    dispatch(deleteCustomStage({ projectId: project.id, stageId: activeStage.id }));
    showToast({ tone: 'success', title: 'Custom stage deleted', message: `${activeStage.name} was removed.` });
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
            <button className="secondary-button h-10" onClick={() => dispatch(moveCustomStage({ projectId: project.id, stageId: activeStage.id, direction: 'up' }))}><ArrowUp size={16} />Move Up</button>
            <button className="secondary-button h-10" onClick={() => dispatch(moveCustomStage({ projectId: project.id, stageId: activeStage.id, direction: 'down' }))}><ArrowDown size={16} />Move Down</button>
            {editing ? <button className="primary-button h-10" onClick={saveStage}><Save size={16} />Save</button> : <button className="secondary-button h-10" onClick={() => setEditing(true)}><Edit3 size={16} />Edit</button>}
            <Link to="../overview" relative="path" className="secondary-button h-10 text-rose-600" onClick={deleteStage}><Trash2 size={16} />Delete</Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Checklist</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-primary">{checked} / {checklist.length} complete</span>
          </div>
          <div className="space-y-2">
            {checklist.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <input type="checkbox" checked={item.completed} onChange={() => toggleChecklistItem(item.id)} />
                <span className={`min-w-0 flex-1 ${item.completed ? 'text-slate-400 line-through' : 'font-semibold'}`}>{item.label}</span>
                <button className="text-rose-600" onClick={() => removeChecklistItem(item.id)} aria-label={`Remove ${item.label}`}><Trash2 size={16} /></button>
              </div>
            ))}
            {!checklist.length ? <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No checklist items yet.</p> : null}
          </div>
          <div className="mt-3 flex gap-2">
            <input className="field" value={checklistText} placeholder="Add checklist item" onChange={(event) => setChecklistText(event.target.value)} />
            <button className="secondary-button h-11 shrink-0" onClick={addChecklistItem}><Plus size={16} />Add</button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold">Stage Notes</h2>
            <textarea className="field mt-3 min-h-44 resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={saveStage} placeholder="Add notes for this custom stage..." />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-lg font-bold">Add Another Custom Stage</h2>
            <div className="mt-3 flex gap-2">
              <input className="field" value={newStageName} onChange={(event) => setNewStageName(event.target.value)} placeholder="Stage name" />
              <button className="secondary-button h-11 shrink-0" onClick={addStage}><Plus size={16} />Add</button>
            </div>
          </div>
        </section>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div>
          <p className="font-bold">Completion Status</p>
          <p className="text-sm text-slate-500">{completion.ok ? 'This stage can be completed.' : `${completion.blockedBy} must be completed first.`}</p>
        </div>
        <button className="primary-button h-10 min-w-56 justify-center disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!completion.ok} onClick={() => completeStage(activeStage.name)}>
          <Check size={18} />
          Mark Stage Complete
        </button>
      </section>
    </div>
  );
}
