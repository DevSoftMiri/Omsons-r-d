import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { teamMembers, workflowStages } from '../../data/seed';
import { useAppDispatch } from '../../hooks';
import { createProject } from '../../store';
import type { StageName } from '../../types';

const configurableStages = workflowStages.filter((stage) => stage !== 'Final Stage');

const projectSchema = z.object({
  name: z.string().min(3),
  category: z.string().min(1),
  description: z.string().min(10),
  startDate: z.string().min(1),
  targetDate: z.string().min(1),
  reportTo: z.string().optional(),
  teamMemberIds: z.array(z.string()).min(1),
  priority: z.enum(['Low', 'Medium', 'High']),
  status: z.enum(['Running', 'On Hold', 'Completed', 'Delayed'])
}).refine((values) => new Date(values.targetDate).getTime() >= new Date(values.startDate).getTime(), {
  message: 'End Date cannot be before Start Date',
  path: ['targetDate']
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function CreateProject() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [customStageName, setCustomStageName] = useState('');
  const [customStages, setCustomStages] = useState<string[]>([]);
  const [selectedStages, setSelectedStages] = useState<StageName[]>(configurableStages);
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      category: 'Beaker',
      description: '',
      startDate: new Date().toISOString().slice(0, 10),
      targetDate: '',
      reportTo: teamMembers[0].name,
      teamMemberIds: ['u2'],
      priority: 'Medium',
      status: 'Running'
    }
  });

  function onCreate(values: ProjectFormValues) {
    dispatch(
      createProject({
        ...values,
        selectedStages,
        customStages,
        reportTo: values.reportTo || teamMembers[0].name,
        teamMembers: teamMembers.filter((member) => values.teamMemberIds.includes(member.id))
      })
    );
    navigate('/projects');
  }

  function toggleStage(stage: StageName) {
    setSelectedStages((current) => {
      if (current.includes(stage)) return current.filter((item) => item !== stage);
      const next = [...current, stage];
      return next.sort((a, b) => configurableStages.indexOf(a) - configurableStages.indexOf(b));
    });
  }

  function moveCustomStage(stage: string, direction: 'up' | 'down') {
    setCustomStages((current) => {
      const index = current.indexOf(stage);
      const target = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function addCustomStage() {
    const name = customStageName.trim();
    if (!name || customStages.some((stage) => stage.toLowerCase() === name.toLowerCase())) return;
    setCustomStages((current) => [...current, name]);
    setCustomStageName('');
  }

  return (
    <div className="p-5 lg:p-8">
      <Link to="/projects" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary">
        <ArrowLeft size={16} />
        Projects
      </Link>
      <form className="panel mx-auto max-w-3xl space-y-4" onSubmit={form.handleSubmit(onCreate)}>
        <h2 className="text-2xl font-bold">Create New Project</h2>
        <Field label="Project Name" error={form.formState.errors.name?.message}>
          <input className="field" placeholder="Project name" {...form.register('name')} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Category">
            <select className="field" {...form.register('category')}>
              {['Beaker', 'Flask', 'Condenser', 'Pipette', 'Tube'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="field" {...form.register('priority')}>
              {['Low', 'Medium', 'High'].map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description" error={form.formState.errors.description?.message}>
          <textarea className="field min-h-28" placeholder="Description" {...form.register('description')} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Start Date" error={form.formState.errors.startDate?.message}>
            <input className="field" type="date" {...form.register('startDate')} />
          </Field>
          <Field label="End Date" error={form.formState.errors.targetDate?.message}>
            <input className="field" type="date" {...form.register('targetDate')} />
          </Field>
        </div>
        <Field label="Report to Admin">
          <select className="field" {...form.register('reportTo')}>
            {teamMembers.filter((member) => member.role === 'Admin').map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
          </select>
        </Field>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold">Team Members</p>
          <div className="grid gap-2 md:grid-cols-2">
            {teamMembers.slice(1).map((member) => (
              <label key={member.id} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" value={member.id} {...form.register('teamMemberIds')} />
                {member.name} - {member.role}
              </label>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold">Project Stages</p>
          <div className="grid gap-2 md:grid-cols-2">
            {configurableStages.map((stage) => (
              <label key={stage} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={selectedStages.includes(stage)} onChange={() => toggleStage(stage)} />
                {stage}
              </label>
            ))}
          </div>
          {!selectedStages.length ? <p className="mt-2 text-xs font-semibold text-rose-600">Select at least one stage before Final Stage.</p> : null}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold">Custom Stages</p>
          <div className="flex gap-2">
            <input className="field" value={customStageName} placeholder="Add custom stage before Final Stage" onChange={(event) => setCustomStageName(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustomStage();
              }
            }} />
            <button className="secondary-button h-11 shrink-0" type="button" onClick={addCustomStage}><Plus size={16} />Add</button>
          </div>
          {customStages.length ? (
            <div className="mt-3 grid gap-2">
              {customStages.map((stage, index) => (
                <span key={stage} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-primary">
                  {stage}
                  <span className="ml-auto flex items-center gap-1">
                    <button type="button" disabled={index === 0} onClick={() => moveCustomStage(stage, 'up')} aria-label={`Move ${stage} up`} className="disabled:opacity-40">
                      <ArrowUp size={14} />
                    </button>
                    <button type="button" disabled={index === customStages.length - 1} onClick={() => moveCustomStage(stage, 'down')} aria-label={`Move ${stage} down`} className="disabled:opacity-40">
                      <ArrowDown size={14} />
                    </button>
                  </span>
                  <button type="button" onClick={() => setCustomStages((current) => current.filter((item) => item !== stage))} aria-label={`Remove ${stage}`}>
                    <Trash2 size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : <p className="mt-2 text-xs text-slate-500">Optional. These stages will appear before Final Stage.</p>}
        </div>
        <button className="primary-button justify-center disabled:cursor-not-allowed disabled:bg-slate-300" type="submit" disabled={!selectedStages.length}>
          <Plus size={18} />
          Create Project
        </button>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-600">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-rose-600">{error}</span> : null}
    </label>
  );
}
