import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { z } from 'zod';
import { teamMembers } from '../../data/seed';
import { useAppDispatch } from '../../hooks';
import { createProject } from '../../store';

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
});

type ProjectFormValues = z.infer<typeof projectSchema>;

export function CreateProject() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      category: 'Beaker',
      description: '',
      startDate: new Date().toISOString().slice(0, 10),
      targetDate: '',
      reportTo: '',
      teamMemberIds: ['u2'],
      priority: 'Medium',
      status: 'Running'
    }
  });

  function onCreate(values: ProjectFormValues) {
    dispatch(
      createProject({
        ...values,
        reportTo: values.reportTo || teamMembers[0].name,
        teamMembers: teamMembers.filter((member) => values.teamMemberIds.includes(member.id))
      })
    );
    navigate('/projects');
  }

  return (
    <div className="p-5 lg:p-8">
      <Link to="/projects" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary">
        <ArrowLeft size={16} />
        Projects
      </Link>
      <form className="panel mx-auto max-w-3xl space-y-4" onSubmit={form.handleSubmit(onCreate)}>
        <h2 className="text-2xl font-bold">Create New Project</h2>
        <input className="field" placeholder="Project name" {...form.register('name')} />
        <div className="grid gap-3 md:grid-cols-2">
          <select className="field" {...form.register('category')}>
            {['Beaker', 'Flask', 'Condenser', 'Pipette', 'Tube'].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field" {...form.register('priority')}>
            {['Low', 'Medium', 'High'].map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <textarea className="field min-h-28" placeholder="Description" {...form.register('description')} />
        <div className="grid gap-3 md:grid-cols-2">
          <input className="field" type="date" {...form.register('startDate')} />
          <input className="field" type="date" {...form.register('targetDate')} />
        </div>
        <select className="field" {...form.register('reportTo')}>
          <option value="">Report to Admin</option>
          {teamMembers.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
        </select>
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
        <button className="primary-button justify-center" type="submit">
          <Plus size={18} />
          Create Project
        </button>
      </form>
    </div>
  );
}
