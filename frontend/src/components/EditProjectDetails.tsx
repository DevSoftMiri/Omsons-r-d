import { useState, type FormEvent } from 'react';
import type { Project } from '../types';
import { updateProjectDetails } from '../services/projectService';
import { useAppDispatch } from '../hooks';
import { upsertProject } from '../store';

export function EditProjectDetails({ project }: { project: Project }) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const read = (key: string) => String(values.get(key) || '').trim();
    if (read('targetDate') < read('startDate')) { setError('End Date cannot be before Start Date'); return; }
    setSaving(true); setError('');
    try {
      const updated = await updateProjectDetails(project.id, {
        name: read('name'), category: read('category'), description: read('description'),
        startDate: read('startDate'), targetDate: read('targetDate'), priority: read('priority') as Project['priority'],
      });
      dispatch(upsertProject({ ...updated, bom: project.bom, reports: project.reports }));
      setOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update project'); }
    finally { setSaving(false); }
  }
  return <>
    <button type="button" className="secondary-button" onClick={() => { setError(''); setOpen(true); }}>Edit Project</button>
    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/40 p-4">
      <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="edit-project-title" className="my-auto max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-xl bg-white p-5">
        <h2 id="edit-project-title" className="text-xl font-bold">Edit Project</h2>
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        <label className="block text-sm font-semibold">Project Name<input autoFocus className="field mt-1" name="name" defaultValue={project.name} required minLength={3} /></label>
        <label className="block text-sm font-semibold">Category<input className="field mt-1" name="category" defaultValue={project.category} required /></label>
        <label className="block text-sm font-semibold">Description<textarea className="field mt-1 min-h-24" name="description" defaultValue={project.description} required minLength={10} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Start Date<input className="field mt-1" type="date" name="startDate" defaultValue={project.startDate} required /></label>
          <label className="block text-sm font-semibold">End Date<input className="field mt-1" type="date" name="targetDate" defaultValue={project.targetDate} required /></label>
        </div>
        <label className="block text-sm font-semibold">Priority<select className="field mt-1" name="priority" defaultValue={project.priority}><option>Low</option><option>Medium</option><option>High</option></select></label>
        <div className="flex justify-end gap-2"><button className="secondary-button" type="button" disabled={saving} onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button></div>
      </form>
    </div>}
  </>;
}
