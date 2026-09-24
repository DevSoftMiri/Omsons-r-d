import { ArrowLeft } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import type { Project } from '../types';
import { getStageRoute } from '../utils/stages';

const statusColor = {
  Locked: 'bg-slate-300',
  Pending: 'bg-slate-400',
  'In Progress': 'bg-primary',
  Submitted: 'bg-amber-500',
  Completed: 'bg-emerald-500'
};

export function ProjectSidebar({ project }: { project: Project }) {
  return (
    <aside className="border-b border-slate-200 bg-slate-950 p-3 text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0">
      <Link to="/projects" className="mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-slate-100 hover:bg-white/10">
        <ArrowLeft size={16} />
        <span className="truncate">{project.name}</span>
      </Link>
      <div className="mb-5 rounded-lg bg-white/5 p-4">
        <p className="text-sm font-bold text-blue-200">{project.productCode}</p>
        <p className="mt-1 text-lg font-bold">{project.category}</p>
      </div>
      <nav className="grid gap-2">
        <NavLink to="overview" className={({ isActive }) => `flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-semibold ${isActive ? 'bg-primary text-white' : 'text-slate-200 hover:bg-white/10'}`}>
          <span>Overview</span>
        </NavLink>
        {project.stages.map((stage) => (
          <NavLink key={stage.id} to={getStageRoute(stage)} className={({ isActive }) => `flex items-center justify-between rounded-lg px-4 py-2.5 text-sm font-semibold ${isActive ? 'bg-primary text-white' : 'text-slate-200 hover:bg-white/10'}`}>
            <span className="truncate">{stage.name}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${statusColor[stage.status]}`} title={stage.status} />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
