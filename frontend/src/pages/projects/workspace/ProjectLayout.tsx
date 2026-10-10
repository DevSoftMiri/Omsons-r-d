import { ArrowLeft, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { ProjectSidebar } from '../../../components/ProjectSidebar';
import { StageSectionOrder } from '../../../components/stageSections/StageSectionOrder';
import { useAppDispatch, useAppSelector } from '../../../hooks';
import { fetchProject } from '../../../services/projectService';
import { logout, upsertProject } from '../../../store';
import { getStageRoute } from '../../../utils/stages';
import { ProjectWorkspaceContext } from './context';

export function ProjectLayout() {
  const dispatch = useAppDispatch();
  const { projectId } = useParams();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const project = useAppSelector((state) =>
    state.projects.projects.find((item) => item.productCode === projectId || item.id === projectId)
  );

  useEffect(() => {
    if (!projectId || project) return;
    let active = true;
    setLoading(true);
    fetchProject(projectId)
      .then((item) => {
        if (!active) return;
        dispatch(upsertProject(item));
        setLoadError('');
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'Project not found');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dispatch, project, projectId]);

  if (!project) {
    if (loading) {
      return (
        <div className="p-5 lg:p-8">
          <section className="panel">
            <h2 className="section-title">Loading project...</h2>
          </section>
        </div>
      );
    }

    return (
      <div className="p-5 lg:p-8">
        <section className="panel">
          <h2 className="section-title">Project not found</h2>
          {loadError ? <p className="mt-2 text-sm font-semibold text-rose-600">{loadError}</p> : null}
          <Link to="/projects" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <ArrowLeft size={16} />
            Back to projects
          </Link>
        </section>
      </div>
    );
  }

  const activeChildRoute = location.pathname.split('/').pop() || '';
  const lockedStage = project.stages.find((stage) => stage.name !== 'Final Stage' && stage.status === 'Locked' && getStageRoute(stage).split('/').pop() === activeChildRoute);
  const activeStage = project.stages.find((stage) => getStageRoute(stage, project).split('/').pop() === activeChildRoute);
  if (lockedStage) {
    return <Navigate to={`/projects/${project.productCode}/${getStageRoute(project.currentStage, project)}`} replace />;
  }

  return (
    <ProjectWorkspaceContext.Provider value={{ project }}>
      <div className="workspace-compact min-h-screen bg-slate-50 text-ink">
        <div className="grid min-h-screen lg:grid-cols-[235px_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <ProjectSidebar project={project} />
          </div>
          {sidebarOpen ? (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button className="absolute inset-0 bg-slate-950/60" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
              <div className="absolute left-0 top-0 h-full w-[min(285px,86vw)]">
                <ProjectSidebar project={project} onNavigate={() => setSidebarOpen(false)} />
              </div>
            </div>
          ) : null}
          <div className="min-w-0">
            <header className="sticky top-0 z-20 flex h-11 items-center justify-between gap-3 border-b border-[#333333] bg-[#333333] px-2.5 text-white backdrop-blur">
              <div className="flex min-w-0 items-center gap-2">
                <button className="icon-button border-white/15 bg-white/10 text-white hover:bg-white/15 lg:hidden" title={sidebarOpen ? 'Close stages' : 'Open stages'} onClick={() => setSidebarOpen((open) => !open)}>
                  {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
                </button>
                <div className="min-w-0 lg:hidden">
                  <p className="truncate text-sm font-bold text-white">{project.name}</p>
                  <p className="text-xs font-semibold text-white/75">{project.currentStage}</p>
                </div>
              </div>
              {user && (
                <div className="ml-auto text-right">
                  <p className="truncate text-sm font-bold text-white">{user.name}</p>
                  <p className="text-[11px] font-semibold uppercase text-white/75">{user.role}</p>
                </div>
              )}
              <button className="icon-button border-white/15 bg-white/10 text-white hover:bg-white/15" title="Logout" onClick={() => dispatch(logout())}>
                <LogOut size={16} />
              </button>
            </header>
            <div className="p-2 lg:px-2.5 lg:py-2">
              {activeStage ? <StageSectionOrder projectCode={project.productCode} stageName={activeStage.name}><Outlet /></StageSectionOrder> : <Outlet />}
            </div>
          </div>
        </div>
      </div>
    </ProjectWorkspaceContext.Provider>
  );
}
