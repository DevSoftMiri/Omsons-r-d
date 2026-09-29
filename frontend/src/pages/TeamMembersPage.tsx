import { ChevronDown, Crown, FolderOpen, MoreHorizontal, Search, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTopBar } from '../components/PageTopBar';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchProjects } from '../services/projectService';
import { setProjects } from '../store';
import type { Project, TeamMember } from '../types';

type TeamStatus = 'Active' | 'Available';
type TeamRow = TeamMember & {
  email?: string;
  designation: string;
  status: TeamStatus;
  assignedProjects: Project[];
  reportingTo?: string;
};

const roleOptions = ['All Roles', 'Admin', 'R&D Manager', 'R&D Engineer', 'Product Designer', 'QA Engineer', 'Staff'] as const;
const statusOptions = ['All Status', 'Active', 'Available'] as const;

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function roleClass(role: string) {
  const key = role.toLowerCase();
  if (key.includes('admin')) return 'team-role admin';
  if (key.includes('manager')) return 'team-role manager';
  if (key.includes('engineer')) return 'team-role engineer';
  if (key.includes('designer')) return 'team-role designer';
  if (key.includes('qa')) return 'team-role qa';
  return 'team-role staff';
}

export function TeamMembersPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const projects = useAppSelector((state) => state.projects.projects);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<(typeof roleOptions)[number]>('All Roles');
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>('All Status');

  useEffect(() => {
    fetchProjects()
      .then((items) => dispatch(setProjects(items)))
      .catch(() => undefined);
  }, [dispatch]);

  const members = useMemo<TeamRow[]>(() => {
    const byName = new Map<string, TeamMember>();
    if (user) {
      byName.set(user.name.toLowerCase(), { id: user.id, name: user.name, role: user.role === 'admin' ? 'Admin' : 'Staff' });
    }
    projects.forEach((project) => {
      project.teamMembers.forEach((member) => byName.set(member.name.toLowerCase(), member));
      if (project.reportTo) {
        const existingMember = byName.get(project.reportTo.toLowerCase());
        byName.set(project.reportTo.toLowerCase(), existingMember || { id: `report-${project.reportTo}`, name: project.reportTo, role: project.reportTo === user?.name && user?.role === 'admin' ? 'Admin' : 'Staff' });
      }
    });

    return Array.from(byName.values()).map((member) => {
      const assignedProjects = projects.filter((project) => (
        project.teamMembers.some((candidate) => candidate.name.toLowerCase() === member.name.toLowerCase())
        || project.reportTo?.toLowerCase() === member.name.toLowerCase()
      ));
      const reportingProject = assignedProjects[0];
      const reportingTo = reportingProject?.reportTo && reportingProject.reportTo.toLowerCase() !== member.name.toLowerCase()
        ? reportingProject.reportTo
        : undefined;
      return {
        ...member,
        designation: member.role,
        email: user?.name.toLowerCase() === member.name.toLowerCase() ? user.email : undefined,
        status: assignedProjects.length ? 'Active' : 'Available',
        assignedProjects,
        reportingTo
      };
    });
  }, [projects, user]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return members.filter((member) => {
      const matchesQuery = !normalizedQuery || `${member.name} ${member.email || ''} ${member.designation}`.toLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter === 'All Roles' || member.designation === roleFilter || member.role === roleFilter;
      const matchesStatus = statusFilter === 'All Status' || member.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [members, query, roleFilter, statusFilter]);

  const adminCount = members.filter((member) => member.role === 'Admin').length;
  const activeProjectMembers = members.filter((member) => member.assignedProjects.length).length;

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="Team Members" subtitle="Manage your R&D team members, roles and project assignments" searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search team members..." />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={UserRound} label="Total Members" value={members.length} tone="blue" />
        <StatCard icon={ShieldCheck} label="Admins" value={adminCount} tone="purple" />
        <StatCard icon={UsersRound} label="Staff Members" value={Math.max(members.length - adminCount, 0)} tone="green" />
        <StatCard icon={FolderOpen} label="Active in Projects" value={activeProjectMembers} tone="orange" />
      </section>

      <section className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#06143d]">Team Members</h2>
            <p className="mt-1 text-sm font-medium text-[#42557d]">View and manage all team members</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox query={query} setQuery={setQuery} placeholder="Search by name, email or role..." wide />
          <SelectLike value={roleFilter} options={roleOptions} onChange={setRoleFilter} />
          <SelectLike value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#0066ff] transition hover:bg-[#f4f8ff]"
            onClick={() => {
              setQuery('');
              setRoleFilter('All Roles');
              setStatusFilter('All Status');
            }}
          >
            <X size={16} />
            Clear Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full border-collapse text-left">
            <thead>
              <tr className="rounded-lg bg-[#f7faff] text-sm font-bold text-[#40577f]">
                <th className="w-12 rounded-l-lg px-4 py-3">#</th>
                <th className="w-[260px] px-4 py-3">Member</th>
                <th className="w-[160px] px-4 py-3">Role</th>
                <th className="w-[250px] px-4 py-3">Assigned Projects</th>
                <th className="w-[180px] px-4 py-3">Reporting To</th>
                <th className="w-[120px] px-4 py-3">Status</th>
                <th className="w-[190px] rounded-r-lg px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member, index) => (
                <tr key={member.id} className="border-b border-[#e2e8f2] last:border-b-0">
                  <td className="px-4 py-4 text-sm font-medium text-[#3f5580]">{index + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} admin={member.role === 'Admin'} />
                      <div>
                        <p className="font-bold text-[#06143d]">{member.name}</p>
                        <p className="text-sm font-medium text-[#53688d]">{member.email || '--'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={roleClass(member.designation)}>
                      {member.designation}
                      {member.role === 'Admin' ? <Crown size={12} /> : null}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {member.assignedProjects.slice(0, 2).map((project) => (
                        <Link key={project.id} to={`/projects/${project.productCode}/overview`} className="rounded-lg bg-[#edf4ff] px-3 py-1.5 text-xs font-bold text-[#244879]">
                          {project.productCode}
                        </Link>
                      ))}
                      {member.assignedProjects.length > 2 ? <span className="grid h-7 w-7 place-items-center rounded-full bg-[#edf2f7] text-xs font-bold text-[#52637f]">+{member.assignedProjects.length - 2}</span> : null}
                      {!member.assignedProjects.length ? <span className="text-sm font-semibold text-[#7a8aa8]">--</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {member.reportingTo ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={member.reportingTo} small />
                        <span className="text-sm font-semibold text-[#20385f]">{member.reportingTo}</span>
                      </div>
                    ) : <span className="text-sm font-semibold text-[#7a8aa8]">--</span>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`team-status ${member.status.toLowerCase()}`}>{member.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    <CurrentProjectAction member={member} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredMembers.length ? (
            <div className="px-4 py-10 text-center">
              <p className="font-bold text-[#06143d]">No team members found</p>
              <p className="mt-1 text-sm text-[#53688d]">Members will appear here when they are assigned to real projects.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SearchBox({ query, setQuery, placeholder, wide = false }: { query: string; setQuery: (value: string) => void; placeholder: string; wide?: boolean }) {
  return (
    <label className={`flex h-11 items-center gap-3 rounded-lg border border-[#d8e2f2] bg-white px-4 text-[#28406e] shadow-sm ${wide ? 'w-full sm:w-[360px]' : 'w-full sm:w-[280px]'}`}>
      <Search size={19} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full border-0 bg-transparent text-sm font-medium outline-none placeholder:text-[#7282a1]" placeholder={placeholder} />
    </label>
  );
}

function SelectLike<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <label className="relative">
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-11 min-w-[145px] appearance-none rounded-lg border border-[#d8e2f2] bg-white px-4 pr-10 text-sm font-semibold text-[#203b66] shadow-sm outline-none">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 text-[#284b7c]" size={18} />
    </label>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof UserRound; label: string; value: number; tone: 'blue' | 'purple' | 'green' | 'orange' }) {
  return (
    <div className="flex h-[86px] items-center justify-between rounded-lg border border-[#dde6f2] bg-white px-5 shadow-[0_12px_35px_rgba(21,40,80,0.07)]">
      <div className="flex items-center gap-4">
        <span className={`team-stat-icon ${tone}`}>
          <Icon size={26} />
        </span>
        <div>
          <p className="text-sm font-semibold text-[#53688d]">{label}</p>
          <p className="mt-1 text-3xl font-bold leading-none text-[#06143d]">{value}</p>
        </div>
      </div>
      <Icon className={`team-stat-mark ${tone}`} size={21} />
    </div>
  );
}

function Avatar({ name, admin = false, small = false }: { name: string; admin?: boolean; small?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full font-bold ${small ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-base'} ${admin ? 'bg-[#6b7cff] text-white' : 'bg-[#fde7d7] text-[#6b2b12]'}`}>
      {initials(name)}
    </span>
  );
}

function CurrentProjectAction({ member }: { member: TeamRow }) {
  const currentProject = member.assignedProjects.find((project) => project.status === 'Running' || project.status === 'Delayed' || project.status === 'On Hold') || member.assignedProjects[0];
  if (!currentProject) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-[#f4f7fb] px-3 py-2 text-sm font-bold text-[#64748b]">
        <MoreHorizontal size={17} />
        No current project
      </span>
    );
  }

  return (
    <Link to={`/projects/${currentProject.productCode}/overview`} className="inline-flex items-center gap-2 rounded-lg bg-[#eaf2ff] px-3 py-2 text-sm font-bold text-[#0066ff] hover:bg-[#dceaff]">
      <FolderOpen size={17} />
      {currentProject.productCode}
      <span className="max-w-[90px] truncate text-[#40577f]">{currentProject.currentStage}</span>
    </Link>
  );
}
