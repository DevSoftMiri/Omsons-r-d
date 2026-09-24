import type { Project } from '../types';

export function ProgressTracker({ project }: { project: Project }) {
  return (
    <div>
      <div className="h-7 rounded-full bg-slate-200">
        <div className="h-7 rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
      </div>
      <p className="mt-3 text-lg text-slate-700">Progress: {project.progress}%</p>
    </div>
  );
}
