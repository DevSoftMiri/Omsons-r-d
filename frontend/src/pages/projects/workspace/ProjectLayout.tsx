import { ArrowLeft } from 'lucide-react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { ProjectSidebar } from '../../../components/ProjectSidebar';
import { useAppSelector } from '../../../hooks';
import { ProjectWorkspaceContext } from './context';

export function ProjectLayout() {
  const { projectId } = useParams();
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

  return (
    <ProjectWorkspaceContext.Provider value={{ project }}>
      <div className="min-h-screen bg-slate-50 text-ink">
        <div className="grid min-h-screen lg:grid-cols-[250px_minmax(0,1fr)]">
          <ProjectSidebar project={project} />
          <div className="min-w-0 p-4 lg:px-5 lg:py-4">
            <Outlet />
          </div>
        </div>
      </div>
    </ProjectWorkspaceContext.Provider>
  );
}
