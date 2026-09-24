import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Project } from '../types';

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <div className="border-b border-slate-200 bg-white px-5 py-5 lg:px-8">
      <Link to="/projects" className="inline-flex items-center gap-3 text-xl font-bold hover:text-primary">
        <ArrowLeft size={18} />
        {project.name}
      </Link>
    </div>
  );
}
