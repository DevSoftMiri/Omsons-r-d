import {
  ArrowRight,
  Box,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  FileText,
  IndianRupee,
  Layers3,
  ListChecks,
  ShoppingCart,
  Users,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BomItem, Project, Stage, CoreStageName } from '../../../types';
import { getStageRoute } from '../../../utils/stages';
import { useProjectWorkspace } from './context';

const statusStyles: Record<Project['status'], string> = {
  Running: 'bg-emerald-100 text-emerald-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  Completed: 'bg-blue-100 text-blue-700',
  Delayed: 'bg-rose-100 text-rose-700'
};

const nextActionText: Record<CoreStageName, string[]> = {
  Prerequisites: ['Upload required certificates', 'Confirm assigned team', 'Complete prerequisite checklist'],
  Benchmarking: ['Review competitor specifications', 'Paste updated benchmark data', 'Mark benchmarking complete'],
  Attachments: ['Upload drawings and design files', 'Preview uploaded documents', 'Confirm file versions'],
  BOM: ['Review material costs', 'Update procurement stages', 'Confirm vendor readiness'],
  'Product Design': ['Upload CAD drawing', 'Review version history', 'Mark design complete'],
  Programming: ['Validate machine parameters', 'Complete PLC logic checklist', 'Run final programming validation'],
  'Testing & Validation': ['Record validation test', 'Attach test report', 'Mark testing complete'],
  'Final Stage': ['Confirm testing status', 'Review production readiness', 'Mark project complete']
};

const customStageActions = ['Update custom checklist', 'Add stage notes', 'Mark custom stage complete'];

