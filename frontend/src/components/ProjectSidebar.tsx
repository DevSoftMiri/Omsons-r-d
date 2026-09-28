import { ArrowLeft } from 'lucide-react';
import type { CSSProperties } from 'react';
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

export function ProjectSidebar({ project, onNavigate }: { project: Project; onNavigate?: () => void }) {
  const itemCount = project.stages.length + 1;

  return (
    <aside
      className="project-sidebar border-b border-slate-200 bg-slate-950 p-3 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden lg:border-b-0"
      style={{ '--sidebar-items': itemCount } as CSSProperties}
    >
      <Link to="/projects" className="project-sidebar-back flex items-center gap-2 rounded-lg px-3 py-2 font-bold text-slate-100 hover:bg-white/10" onClick={onNavigate}>
        <ArrowLeft size={16} />
        <span className="truncate">{project.name}</span>
      </Link>
      <div className="project-sidebar-card rounded-lg bg-white/5 p-4">
        <p className="project-sidebar-code font-bold text-blue-200">{project.productCode}</p>
        <p className="project-sidebar-category mt-1 font-bold">{project.category}</p>
      </div>
      <nav className="project-sidebar-nav grid">
        <NavLink to="overview" onClick={onNavigate} className={({ isActive }) => `project-sidebar-link flex items-center justify-between rounded-lg px-4 font-semibold ${isActive ? 'bg-primary text-white' : 'text-slate-200 hover:bg-white/10'}`}>
          <span>Overview</span>
        </NavLink>
        {project.stages.map((stage) => {
          const locked = stage.status === 'Locked';
          const canOpen = !locked || stage.name === 'Final Stage';
          if (!canOpen) {
            return (
              <span key={stage.id} className="project-sidebar-link flex cursor-not-allowed items-center justify-between rounded-lg px-4 font-semibold text-slate-500" title="Complete the previous stage first">
                <span className="truncate">{stage.name}</span>
                <span className={`project-sidebar-dot rounded-full ${statusColor[stage.status]}`} title={stage.status} />
              </span>
            );
          }
          return (
            <NavLink key={stage.id} to={getStageRoute(stage)} onClick={onNavigate} className={({ isActive }) => `project-sidebar-link flex items-center justify-between rounded-lg px-4 font-semibold ${isActive ? 'bg-primary text-white' : locked ? 'text-slate-400 hover:bg-white/10' : 'text-slate-200 hover:bg-white/10'}`}>
              <span className="truncate">{stage.name}</span>
              <span className={`project-sidebar-dot rounded-full ${statusColor[stage.status]}`} title={stage.status} />
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
