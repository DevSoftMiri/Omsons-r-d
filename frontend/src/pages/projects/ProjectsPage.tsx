import { ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../../hooks';

const dotColor = {
  Running: 'bg-primary',
  'On Hold': 'bg-amber-500',
  Completed: 'bg-emerald-500',
  Delayed: 'bg-rose-500'
};

export function ProjectsPage() {
  const projects = useAppSelector((state) => state.projects.projects);

  return (
    <div className="p-5 lg:p-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Projects</h2>
          <p className="text-sm text-slate-500">All product R&D projects</p>
        </div>
        <Link to="/projects/create" className="primary-button">
          <Plus size={18} />
          Create
        </Link>
      </div>

      <section className="space-y-4">
        {projects.map((project) => (
          <article key={project.id} className="panel flex items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-5">
              <span className={`h-9 w-9 shrink-0 rounded-full ${dotColor[project.status]}`} />
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold">{project.name}</h3>
                <p className="text-sm text-slate-500">Stage: {project.currentStage}</p>
              </div>
            </div>
            <Link to={`/projects/${project.productCode}/overview`} className="secondary-button shrink-0">
              Open
              <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
