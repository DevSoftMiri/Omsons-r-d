import { CalendarDays } from 'lucide-react';
import type { Project } from '../types';

const statusStyles: Record<Project['status'], string> = {
  Running: 'bg-emerald-100 text-emerald-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  Completed: 'bg-blue-100 text-blue-700',
  Delayed: 'bg-rose-100 text-rose-700'
};

const priorityStyles: Record<Project['priority'], string> = {
  Low: 'bg-emerald-50 text-emerald-700',
  Medium: 'bg-slate-100 text-slate-700',
  High: 'bg-rose-100 text-rose-600'
};

export function ProjectStageHeader({ project, currentStage, statusOverride }: { project: Project; currentStage: string; statusOverride?: string }) {
  const deadline = getDeadlineStatus(project.targetDate);
  const reportTo = project.reportTo || 'Ravi';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-soft">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <div className="grid h-20 w-full shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 md:w-32">
          <ProductVisual category={project.category} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold leading-tight text-ink">{project.name}</h2>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${statusStyles[project.status]}`}>
              <span className="h-2 w-2 rounded-full bg-current" />
              {statusOverride || project.status}
            </span>
          </div>

          <div className="mt-2.5 grid gap-2.5 md:grid-cols-3 xl:grid-cols-6">
            <HeaderFact label="Product Code" value={project.productCode} />
            <HeaderFact label="Category" value="Laboratory Glassware" />
            <HeaderFact label="Current Stage" value={currentStage} />
            <HeaderFact label="Priority" value={project.priority} pillClass={priorityStyles[project.priority]} />
            <div className="border-slate-200 xl:border-l xl:pl-5">
              <p className="text-xs font-semibold text-slate-500">Report To</p>
              <div className="mt-2 flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-100 text-xs font-bold text-primary">{initials(reportTo)}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{reportTo}</p>
                  <p className="text-xs text-slate-500">Product Manager</p>
                </div>
              </div>
            </div>
            <div className="border-slate-200 xl:border-l xl:pl-5">
              <p className="text-xs font-semibold text-slate-500">Target Date</p>
              <div className="mt-2 flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-primary">
                  <CalendarDays size={15} />
                </span>
                <div>
                  <p className="text-sm font-bold">{formatDate(project.targetDate)}</p>
                  <p className={`text-xs font-semibold ${deadline.textClass}`}>{deadline.label}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeaderFact({ label, value, pillClass }: { label: string; value: string; pillClass?: string }) {
  return (
    <div className="border-slate-200 xl:border-l xl:pl-5 first:xl:border-l-0 first:xl:pl-0">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-2 text-sm font-bold leading-6">
        {pillClass ? <span className={`inline-flex rounded-full px-4 py-1.5 ${pillClass}`}>{value}</span> : value}
      </div>
    </div>
  );
}

function ProductVisual({ category }: { category: string }) {
  const isFlask = category.toLowerCase().includes('flask');
  return (
    <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none">
      {isFlask ? (
        <>
          <path d="M41 20h38" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
          <path d="M51 22v22L39 84c-3 11 5 20 18 20h6c13 0 21-9 18-20L69 44V22" fill="#f8fafc" />
          <path d="M51 22v22L39 84c-3 11 5 20 18 20h6c13 0 21-9 18-20L69 44V22" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M45 75c9 6 21 6 30 0" stroke="#bfdbfe" strokeWidth="8" strokeLinecap="round" />
          <path d="M50 56h20M48 67h24M46 78h28" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <path d="M38 30c-4 2-7 5-8 10M82 30c4 2 7 5 8 10" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
          <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" />
          <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M49 76h22M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" />
        </>
      )}
    </svg>
  );
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function getDeadlineStatus(targetDate: string) {
  const today = new Date();
  const target = new Date(targetDate);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
  if (daysRemaining < 0) return { label: `${Math.abs(daysRemaining)} days overdue`, textClass: 'text-rose-700' };
  return { label: `${daysRemaining} days remaining`, textClass: daysRemaining <= 7 ? 'text-amber-700' : 'text-emerald-700' };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