export function Overview() {
  const { project } = useProjectWorkspace();
  const completedStages = project.stages.filter((stage) => stage.status === 'Completed').length;
  const currentStage = project.stages.find((stage) => stage.name === project.currentStage);
  const bomTotal = getBomTotal(project);
  const procurementSummary = getProcurementBuckets(project.bom);
  const deadline = getDeadlineStatus(project.targetDate);
  const latestReport = getLatestReport(project);
  const reportOwner = project.reportTo || 'Unassigned';

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
          <div className="grid h-36 w-full shrink-0 place-items-center overflow-hidden rounded-lg bg-slate-100 md:w-40">
            <BeakerVisual />
          </div>

          <div className="min-w-0 flex-1 py-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold leading-tight">{project.name}</h2>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${statusStyles[project.status]}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {project.status}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3 2xl:grid-cols-6">
              <ProductFact label="Product Code" value={project.productCode} />
              <ProductFact label="Category" value="Laboratory Glassware" />
              <ProductFact label="Current Stage" value={project.currentStage} />
              <ProductFact label="Priority" value={project.priority} pill={project.priority === 'High' ? 'danger' : 'neutral'} />
              <div className="border-slate-200 md:border-l md:pl-5">
                <p className="text-xs font-semibold text-slate-500">Report To</p>
                <div className="mt-2 flex items-center gap-3">
                  <Avatar name={reportOwner} tone="blue" />
                  <div>
                    <p className="text-sm font-bold">{reportOwner}</p>
                    <p className="text-xs text-slate-500">Product Manager</p>
                  </div>
                </div>
              </div>
              <div className="border-slate-200 md:border-l md:pl-5">
                <p className="text-xs font-semibold text-slate-500">Target Date</p>
                <div className="mt-2 flex items-start gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-primary">
                    <CalendarDays size={17} />
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

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        <ProgressSummaryCard progress={project.progress} completedStages={completedStages} totalStages={project.stages.length} />
        <DashboardCard icon={CheckCircle2} iconClass="bg-emerald-50 text-emerald-600" label="Completed Stages" value={`${completedStages} / ${project.stages.length}`} helper="Stages completed" />
        <DashboardCard icon={Layers3} iconClass="bg-blue-50 text-primary" label="Current Stage" value={project.currentStage} helper={currentStage?.status === 'In Progress' ? 'In progress' : currentStage?.status ?? 'Pending'} />
        <DashboardCard icon={Clock3} iconClass="bg-amber-50 text-amber-600" label="Deadline Status" value={deadline.state} helper={deadline.label} valueClass={deadline.textClass} />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-lg font-bold">Project Stage Timeline</h3>
          <Link to={`../${getStageRoute(project.currentStage, project)}`} relative="path" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
            View All Stages
            <ArrowRight size={16} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          {project.stages.map((stage, index) => (
            <TimelineStage key={stage.name} stage={stage} index={index} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-100 text-primary">
                <Zap size={21} />
              </span>
              <div>
                <h3 className="text-lg font-bold">Next Action</h3>
                <p className="font-semibold">Continue with {project.currentStage}</p>
                <p className="text-sm text-slate-500">Complete stage deliverables to move to next stage.</p>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {(nextActionText[project.currentStage as CoreStageName] || customStageActions).map((action, index) => (
              <div key={action} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-3">
                  {index === 0 ? <CheckCircle2 className="text-primary" size={19} /> : <Circle className="text-slate-300" size={19} />}
                  <span>{action}</span>
                </div>
                {index === 0 ? <ArrowRight className="text-primary" size={18} /> : null}
              </div>
            ))}
          </div>
          <Link to={`../${getStageRoute(project.currentStage, project)}`} relative="path" className="primary-button mt-5 w-full justify-center">
            Go to {project.currentStage}
            <ArrowRight size={17} />
          </Link>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-primary" />
              <h3 className="text-lg font-bold">Team Members</h3>
            </div>
            <span className="text-sm text-slate-500">{project.teamMembers.length} Members</span>
          </div>
          <div className="space-y-4">
            <TeamRow name={reportOwner} role="Product Manager" badge="Report To" tone="blue" />
            {project.teamMembers.map((member) => (
              <TeamRow key={member.id} name={member.name} role={member.role} badge="Member" />
            ))}
          </div>
          <button className="secondary-button mt-5 w-full justify-center border-dashed text-primary">
            <Users size={16} />
            Add Team Member
          </button>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-5 flex items-center gap-2">
            <Box size={20} className="text-primary" />
            <h3 className="text-lg font-bold">BOM & Cost Summary</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg bg-emerald-50 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                  <IndianRupee size={22} />
                </span>
                <div>
                  <p className="text-sm text-slate-500">Total BOM Cost</p>
                  <p className="text-xl font-bold">Rs. {bomTotal.toLocaleString('en-IN')}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-blue-100 text-primary">
                  <ListChecks size={22} />
                </span>
                <div>
                  <p className="text-sm text-slate-500">BOM Items</p>
                  <p className="text-xl font-bold">{project.bom.length}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-3 flex items-center gap-2 font-bold">
              <ShoppingCart size={18} />
              Procurement Status
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-100 p-3">
              <ProcurementMetric label="Procured" count={procurementSummary.procured} color="bg-emerald-500" />
              <ProcurementMetric label="Ordered" count={procurementSummary.ordered} color="bg-primary" />
              <ProcurementMetric label="Pending" count={procurementSummary.pending} color="bg-slate-400" />
            </div>
          </div>
          <Link to="../bom" relative="path" className="mt-5 inline-flex w-full items-center justify-end gap-2 text-sm font-bold text-primary">
            View BOM
            <ArrowRight size={16} />
          </Link>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              <h3 className="text-lg font-bold">Latest Report</h3>
            </div>
            <Link to="../testing-validation" relative="path" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
              View Validation
              <ArrowRight size={16} />
            </Link>
          </div>
          {latestReport ? (
            <div className="flex gap-4 rounded-lg bg-slate-50 p-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-lg bg-blue-50 text-center">
                <div>
                  <p className="text-xl font-bold">{new Date(latestReport.date).getDate()}</p>
                  <p className="text-xs font-semibold uppercase text-slate-500">{new Date(latestReport.date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</p>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">Daily progress update</p>
                    <p className="text-sm text-slate-500">Submitted by {latestReport.submittedBy} - {latestReport.hours} hours</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{latestReport.status}</span>
                </div>
                <p className="mt-3 text-sm text-slate-600">{latestReport.workDone}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No daily reports have been submitted for this project yet.</div>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText size={20} className="text-primary" />
              <h3 className="text-lg font-bold">Product Description</h3>
            </div>
            <button className="inline-flex items-center gap-2 text-sm font-bold text-primary">
              <Edit3 size={15} />
              Edit
            </button>
          </div>
          <p className="text-sm leading-6 text-slate-600">{project.description}</p>
        </section>
      </div>
    </div>
  );
}

function ProductFact({ label, value, pill }: { label: string; value: string; pill?: 'danger' | 'neutral' }) {
  return (
    <div className="border-slate-200 2xl:border-l 2xl:pl-6">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      {pill ? (
        <span className={`mt-2 inline-flex rounded-full px-4 py-1.5 text-xs font-bold ${pill === 'danger' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>{value}</span>
      ) : (
        <p className="mt-2 text-sm font-bold">{value}</p>
      )}
    </div>
  );
}

function BeakerVisual() {
  return (
    <svg aria-hidden="true" width="112" height="112" className="block shrink-0" viewBox="0 0 120 120" fill="none" style={{ maxWidth: 112, maxHeight: 112 }}>
      <path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" />
      <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M45 82c8 5 22 5 30 0" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <path d="M49 76h22" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 64h21M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 29c-4 2-7 5-8 10" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <path d="M79 29c4 2 8 5 10 10" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" />
    </svg>
  );
}

function ProgressSummaryCard({ progress, completedStages, totalStages }: { progress: number; completedStages: number; totalStages: number }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <div className="flex items-center gap-3">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(#2563eb ${progress * 3.6}deg, #e2e8f0 0deg)` }}
        >
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-base font-bold">{progress}%</div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold">Overall Progress</p>
          <p className="mt-1 text-sm"><span className="font-bold">{completedStages}</span> / {totalStages} stages completed</p>
          <div className="mt-2 h-1.5 rounded-full bg-slate-200">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardCard({ icon: Icon, iconClass, label, value, helper, valueClass = 'text-ink' }: { icon: typeof CheckCircle2; iconClass: string; label: string; value: string; helper: string; valueClass?: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <div className="flex items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${iconClass}`}>
          <Icon size={20} />
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className={`mt-0.5 text-base font-bold ${valueClass}`}>{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{helper}</p>
        </div>
      </div>
    </section>
  );
}

function TimelineStage({ stage, index }: { stage: Stage; index: number }) {
  const complete = stage.status === 'Completed';
  const active = stage.status === 'In Progress';
  const badgeClass = complete ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-blue-100 text-primary' : 'bg-slate-100 text-slate-600';
  const dotClass = complete ? 'bg-emerald-600 text-white' : active ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600';
  const lineClass = complete ? 'bg-emerald-600' : active ? 'bg-primary' : 'bg-slate-300';

  return (
    <Link to={`../${getStageRoute(stage)}`} relative="path" className="group text-center">
      <div className="relative flex items-center justify-center">
        {index > 0 ? <span className={`absolute right-1/2 top-1/2 hidden h-0.5 w-full -translate-y-1/2 2xl:block ${lineClass}`} /> : null}
        <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${dotClass}`}>
          {complete ? <Check size={17} /> : index + 1}
        </span>
      </div>
      <p className="mt-4 text-sm font-bold group-hover:text-primary">{stage.name}</p>
      <span className={`mt-2 inline-flex rounded-md px-3 py-1 text-xs font-bold ${badgeClass}`}>{complete ? 'Completed' : active ? 'In Progress' : 'Not Started'}</span>
    </Link>
  );
}

function TeamRow({ name, role, badge, tone = 'slate' }: { name: string; role: string; badge: string; tone?: 'blue' | 'slate' }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} tone={tone} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{name}</p>
        <p className="truncate text-sm text-slate-500">{role}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${tone === 'blue' ? 'bg-blue-100 text-primary' : 'bg-slate-100 text-slate-600'}`}>{badge}</span>
    </div>
  );
}

function Avatar({ name, tone = 'slate' }: { name: string; tone?: 'blue' | 'slate' }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold ${tone === 'blue' ? 'bg-blue-100 text-primary' : 'bg-slate-200 text-slate-600'}`}>{initials}</span>
  );
}

function ProcurementMetric({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="px-3 text-center">
      <p className="text-2xl font-bold">{count}</p>
      <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-500">
        <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
        {label}
      </div>
    </div>
  );
}

function getBomTotal(project: Project) {
  return project.bom.reduce((sum, item) => sum + item.quantity * item.cost, 0);
}

function getProcurementBuckets(items: BomItem[]) {
  return items.reduce(
    (summary, item) => {
      if (item.procurementStage === 'Procured') summary.procured += 1;
      else if (item.procurementStage === 'Ordered') summary.ordered += 1;
      else summary.pending += 1;
      return summary;
    },
    { procured: 0, ordered: 0, pending: 0 }
  );
}

function getLatestReport(project: Project) {
  return [...project.reports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

function getDeadlineStatus(targetDate: string): { state: string; label: string; textClass: string } {
  const today = new Date();
  const target = new Date(targetDate);
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);

  if (daysRemaining < 0) {
    return { state: 'Overdue', label: `${Math.abs(daysRemaining)} days overdue`, textClass: 'text-rose-700' };
  }

  if (daysRemaining <= 7) {
    return { state: 'Due Soon', label: `${daysRemaining} days remaining`, textClass: 'text-amber-700' };
  }

  return { state: 'On Track', label: `${daysRemaining} days remaining`, textClass: 'text-emerald-700' };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
