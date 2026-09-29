import { ChevronDown, FlaskConical, MoreHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTopBar } from '../components/PageTopBar';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchProjects } from '../services/projectService';
import { setProjects } from '../store';
import type { Project, ProjectStatus } from '../types';

const dashboardStages = [
  { label: 'Overview', names: ['Prerequisites'] },
  { label: 'Prerequisites', names: ['Prerequisites'] },
  { label: 'Benchmarking', names: ['Benchmarking', 'Attachments', 'BOM'] },
  { label: 'Design', names: ['Product Design'] },
  { label: 'Programming', names: ['Programming', 'Reporting'] },
  { label: 'Testing', names: ['Testing & Validation'] },
  { label: 'Final', names: ['Final Stage'] }
];

function statusLabel(status: ProjectStatus) {
  if (status === 'Delayed') return 'At Risk';
  if (status === 'Running') return 'On Track';
  return status;
}

function stageState(project: Project, index: number) {
  const activeIndex = dashboardStages.findIndex((stage) => stage.names.includes(project.currentStage));
  const progressIndex = activeIndex >= 0 ? activeIndex : Math.min(Math.floor(project.progress / 15), dashboardStages.length - 1);
  if (project.progress >= 100 || index < progressIndex) return 'complete';
  if (index === progressIndex) return 'active';
  return 'pending';
}

function ProductThumb({ project }: { project: Project }) {
  const lowerName = project.name.toLowerCase();
  const isCup = lowerName.includes('cup') || lowerName.includes('mug');
  const isTumbler = lowerName.includes('tumbler');
  const isJar = lowerName.includes('jar');

  return (
    <div className="grid h-[66px] w-[70px] place-items-center rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-100">
      <div className={`${isCup ? 'glass-cup' : isTumbler ? 'glass-tumbler' : isJar ? 'glass-jar' : 'glass-bottle'}`} />
    </div>
  );
}

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchProjects()
      .then((items) => dispatch(setProjects(items)))
      .catch(() => undefined);
  }, [dispatch]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return projects;
    return projects.filter((project) => `${project.productCode} ${project.name} ${project.currentStage}`.toLowerCase().includes(normalizedQuery));
  }, [projects, query]);

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="R&D Project Dashboard" subtitle="Glassware product development from concept to production readiness" searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search projects..." actionLabel="New Project" actionHref="/projects/create" />

      <section className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#06143d]">Projects</h2>
          <button className="inline-flex h-11 items-center gap-10 rounded-lg border border-[#cad7eb] bg-white px-4 text-base font-semibold text-[#18315e]">
            All Projects
            <ChevronDown size={20} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1380px] w-full border-collapse text-left">
            <thead>
              <tr className="border-y border-[#e2e8f2] bg-[#f8faff] text-sm font-bold text-[#40577f]">
                <th className="w-12 px-4 py-3">#</th>
                <th className="w-[270px] px-4 py-3">Project</th>
                <th className="w-[720px] px-4 py-3">Current Stage</th>
                <th className="w-[240px] px-4 py-3">Stage Progress</th>
                <th className="w-[160px] px-4 py-3">Status</th>
                <th className="w-20 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleProjects.map((project, index) => (
                <tr key={project.id} className="group border-b border-[#e2e8f2] transition hover:bg-[#f8fbff]">
                  <td className="px-4 py-4 align-middle text-base font-medium text-[#3f5580]">{index + 1}</td>
                  <td className="px-4 py-4 align-middle">
                    <Link to={`/projects/${project.productCode}/overview`} className="flex items-center gap-4">
                      <ProductThumb project={project} />
                      <span>
                        <span className="block text-base font-bold text-[#06143d]">{project.productCode}</span>
                        <span className="mt-1 block text-base font-medium text-[#344b76]">{project.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <div className="flex items-start">
                      {dashboardStages.map((stage, stageIndex) => {
                        const state = stageState(project, stageIndex);
                        return (
                          <div key={stage.label} className="stage-step">
                            <div className={`stage-dot ${state}`}>
                              {state === 'complete' ? '✓' : state === 'active' ? <span /> : null}
                            </div>
                            {stageIndex < dashboardStages.length - 1 && <div className={`stage-line ${state === 'complete' ? 'complete' : ''}`} />}
                            <p className={`stage-label ${state === 'active' ? 'active' : ''}`}>{stage.label}</p>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <p className="mb-2 text-base font-bold text-[#06143d]">{project.progress}%</p>
                    <div className="h-2.5 w-52 rounded-full bg-[#dfe5ed]">
                      <div className="h-2.5 rounded-full bg-[#0066ff]" style={{ width: `${Math.min(project.progress, 100)}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-4 align-middle">
                    <span className={`dashboard-status ${project.status.toLowerCase().replace(' ', '-')}`}>{statusLabel(project.status)}</span>
                  </td>
                  <td className="px-4 py-4 text-right align-middle">
                    <button className="inline-grid h-9 w-9 place-items-center rounded-full text-[#1d3767] transition hover:bg-[#edf4ff]" title="Project actions">
                      <MoreHorizontal size={24} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleProjects.length ? (
            <div className="border-b border-[#e2e8f2] px-4 py-10 text-center">
              <p className="font-bold text-[#06143d]">No projects found</p>
              <p className="mt-1 text-sm text-[#53688d]">Create a project to see it on the dashboard.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
