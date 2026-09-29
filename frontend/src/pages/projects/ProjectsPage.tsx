import { ArrowRight, CalendarDays, ChevronDown, Flag, Grid2X2, List, MoreVertical, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTopBar } from '../../components/PageTopBar';
import { useAppDispatch, useAppSelector } from '../../hooks';
import { fetchProjects } from '../../services/projectService';
import { setProjects } from '../../store';
import type { Project, ProjectStatus } from '../../types';

const cardStages = [
  { label: 'Overview', names: ['Prerequisites'] },
  { label: 'Prerequisites', names: ['Prerequisites'] },
  { label: 'Benchmarking', names: ['Benchmarking', 'Attachments', 'BOM'] },
  { label: 'Design', names: ['Product Design'] },
  { label: 'Programming', names: ['Programming', 'Reporting'] },
  { label: 'Testing', names: ['Testing & Validation'] },
  { label: 'Final', names: ['Final Stage'] }
];

const statusOptions = ['All Status', 'Running', 'On Hold', 'Completed', 'Delayed'] as const;
const stageOptions = ['All Stages', 'Product Design', 'Programming', 'Testing & Validation', 'Final Stage'] as const;

function statusLabel(status: ProjectStatus) {
  if (status === 'Delayed') return 'At Risk';
  if (status === 'Running') return 'On Track';
  return status;
}

function stageState(project: Project, index: number) {
  const activeIndex = cardStages.findIndex((stage) => stage.names.includes(project.currentStage));
  const progressIndex = activeIndex >= 0 ? activeIndex : Math.min(Math.floor(project.progress / 15), cardStages.length - 1);
  if (project.progress >= 100 || index < progressIndex) return 'complete';
  if (index === progressIndex) return 'active';
  return 'pending';
}

function displayDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'Not set';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function ProjectsPage() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<(typeof stageOptions)[number]>('All Stages');
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>('All Status');

  useEffect(() => {
    let active = true;
    fetchProjects()
      .then((items) => {
        if (!active) return;
        dispatch(setProjects(items));
        setError('');
      })
      .catch((loadError) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load projects');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [dispatch]);

  const visibleProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesSearch = !normalizedQuery || `${project.productCode} ${project.name} ${project.currentStage}`.toLowerCase().includes(normalizedQuery);
      const matchesStage = stageFilter === 'All Stages' || project.currentStage === stageFilter;
      const matchesStatus = statusFilter === 'All Status' || project.status === statusFilter;
      return matchesSearch && matchesStage && matchesStatus;
    });
  }, [projects, query, stageFilter, statusFilter]);

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="Projects" subtitle="All product R&D projects" searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search projects..." actionLabel="Create Project" actionHref="/projects/create" />

      <div className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <SelectLike value={stageFilter} options={stageOptions} onChange={setStageFilter} />
          <SelectLike value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#0066ff] transition hover:bg-white"
            onClick={() => {
              setQuery('');
              setStageFilter('All Stages');
              setStatusFilter('All Status');
            }}
          >
            <X size={16} />
            Clear Filters
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-medium text-[#42557d]">Sort by:</span>
          <button className="inline-flex h-11 items-center gap-8 rounded-lg border border-[#d8e2f2] bg-white px-4 text-base font-semibold text-[#18315e] shadow-sm">
            Latest Created
            <ChevronDown size={19} />
          </button>
          <div className="flex rounded-lg bg-white p-1 shadow-sm">
            <button className="grid h-10 w-10 place-items-center rounded-md bg-[#0066ff] text-white" title="Grid view">
              <Grid2X2 size={19} />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-md text-[#345078]" title="List view">
              <List size={20} />
            </button>
          </div>
        </div>
      </div>

      {loading ? <div className="panel text-center text-sm text-slate-500">Loading projects...</div> : null}
      {error ? <div className="panel text-center text-sm font-semibold text-rose-600">{error}</div> : null}

      {!loading && !error ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {visibleProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {!visibleProjects.length ? (
            <div className="panel col-span-full text-center">
              <p className="font-bold">No projects found</p>
              <p className="mt-1 text-sm text-slate-500">Clear filters or create a new project to get started.</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SelectLike<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <label className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 min-w-[145px] appearance-none rounded-lg border border-[#d8e2f2] bg-white px-4 pr-10 text-base font-semibold text-[#203b66] shadow-sm outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 text-[#284b7c]" size={18} />
    </label>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const lead = project.teamMembers[0]?.name;
  const staff = project.teamMembers.slice(1, 4);
  const extraCount = Math.max(project.teamMembers.length - 4, 0);

  return (
    <article className="rounded-lg border border-[#dde6f2] bg-white p-4 shadow-[0_14px_42px_rgba(21,40,80,0.07)]">
      <div className="flex items-start gap-5">
        <ProductThumb project={project} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold leading-6 text-[#06143d]">{project.productCode}</h3>
              <p className="mt-1 text-base font-medium text-[#4a5e83]">{project.name}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className={`project-card-status ${project.status.toLowerCase().replace(' ', '-')}`}>{statusLabel(project.status)}</span>
              <button className="grid h-8 w-6 place-items-center text-[#21406d]" title="Project actions">
                <MoreVertical size={20} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between gap-5">
            <div>
              <p className="text-sm font-semibold text-[#56698c]">Current Stage</p>
              <p className="text-lg font-bold leading-5 text-[#06143d]">{project.currentStage}</p>
            </div>
            <div className="w-[185px] shrink-0">
              <p className="mb-2 text-sm font-medium text-[#4a5e83]">Progress <span className="font-bold text-[#0066ff]">{project.progress}%</span></p>
              <div className="h-2 rounded-full bg-[#dfe5ed]">
                <div className="h-2 rounded-full bg-[#0066ff]" style={{ width: `${Math.min(project.progress, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex overflow-hidden">
        {cardStages.map((stage, index) => {
          const state = stageState(project, index);
          return (
            <div key={stage.label} className="project-stage-step">
              <div className={`project-stage-dot ${state}`}>{state === 'complete' ? '✓' : state === 'active' ? <span /> : null}</div>
              {index < cardStages.length - 1 && <div className={`project-stage-line ${state === 'complete' ? 'complete' : ''}`} />}
              <p className={`project-stage-label ${state === 'active' ? 'active' : ''}`}>{stage.label}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-[#e0e7f0] pt-3">
        <div className="grid gap-4 md:grid-cols-3">
          <CardPerson label="Project Lead" name={lead} />
          <div>
            <p className="text-sm font-medium text-[#53688d]">Assigned Staff</p>
            <div className="mt-2 flex items-center">
              {staff.map((member, index) => (
                <span key={member.id} className="-ml-1 first:ml-0 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#dbeafe] text-[10px] font-bold text-[#153c78]" title={member.name}>
                  {initials(member.name)}
                </span>
              ))}
              {extraCount ? <span className="-ml-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#eef2f7] text-xs font-bold text-[#52637f]">+{extraCount}</span> : null}
              {!staff.length ? <span className="text-sm font-semibold text-[#7a8aa8]">--</span> : null}
            </div>
          </div>
          <CardPerson label="Reporting To" name={project.reportTo} />
        </div>

        <div className="mt-4 grid items-end gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          <CardDate label="Start Date" value={project.startDate} />
          <CardDate label="Target Date" value={project.targetDate} />
          <div className="flex items-center gap-3">
            <Flag className={project.priority === 'High' ? 'text-rose-500' : project.priority === 'Medium' ? 'text-orange-500' : 'text-emerald-500'} size={22} />
            <div>
              <p className="text-sm font-medium text-[#53688d]">Priority</p>
              <span className={`priority-pill ${project.priority.toLowerCase()}`}>{project.priority}</span>
            </div>
          </div>
          <Link to={`/projects/${project.productCode}/overview`} className="inline-flex h-12 min-w-[110px] items-center justify-center gap-2 rounded-lg bg-[#eaf2ff] px-5 text-base font-bold text-[#0066ff] transition hover:bg-[#dceaff]">
            Open
            <ArrowRight size={19} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function CardPerson({ label, name }: { label: string; name?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-[#53688d]">{label}</p>
      {name ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#fde7d7] text-[10px] font-bold text-[#6b2b12]">{initials(name)}</span>
          <span className="text-sm font-semibold text-[#20385f]">{name}</span>
        </div>
      ) : <p className="mt-2 text-sm font-semibold text-[#7a8aa8]">--</p>}
    </div>
  );
}

function CardDate({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <CalendarDays className="text-[#35557f]" size={21} />
      <div>
        <p className="text-sm font-medium text-[#53688d]">{label}</p>
        <p className="text-sm font-semibold text-[#20385f]">{displayDate(value)}</p>
      </div>
    </div>
  );
}

function ProductThumb({ project }: { project: Project }) {
  const lowerName = project.name.toLowerCase();
  const isCup = lowerName.includes('cup') || lowerName.includes('mug');
  const isTumbler = lowerName.includes('tumbler');
  const isJar = lowerName.includes('jar');

  return (
    <div className="grid h-[82px] w-[88px] shrink-0 place-items-center rounded-lg border border-slate-200 bg-gradient-to-br from-white to-slate-100">
      <div className={`${isCup ? 'glass-cup' : isTumbler ? 'glass-tumbler' : isJar ? 'glass-jar' : 'glass-bottle'}`} />
    </div>
  );
}
