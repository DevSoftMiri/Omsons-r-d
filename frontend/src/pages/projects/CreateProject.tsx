import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { workflowStages } from '../../data/seed';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { upsertProject } from '../../store';
import { createProject as createProjectApi } from '../../services/projectService';
import { readActiveWorkflowStages } from '../../services/adminModuleStorage';
import { fetchStaffAccounts, type StaffAccount } from '../../services/authService';
import type { StageName } from '../../types';
import { useToast } from '../../components/ToastProvider';
import { getMissingFields, showMissingFieldsToast } from '../../utils/requiredFields';

const configurableStages = workflowStages.filter((stage) => stage !== 'Final Stage');
const categoryOptions = ['Beaker', 'Flask', 'Condenser', 'Pipette', 'Tube'];

const projectSchema = z.object({
  name: z.string().min(3),
  category: z.string().min(1),
  description: z.string().min(10),
  startDate: z.string().min(1),
  targetDate: z.string().min(1),
  reportTo: z.string().optional(),
  teamMemberIds: z.array(z.string()),
  priority: z.enum(['Low', 'Medium', 'High']),
  status: z.enum(['Running', 'On Hold', 'Completed', 'Delayed'])
}).refine((values) => new Date(values.targetDate).getTime() >= new Date(values.startDate).getTime(), {
  message: 'End Date cannot be before Start Date',
  path: ['targetDate']
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function CreateProject() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const user = useAppSelector((state) => state.auth.user);
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [customStageName, setCustomStageName] = useState('');
  const [orderedStages, setOrderedStages] = useState<StageName[]>(() => readActiveWorkflowStages().length ? readActiveWorkflowStages() : configurableStages);
  const [draggedStage, setDraggedStage] = useState<StageName | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      category: 'Beaker',
      description: '',
      startDate: new Date().toISOString().slice(0, 10),
      targetDate: '',
      reportTo: '',
      teamMemberIds: [],
      priority: 'Medium',
      status: 'Running'
    }
  });
  const startDate = form.watch('startDate');
  const targetDate = form.watch('targetDate');
  const adminAccounts = useMemo(() => accounts.filter((account) => account.role === 'Admin'), [accounts]);
  const staffAccounts = useMemo(() => accounts.filter((account) => account.role === 'Staff'), [accounts]);

  useEffect(() => {
    let active = true;
    setLoadingAccounts(true);
    fetchStaffAccounts()
      .then((items) => {
        if (!active) return;
        setAccounts(items);
        const firstAdmin = items.find((account) => account.role === 'Admin');
        if (firstAdmin && !form.getValues('reportTo')) form.setValue('reportTo', firstAdmin._id);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingAccounts(false);
      });
    return () => {
      active = false;
    };
  }, [form]);

  async function onInvalid() {
    const values = form.getValues();
    const missing = getMissingFields([
      { label: 'Project Name', value: values.name },
      { label: 'Description', value: values.description },
      { label: 'Start Date', value: values.startDate },
      { label: 'End Date', value: values.targetDate },
      { label: 'Project Stages', valid: orderedStages.length > 0 },
      { label: 'Valid date range', valid: !values.startDate || !values.targetDate || new Date(values.targetDate).getTime() >= new Date(values.startDate).getTime() }
    ]);
    showMissingFieldsToast(showToast, missing);
  }

  async function onCreate(values: ProjectFormValues) {
    const missing = getMissingFields([
      { label: 'Project Name', value: values.name },
      { label: 'Description', value: values.description },
      { label: 'Start Date', value: values.startDate },
      { label: 'End Date', value: values.targetDate },
      { label: 'Project Stages', valid: orderedStages.length > 0 }
    ]);
    if (showMissingFieldsToast(showToast, missing)) return;
    setSaving(true);
    setError('');
    try {
      const project = await createProjectApi({
        ...values,
        selectedStages: orderedStages,
        customStages: orderedStages.filter((stage) => !configurableStages.includes(stage)),
        reportTo: values.reportTo || user?.id || '',
        teamMemberIds: values.teamMemberIds
      });
      dispatch(upsertProject(project));
      navigate(`/projects/${project.productCode}/overview`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create project');
    } finally {
      setSaving(false);
    }
  }

  function toggleStage(stage: StageName) {
    setOrderedStages((current) => {
      if (current.includes(stage)) return current.filter((item) => item !== stage);
      const insertAfter = current.reduce((lastIndex, item, index) => {
        const workflowIndex = configurableStages.indexOf(item);
        return workflowIndex >= 0 && workflowIndex < configurableStages.indexOf(stage) ? index : lastIndex;
      }, -1);
      const next = [...current];
      next.splice(insertAfter + 1, 0, stage);
      return next;
    });
  }

  function removeStage(stage: StageName) {
    if (stage === 'Final Stage') return;
    setOrderedStages((current) => current.filter((item) => item !== stage));
  }

  function moveStage(stage: StageName, targetStage: StageName) {
    if (stage === targetStage || stage === 'Final Stage' || targetStage === 'Final Stage') return;
    setOrderedStages((current) => {
      const index = current.indexOf(stage);
      const target = current.indexOf(targetStage);
      if (index < 0 || target < 0) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function addCustomStage() {
    const name = customStageName.trim();
    if (!name) {
      showMissingFieldsToast(showToast, ['Custom Stage Name']);
      return;
    }
    if (orderedStages.some((stage) => stage.toLowerCase() === name.toLowerCase()) || name.toLowerCase() === 'final stage') return;
    setOrderedStages((current) => [...current, name]);
    setCustomStageName('');
  }

  return (
    <div className="p-5 lg:p-8">
      <Link to="/projects" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary">
        <ArrowLeft size={16} />
        Projects
      </Link>
      <form className="panel mx-auto max-w-3xl space-y-4" onSubmit={form.handleSubmit(onCreate, onInvalid)}>
        <h2 className="text-2xl font-bold">Create New Project</h2>
        {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
        <Field label="Project Name" error={form.formState.errors.name?.message}>
          <input className="field" placeholder="Project name" {...form.register('name')} />
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Category">
            <input className="field" list="project-category-options" placeholder="Select or type category" {...form.register('category')} />
            <datalist id="project-category-options">
              {categoryOptions.map((item) => <option key={item} value={item} />)}
            </datalist>
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
            <input
              className="field"
              type="date"
              {...form.register('startDate', {
                onChange: (event) => {
                  const nextStartDate = event.target.value;
                  if (targetDate && nextStartDate && targetDate < nextStartDate) {
                    form.setValue('targetDate', nextStartDate, { shouldDirty: true, shouldValidate: true });
                  }
                }
              })}
            />
          </Field>
          <Field label="End Date" error={form.formState.errors.targetDate?.message}>
            <input className="field" type="date" min={startDate} {...form.register('targetDate')} />
          </Field>
        </div>
        <Field label="Report to Admin">
          <select className="field" {...form.register('reportTo')}>
            <option value="">{loadingAccounts ? 'Loading admins...' : 'Select admin'}</option>
            {adminAccounts.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
          </select>
        </Field>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold">Team Members</p>
          <div className="grid gap-2 md:grid-cols-2">
            {staffAccounts.map((member) => (
              <label key={member._id} className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" value={member._id} {...form.register('teamMemberIds')} />
                {member.name} - {member.email}
              </label>
            ))}
          </div>
          {!loadingAccounts && !staffAccounts.length ? <p className="text-sm font-semibold text-slate-500">No staff accounts found. Add staff from Team Members first.</p> : null}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold">Project Stages</p>
          <div className="grid gap-2 md:grid-cols-2">
            {configurableStages.map((stage) => (
              <label key={stage} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={orderedStages.includes(stage)} onChange={() => toggleStage(stage)} />
                {stage}
              </label>
            ))}
          </div>
          {!orderedStages.length ? <p className="mt-2 text-xs font-semibold text-rose-600">Select at least one stage before Final Stage.</p> : null}
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
          <p className="mt-2 text-xs text-slate-500">Optional. Add a stage, then arrange it in the workflow below.</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold">Stage Order</p>
          <div className="grid gap-2">
            {[...orderedStages, 'Final Stage'].map((stage, index) => {
              const isFinalStage = stage === 'Final Stage';
              return (
                <div
                  key={`${stage}-${index}`}
                  draggable={!isFinalStage}
                  onDragStart={(event) => {
                    if (isFinalStage) return;
                    setDraggedStage(stage);
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', stage);
                  }}
                  onDragOver={(event) => {
                    if (!isFinalStage && draggedStage && draggedStage !== stage) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const movingStage = draggedStage || event.dataTransfer.getData('text/plain');
                    if (movingStage) moveStage(movingStage as StageName, stage);
                    setDraggedStage(null);
                  }}
                  onDragEnd={() => setDraggedStage(null)}
                  className={`flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-primary transition ${isFinalStage ? 'cursor-default opacity-70' : 'cursor-grab active:cursor-grabbing'} ${draggedStage === stage ? 'scale-[0.99] opacity-50' : ''}`}
                >
                  <GripVertical size={16} className={isFinalStage ? 'text-blue-300' : 'text-blue-500'} />
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-xs text-slate-600">{index + 1}</span>
                  {stage}
                  <span className="ml-auto flex items-center gap-1">
                    <span className="text-xs font-semibold text-blue-400">{isFinalStage ? 'Fixed' : 'Drag to reorder'}</span>
                  </span>
                  {!isFinalStage ? (
                    <button type="button" onClick={() => removeStage(stage)} aria-label={`Remove ${stage}`} className="grid h-7 w-7 place-items-center rounded-md text-blue-600 hover:bg-white hover:text-rose-600">
                      <Trash2 size={14} />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        <button className="primary-button justify-center disabled:cursor-not-allowed disabled:bg-slate-300" type="submit" disabled={!orderedStages.length || saving}>
          <Plus size={18} />
          {saving ? 'Creating...' : 'Create Project'}
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
