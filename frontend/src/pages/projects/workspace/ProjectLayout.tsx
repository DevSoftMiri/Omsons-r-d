import { ArrowLeft, LogOut } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { ProjectSidebar } from '../../../components/ProjectSidebar';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import { logout } from '../../../store';
import { getStageRoute } from '../../../utils/stages';
import { ProjectWorkspaceContext } from './context';

export function ProjectLayout() {
  const dispatch = useAppDispatch();
  const { projectId } = useParams();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const project = useAppSelector((state) =>
    state.projects.projects.find((item) => item.productCode === projectId || item.id === projectId)
  );

  if (!project) {
    return (
      <div className="p-5 lg:p-8">
        <section className="panel">
          <h2 className="section-title">Project not found</h2>
          <Link to="/projects" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ArrowLeft size={16} />
            Back to projects
          </Link>
        </section>
      </div>
    );
  }

  const activeChildRoute = location.pathname.split('/').pop() || '';
  const lockedStage = project.stages.find((stage) => stage.status === 'Locked' && getStageRoute(stage).split('/').pop() === activeChildRoute);
  if (lockedStage) {
    return <Navigate to={`/projects/${project.productCode}/${getStageRoute(project.currentStage, project)}`} replace />;
  }

  return (
    <ProjectWorkspaceContext.Provider value={{ project }}>
      <div className="workspace-compact min-h-screen bg-slate-50 text-ink">
        <div className="grid min-h-screen lg:grid-cols-[215px_minmax(0,1fr)]">
          <ProjectSidebar project={project} />
          <div className="min-w-0">
            <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur">
              {user && (
                <div className="text-right">
                  <p className="text-sm font-bold text-ink">{user.name}</p>
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{user.role}</p>
                </div>
              )}
              <button className="icon-button" title="Logout" onClick={() => dispatch(logout())}>
                <LogOut size={16} />
              </button>
            </header>
            <div className="p-2.5 lg:px-3 lg:py-2.5">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </ProjectWorkspaceContext.Provider>
  );
}
