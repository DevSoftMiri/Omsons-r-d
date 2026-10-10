import { ArrowDown, ArrowLeft, ArrowUp, Plus, X } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import {
  addProjectStage,
  reorderProjectStages,
} from '../services/projectService';
import { upsertProject } from '../store';
import type { Project } from '../types';
import { getStageRoute } from '../utils/stages';

const statusColor = {
  Locked: 'bg-slate-300',
  Pending: 'bg-slate-400',
  'In Progress': 'bg-primary',
  Submitted: 'bg-amber-500',
  Completed: 'bg-emerald-500',
};

export function ProjectSidebar({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate?: () => void;
}) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [adding, setAdding] = useState(false);
  const [stageName, setStageName] = useState('');
  const [saving, setSaving] = useState(false);
  const [reorderingStage, setReorderingStage] = useState('');
  const [error, setError] = useState('');
  const itemCount = project.stages.length + 1;

  function renderStageName(stage: Project['stages'][number]) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        {stage.status === 'Completed' ? (
          <span
            className="project-sidebar-dot shrink-0 rounded-full bg-emerald-500"
            title="Completed"
          />
        ) : null}
        <span className="truncate">{stage.name}</span>
      </span>
    );
  }

  async function submitStage() {
    const name = stageName.trim();
    if (!name) {
      setError('Stage name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      dispatch(upsertProject(await addProjectStage(project.id, name)));
      setStageName('');
      setAdding(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add stage');
    } finally {
      setSaving(false);
    }
  }

  async function moveStage(stageIndex: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? stageIndex - 1 : stageIndex + 1;
    if (
      stageIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= project.stages.length
    )
      return;
    if (
      project.stages[stageIndex].name === 'Final Stage' ||
      project.stages[targetIndex].name === 'Final Stage'
    )
      return;

    const orderedStages = project.stages.map((stage) => stage.name);
    const [stageName] = orderedStages.splice(stageIndex, 1);
    orderedStages.splice(targetIndex, 0, stageName);
    setReorderingStage(project.stages[stageIndex].id);
    setError('');
    try {
      dispatch(
        upsertProject(await reorderProjectStages(project.id, orderedStages)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reorder stages');
    } finally {
      setReorderingStage('');
    }
  }

  return (
    <aside
      className="project-sidebar border-b border-[#333333] bg-[#333333] p-3 text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-hidden lg:border-b-0"
      style={{ '--sidebar-items': itemCount } as CSSProperties}
    >
      <Link
        to="/projects"
        className="project-sidebar-back flex items-center gap-2 rounded-lg px-3 py-2 font-bold text-white hover:bg-white/10"
        onClick={onNavigate}
      >
        <ArrowLeft size={16} />
        <span className="truncate">{project.name}</span>
      </Link>
      <div className="project-sidebar-card rounded-lg bg-white/5 p-4">
        <p className="project-sidebar-code font-bold text-white">
          {project.productCode}
        </p>
        <p className="project-sidebar-category mt-1 font-bold">
          {project.category}
        </p>
      </div>
      {user?.role === 'admin' ? (
        <div className="mb-2">
          {adding ? (
            <div className="rounded-lg bg-white/10 p-2">
              <input
                className="h-8 w-full rounded-md border border-white/10 bg-[#333333] px-2 text-xs font-semibold text-white outline-none placeholder:text-white/60 focus:border-white"
                placeholder="New stage name"
                value={stageName}
                onChange={(event) => setStageName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void submitStage();
                  if (event.key === 'Escape') setAdding(false);
                }}
              />
              {error ? (
                <p className="mt-1 text-xs font-semibold text-rose-200">
                  {error}
                </p>
              ) : null}
              <div className="mt-2 flex gap-2">
                <button
                  className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 text-xs font-bold text-white disabled:opacity-60"
                  disabled={saving}
                  onClick={submitStage}
                >
                  <Plus size={13} />
                  {saving ? 'Adding...' : 'Add'}
                </button>
                <button
                  className="grid h-7 w-8 place-items-center rounded-md bg-white/10 text-white hover:bg-white/15"
                  title="Cancel"
                  onClick={() => {
                    setAdding(false);
                    setError('');
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 text-xs font-bold text-white hover:bg-white/10"
              onClick={() => setAdding(true)}
            >
              <Plus size={14} />
              Add Stage
            </button>
          )}
        </div>
      ) : null}
      <nav className="project-sidebar-nav grid">
        <NavLink
          to="overview"
          onClick={onNavigate}
          className={({ isActive }) =>
            `project-sidebar-link flex items-center justify-between rounded-lg px-4 font-semibold ${isActive ? 'bg-primary text-white' : 'text-white hover:bg-white/10'}`
          }
        >
          <span>Overview</span>
        </NavLink>
        {project.stages.map((stage, index) => {
          const locked = stage.status === 'Locked';
          const canOpen = !locked || stage.name === 'Final Stage';
          const canReorder =
            user?.role === 'admin' && stage.name !== 'Final Stage';
          const canMoveUp = canReorder && index > 0;
          const canMoveDown = canReorder && index < project.stages.length - 2;
          const reorderControls = canReorder ? (
            <span className="ml-2 flex shrink-0 items-center gap-1">
              <button
                className="grid h-6 w-6 place-items-center rounded-md text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                disabled={!canMoveUp || Boolean(reorderingStage)}
                title="Move stage up"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void moveStage(index, 'up');
                }}
              >
                <ArrowUp size={13} />
              </button>
              <button
                className="grid h-6 w-6 place-items-center rounded-md text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                disabled={!canMoveDown || Boolean(reorderingStage)}
                title="Move stage down"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void moveStage(index, 'down');
                }}
              >
                <ArrowDown size={13} />
              </button>
            </span>
          ) : null;
          if (!canOpen) {
            return (
              <span
                key={stage.id}
                className="project-sidebar-link flex cursor-not-allowed items-center justify-between rounded-lg px-4 font-semibold text-white/60"
                title="Complete the previous stage first"
              >
                {renderStageName(stage)}
                <span className="flex items-center gap-2">
                  {reorderControls}
                  <span
                    className={`project-sidebar-dot rounded-full ${statusColor[stage.status]}`}
                    title={stage.status}
                  />
                </span>
              </span>
            );
          }
          return (
            <NavLink
              key={stage.id}
              to={getStageRoute(stage)}
              onClick={onNavigate}
              className={({ isActive }) =>
                `project-sidebar-link flex items-center justify-between rounded-lg px-4 font-semibold ${isActive ? 'bg-primary text-white' : locked ? 'text-white/70 hover:bg-white/10' : 'text-white hover:bg-white/10'}`
              }
            >
              {renderStageName(stage)}
              <span className="flex items-center gap-2">
                {reorderControls}
                <span
                  className={`project-sidebar-dot rounded-full ${statusColor[stage.status]}`}
                  title={stage.status}
                />
              </span>
            </NavLink>
          );
        })}
      </nav>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-rose-200">{error}</p>
      ) : null}
    </aside>
  );
}
