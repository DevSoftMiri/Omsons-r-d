import { ChevronDown, MoreHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTopBar } from '../components/PageTopBar';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchProjects, updateProjectStatus } from '../services/projectService';
import { setProjects, upsertProject } from '../store';
import { getStageRoute } from '../utils/stages';
import type { Project, ProjectStatus, Stage } from '../types';

function statusLabel(status: ProjectStatus) {
  if (status === 'Delayed') return 'At Risk';
  if (status === 'Running') return 'On Track';
  return status;
}

function stageState(stage: Stage) {
  if (stage.status === 'Completed') return 'complete';
  if (stage.status === 'In Progress' || stage.status === 'Pending' || stage.status === 'Submitted') return 'active';
  return 'pending';
}

function stageLabel(name: string) {
  if (name === 'Product Design') return 'Design';
  if (name === 'Testing & Validation') return 'Testing';
  if (name === 'Final Stage') return 'Final';
  return name;
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

const statusOptions = ['All Status', 'Running', 'On Hold', 'Completed', 'Delayed'] as const;

export function DashboardPage() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const user = useAppSelector((state) => state.auth.user);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>('All Status');
  const [stageFilter, setStageFilter] = useState('All Stages');

  useEffect(() => {
    fetchProjects()
      .then((items) => dispatch(setProjects(items)))
      .catch(() => undefined);
  }, [dispatch]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery = !normalizedQuery || `${project.productCode} ${project.name} ${project.currentStage}`.toLowerCase().includes(normalizedQuery);
      const matchesStatus = statusFilter === 'All Status' || project.status === statusFilter;
      const matchesStage = stageFilter === 'All Stages' || project.currentStage === stageFilter;
      return matchesQuery && matchesStatus && matchesStage;
    });
  }, [projects, query, stageFilter, statusFilter]);

  const stageOptions = useMemo(() => ['All Stages', ...Array.from(new Set(projects.flatMap((project) => project.stages.map((stage) => stage.name))))], [projects]);

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="R&D Project Dashboard" subtitle="Glassware product development from concept to production readiness" searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search projects..." actionLabel={user?.role === 'admin' ? 'New Project' : undefined} actionHref={user?.role === 'admin' ? '/projects/create' : undefined} />

      <section className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-[#06143d]">Projects</h2>
          <div className="flex flex-wrap gap-2">
            <SelectLike value={stageFilter} options={stageOptions} onChange={setStageFilter} />
            <SelectLike value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          </div>
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
                    <div className="grid gap-y-4" style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(project.stages.length, 1), 9)}, minmax(0, 1fr))` }}>
                      {project.stages.map((stage, stageIndex) => {
                        const state = stageState(stage);
                        return (
                          <div key={stage.id} className="stage-step">
                            <div className={`stage-dot ${state}`}>
                              {state === 'complete' ? '✓' : state === 'active' ? <span /> : null}
                            </div>
                            {stageIndex < project.stages.length - 1 && <div className={`stage-line ${state === 'complete' ? 'complete' : ''}`} />}
                            <p className={`stage-label ${state === 'active' ? 'active' : ''}`} title={stage.name}>{stageLabel(stage.name)}</p>
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
                    <ProjectActions project={project} />
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

function SelectLike<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <label className="relative">
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-11 min-w-[150px] appearance-none rounded-lg border border-[#cad7eb] bg-white px-4 pr-10 text-sm font-semibold text-[#18315e]">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3.5 text-[#284b7c]" size={18} />
    </label>
  );
}

function ProjectActions({ project }: { project: Project }) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  async function setStatus(status: Project['status']) {
    dispatch(upsertProject(await updateProjectStatus(project.id, status)));
  }

  return (
    <div className="group relative inline-block text-left">
      <button className="inline-grid h-9 w-9 place-items-center rounded-full text-[#1d3767] transition hover:bg-[#edf4ff]" title="Project actions">
        <MoreHorizontal size={24} />
      </button>
      <div className="invisible absolute right-0 top-10 z-20 w-44 rounded-lg border border-slate-200 bg-white p-2 text-left opacity-0 shadow-soft transition group-hover:visible group-hover:opacity-100">
        <Link className="menu-action" to={`/projects/${project.productCode}/overview`}>Open Project</Link>
        <Link className="menu-action" to={`/projects/${project.productCode}/${getStageRoute(project.currentStage, project)}`}>View Current Stage</Link>
        {user?.role === 'admin' ? <button className="menu-action" onClick={() => setStatus('Running')}>Mark Running</button> : null}
        {user?.role === 'admin' ? <button className="menu-action" onClick={() => setStatus('On Hold')}>Put On Hold</button> : null}
        {user?.role === 'admin' ? <button className="menu-action" onClick={() => setStatus('Delayed')}>Mark Delayed</button> : null}
        <button className="menu-action" onClick={() => navigator.clipboard?.writeText(project.productCode)}>Copy Project Code</button>
      </div>
    </div>
  );
}
