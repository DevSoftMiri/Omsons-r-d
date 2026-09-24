import { CalendarClock, CheckCircle2, FlaskConical, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../hooks';

export function DashboardPage() {
  const projects = useAppSelector((state) => state.projects.projects);
  const stats = [
    { label: 'Active Projects', value: projects.filter((item) => item.status === 'Running').length, note: 'Running', icon: FlaskConical },
    { label: 'On Hold', value: projects.filter((item) => item.status === 'On Hold').length, note: 'Projects', icon: CalendarClock },
    { label: 'Completed', value: projects.filter((item) => item.status === 'Completed').length + 11, note: 'Ready', icon: CheckCircle2 },
    { label: 'Team Members', value: 18, note: 'Staff', icon: Users }
  ];

  return (
    <div className="space-y-6 p-5 lg:p-8">
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="panel">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{stat.label}</p>
              <stat.icon className="text-primary" size={20} />
            </div>
            <p className="mt-4 text-3xl font-bold">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title">Project Overview</h2>
          <Link to="/projects" className="secondary-button">View All</Link>
        </div>
        <div className="grid gap-3">
          {projects.map((project) => (
            <Link key={project.id} to={`/projects/${project.productCode}/overview`} className="rounded-lg border border-slate-200 p-4 transition hover:border-primary hover:bg-mist">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{project.name}</p>
                  <p className="text-sm text-slate-500">{project.currentStage}</p>
                </div>
                <span className={`status ${project.status.toLowerCase().replace(' ', '-')}`}>{project.status}</span>
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
