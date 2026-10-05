import { ChevronDown, Crown, FolderOpen, KeyRound, MoreHorizontal, Plus, Search, ShieldCheck, Trash2, UserRound, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageTopBar } from '../components/PageTopBar';
import { useToast } from '../components/ToastProvider';
import { useAppDispatch, useAppSelector } from '../hooks';
import { createStaffAccount, fetchStaffAccounts, resetStaffPassword, updateStaffAccount, type StaffAccount } from '../services/authService';
import { addProjectTeamMember, fetchProjects, removeProjectTeamMember } from '../services/projectService';
import { setProjects, upsertProject } from '../store';
import type { Project } from '../types';
import { getMissingFields, showMissingFieldsToast } from '../utils/requiredFields';

type TeamStatus = 'Active' | 'Inactive';
type TeamRow = StaffAccount & {
  status: TeamStatus;
  assignedProjects: Project[];
  reportingProjects: Project[];
};

const roleOptions = ['All Roles', 'Admin', 'Staff', 'R&D Manager', 'R&D Engineer', 'Product Designer', 'QA Engineer'] as const;
const statusOptions = ['All Status', 'Active', 'Inactive'] as const;
const designationOptions = ['Admin', 'Staff', 'R&D Manager', 'R&D Engineer', 'Product Designer', 'QA Engineer'];

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
  const { showToast } = useToast();
  const projects = useAppSelector((state) => state.projects.projects);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<(typeof roleOptions)[number]>('All Roles');
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>('All Status');
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  async function refreshData() {
    const [projectItems, accountItems] = await Promise.all([
      fetchProjects().catch(() => projects),
      fetchStaffAccounts().catch(() => staffAccounts)
    ]);
    dispatch(setProjects(projectItems));
    setStaffAccounts(accountItems);
  }

  const members = useMemo<TeamRow[]>(() => staffAccounts.map((account) => {
    const assignedProjects = projects.filter((project) => project.teamMembers.some((member) => member.id === account._id));
    const reportingProjects = projects.filter((project) => project.reportToId === account._id);
    return {
      ...account,
      status: account.isActive ? 'Active' : 'Inactive',
      assignedProjects,
      reportingProjects
    };
  }), [projects, staffAccounts]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return members.filter((member) => {
      const designation = member.designation || member.role;
      const matchesQuery = !normalizedQuery || `${member.name} ${member.email} ${member.role} ${designation}`.toLowerCase().includes(normalizedQuery);
      const matchesRole = roleFilter === 'All Roles' || member.role === roleFilter || designation === roleFilter;
      const matchesStatus = statusFilter === 'All Status' || member.status === statusFilter;
      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [members, query, roleFilter, statusFilter]);

  const adminCount = members.filter((member) => member.role === 'Admin').length;
  const activeProjectMembers = members.filter((member) => member.assignedProjects.length).length;
  const activeMember = members.find((member) => member._id === activeMemberId) || null;

  function updateAccount(account: StaffAccount) {
    setStaffAccounts((current) => current.some((item) => item._id === account._id)
      ? current.map((item) => item._id === account._id ? account : item)
      : [...current, account]);
  }

  async function assignProject(member: TeamRow, projectId: string) {
    if (!projectId) return;
    try {
      const updated = await addProjectTeamMember(projectId, member._id);
      dispatch(upsertProject(updated));
      showToast({ tone: 'success', title: 'Project assigned', message: `${member.name} was assigned to ${updated.productCode}.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Assignment failed', message: error instanceof Error ? error.message : 'Unable to assign project.' });
    }
  }

  async function removeAssignment(member: TeamRow, project: Project) {
    try {
      const updated = await removeProjectTeamMember(project.id, member._id);
      dispatch(upsertProject(updated));
      showToast({ tone: 'success', title: 'Project removed', message: `${member.name} was removed from ${project.productCode}.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Remove failed', message: error instanceof Error ? error.message : 'Unable to remove project assignment.' });
    }
  }

  async function toggleMemberStatus(member: TeamRow) {
    setStatusSavingId(member._id);
    try {
      const updated = await updateStaffAccount(member._id, {
        name: member.name,
        email: member.email,
        designation: member.designation || member.role,
        role: member.role,
        isActive: !member.isActive
      });
      updateAccount(updated);
      showToast({ tone: 'success', title: updated.isActive ? 'Team member activated' : 'Team member deactivated' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Status update failed', message: error instanceof Error ? error.message : 'Unable to update team member status.' });
    } finally {
      setStatusSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="Team Members" subtitle="Manage your R&D team members, roles and project assignments" searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search team members..." actionLabel="Add Staff Member" onAction={() => setIsAddOpen(true)} />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={UserRound} label="Total Members" value={members.length} tone="blue" />
        <StatCard icon={ShieldCheck} label="Admins" value={adminCount} tone="purple" />
        <StatCard icon={UsersRound} label="Staff Members" value={Math.max(members.length - adminCount, 0)} tone="green" />
        <StatCard icon={FolderOpen} label="Assigned Staff" value={activeProjectMembers} tone="orange" />
      </section>

      <section className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#06143d]">Team Members</h2>
            <p className="mt-1 text-sm font-medium text-[#42557d]">Assign projects, update roles, and reset passwords from Actions.</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SearchBox query={query} setQuery={setQuery} placeholder="Search by name, email or role..." wide />
          <SelectLike value={roleFilter} options={roleOptions} onChange={setRoleFilter} />
          <SelectLike value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          <button className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#0066ff] transition hover:bg-[#f4f8ff]" onClick={() => { setQuery(''); setRoleFilter('All Roles'); setStatusFilter('All Status'); }}>
            <X size={16} />
            Clear Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full border-collapse text-left">
            <thead>
              <tr className="rounded-lg bg-[#f7faff] text-sm font-bold text-[#40577f]">
                <th className="w-12 rounded-l-lg px-4 py-3">#</th>
                <th className="w-[270px] px-4 py-3">Member</th>
                <th className="w-[150px] px-4 py-3">Role</th>
                <th className="w-[170px] px-4 py-3">Designation</th>
                <th className="w-[260px] px-4 py-3">Assigned Projects</th>
                <th className="w-[140px] px-4 py-3">Status</th>
                <th className="w-[140px] rounded-r-lg px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member, index) => (
                <tr key={member._id} className="border-b border-[#e2e8f2] last:border-b-0">
                  <td className="px-4 py-4 text-sm font-medium text-[#3f5580]">{index + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={member.name} admin={member.role === 'Admin'} />
                      <div>
                        <p className="font-bold text-[#06143d]">{member.name}</p>
                        <p className="text-sm font-medium text-[#53688d]">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={roleClass(member.role)}>
                      {member.role}
                      {member.role === 'Admin' ? <Crown size={12} /> : null}
                    </span>
                  </td>
                  <td className="px-4 py-4"><span className={roleClass(member.designation || member.role)}>{member.designation || member.role}</span></td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {member.assignedProjects.slice(0, 3).map((project) => (
                        <Link key={project.id} to={`/projects/${project.productCode}/overview`} className="rounded-lg bg-[#edf4ff] px-3 py-1.5 text-xs font-bold text-[#244879]">{project.productCode}</Link>
                      ))}
                      {member.assignedProjects.length > 3 ? <span className="grid h-7 w-7 place-items-center rounded-full bg-[#edf2f7] text-xs font-bold text-[#52637f]">+{member.assignedProjects.length - 3}</span> : null}
                      {!member.assignedProjects.length ? <span className="text-sm font-semibold text-[#7a8aa8]">--</span> : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      className={`team-status ${member.status.toLowerCase()} disabled:cursor-wait disabled:opacity-70`}
                      disabled={statusSavingId === member._id}
                      title={member.isActive ? 'Click to make inactive' : 'Click to make active'}
                      onClick={() => toggleMemberStatus(member)}
                    >
                      {statusSavingId === member._id ? 'Saving...' : member.status}
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8e2f2] px-3 text-sm font-bold text-[#28406e] hover:bg-[#f4f8ff]" onClick={() => setActiveMemberId(member._id)}>
                      <MoreHorizontal size={16} />
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredMembers.length ? (
            <div className="px-4 py-10 text-center">
              <p className="font-bold text-[#06143d]">No team members found</p>
              <p className="mt-1 text-sm text-[#53688d]">Create accounts to assign team members to projects.</p>
            </div>
          ) : null}
        </div>
      </section>

      {isAddOpen ? <AddStaffDialog onClose={() => setIsAddOpen(false)} onSaved={(account) => { updateAccount(account); setIsAddOpen(false); }} showToast={showToast} /> : null}
      {activeMember ? (
        <ManageMemberDialog
          member={activeMember}
          projects={projects}
          onAssign={(projectId) => assignProject(activeMember, projectId)}
          onClose={() => setActiveMemberId(null)}
          onRemove={(project) => removeAssignment(activeMember, project)}
          onSaved={(account) => {
            updateAccount(account);
            void refreshData();
          }}
          showToast={showToast}
        />
      ) : null}
    </div>
  );
}

function AddStaffDialog({ onClose, onSaved, showToast }: { onClose: () => void; onSaved: (account: StaffAccount) => void; showToast: (toast: { tone: 'success' | 'error'; title: string; message?: string }) => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', designation: 'Staff', role: 'Staff' as 'Staff' | 'Admin' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const missing = getMissingFields([
      { label: 'Full Name', value: form.name },
      { label: 'Login Email', value: form.email },
      { label: 'Password', value: form.password },
      { label: 'Role', value: form.role },
      { label: 'Password with at least 8 characters', valid: form.password.length >= 8 }
    ]);
    if (showMissingFieldsToast(showToast, missing)) return;
    setSaving(true);
    try {
      const account = await createStaffAccount(form);
      onSaved(account);
      showToast({ tone: 'success', title: 'Account created' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create staff account');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <form noValidate onSubmit={submit} className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div><h3 className="text-xl font-bold">Add Team Member</h3><p className="mt-1 text-sm text-slate-500">Create login credentials for the new account.</p></div>
          <button type="button" className="icon-button h-9 w-9" onClick={onClose}><X size={16} /></button>
        </div>
        <StaffFields form={form} setForm={setForm} includePassword />
        {error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-button h-10" onClick={onClose}>Cancel</button>
          <button className="primary-button h-10" disabled={saving}><Plus size={16} />{saving ? 'Creating...' : 'Create Account'}</button>
        </div>
      </form>
    </div>
  );
}

function ManageMemberDialog({ member, projects, onAssign, onClose, onRemove, onSaved, showToast }: { member: TeamRow; projects: Project[]; onAssign: (projectId: string) => void; onClose: () => void; onRemove: (project: Project) => void; onSaved: (account: StaffAccount) => void; showToast: (toast: { tone: 'success' | 'error'; title: string; message?: string }) => void }) {
  const [form, setForm] = useState({ name: member.name, email: member.email, password: '', designation: member.designation || member.role, role: member.role, isActive: member.isActive });
  const [projectId, setProjectId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const availableProjects = projects.filter((project) => !member.assignedProjects.some((assigned) => assigned.id === project.id));
  const canAssignAsTeamMember = member.role === 'Staff';

  async function saveDetails() {
    const missing = getMissingFields([
      { label: 'Full Name', value: form.name },
      { label: 'Login Email', value: form.email },
      { label: 'Role', value: form.role },
      { label: 'Designation', value: form.designation }
    ]);
    if (showMissingFieldsToast(showToast, missing)) return;
    setSavingDetails(true);
    try {
      const updated = await updateStaffAccount(member._id, form);
      onSaved(updated);
      showToast({ tone: 'success', title: 'Team member updated' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Update failed', message: error instanceof Error ? error.message : 'Unable to update team member.' });
    } finally {
      setSavingDetails(false);
    }
  }

  async function savePassword() {
    const missing = getMissingFields([{ label: 'Password with at least 8 characters', valid: newPassword.length >= 8 }]);
    if (showMissingFieldsToast(showToast, missing)) return;
    setSavingPassword(true);
    try {
      await resetStaffPassword(member._id, newPassword);
      setNewPassword('');
      showToast({ tone: 'success', title: 'Password reset' });
    } catch (error) {
      showToast({ tone: 'error', title: 'Password reset failed', message: error instanceof Error ? error.message : 'Unable to reset password.' });
    } finally {
      setSavingPassword(false);
    }
  }

  async function assignSelectedProject() {
    if (showMissingFieldsToast(showToast, projectId ? [] : ['Project'])) return;
    setAssigning(true);
    try {
      await onAssign(projectId);
      setProjectId('');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="fixed inset-y-0 left-0 right-0 z-50 grid place-items-center bg-[#06143d]/30 p-5 backdrop-blur-sm sm:p-6 lg:left-[292px] lg:p-8">
      <button type="button" aria-label="Close manage team member popup" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative flex max-h-[calc(100vh-3rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-white/70 bg-white shadow-[0_24px_80px_rgba(6,20,61,0.25)] sm:max-h-[calc(100vh-4rem)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#f8fbff] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={member.name} admin={member.role === 'Admin'} />
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-[#06143d]">Manage Team Member</h2>
              <p className="truncate text-sm font-semibold text-[#53688d]">{member.name} · {member.email}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className={`team-status ${member.status.toLowerCase()}`}>{member.status}</span>
            <button className="icon-button h-9 w-9 bg-white" onClick={onClose} title="Close"><X size={18} /></button>
          </div>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-[#06143d]">Account Details</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">Update login details, role, designation, and account access.</p>
              </div>
              <span className={roleClass(member.designation || member.role)}>{member.designation || member.role}</span>
            </div>
            <StaffFields form={form} setForm={setForm} />
            <div className="mt-5 flex justify-end">
              <button className="primary-button h-10 min-w-32 justify-center" onClick={saveDetails} disabled={savingDetails}>{savingDetails ? 'Saving...' : 'Save Details'}</button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:row-span-2">
            <h3 className="font-bold text-[#06143d]">Assigned Projects</h3>
            <div className="mt-3 grid gap-2">
              {member.assignedProjects.map((project) => (
                <div key={project.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <Link className="min-w-0 flex-1 font-bold text-primary" to={`/projects/${project.productCode}/overview`}>{project.productCode} - {project.name}</Link>
                  <button className="icon-button h-8 w-8 text-rose-600" title="Remove from project" onClick={() => onRemove(project)}><Trash2 size={15} /></button>
                </div>
              ))}
              {!member.assignedProjects.length ? <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No project assignments yet.</p> : null}
            </div>
            {canAssignAsTeamMember ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <select className="field h-10" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                  <option value="">Select project</option>
                  {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.productCode} - {project.name}</option>)}
                </select>
                <button className="secondary-button h-10 shrink-0 justify-center text-primary" onClick={assignSelectedProject} disabled={assigning}>{assigning ? 'Assigning...' : 'Assign'}</button>
              </div>
            ) : <p className="mt-3 text-sm font-semibold text-slate-500">Admins can be selected as reporting owners, not ordinary team members.</p>}
          </section>

          {member.reportingProjects.length ? (
            <section className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
              <h3 className="font-bold text-[#06143d]">Reporting Owner For</h3>
              <div className="mt-3 grid gap-2">
                {member.reportingProjects.map((project) => <Link key={project.id} className="font-bold text-primary" to={`/projects/${project.productCode}/overview`}>{project.productCode} - {project.name}</Link>)}
              </div>
            </section>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="font-bold text-[#06143d]">Reset Password</h3>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input className="field h-10" type="password" value={newPassword} placeholder="New password" onChange={(event) => setNewPassword(event.target.value)} />
              <button className="secondary-button h-10 shrink-0 justify-center text-primary" onClick={savePassword} disabled={savingPassword}><KeyRound size={15} />{savingPassword ? 'Resetting...' : 'Reset'}</button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function StaffFields({ form, setForm, includePassword = false }: { form: { name: string; email: string; password?: string; designation: string; role: 'Staff' | 'Admin'; isActive?: boolean }; setForm: (form: any) => void; includePassword?: boolean }) {
  const availableDesignations = form.role === 'Admin' ? ['Admin'] : designationOptions.filter((item) => item !== 'Admin');

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="Full Name"><input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="Role"><select className="field" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as 'Staff' | 'Admin', designation: event.target.value === 'Admin' ? 'Admin' : form.designation === 'Admin' ? 'Staff' : form.designation })}><option value="Staff">Staff</option><option value="Admin">Admin</option></select></Field>
      <Field label="Login Email"><input className="field" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
      <Field label="Designation"><select className="field" value={form.designation} onChange={(event) => setForm({ ...form, designation: event.target.value })}>{availableDesignations.map((item) => <option key={item}>{item}</option>)}</select></Field>
      {includePassword ? <Field label="Password"><input className="field" type="password" value={form.password || ''} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Field> : null}
      {!includePassword ? <label className="mt-7 flex items-center gap-2 text-sm font-bold text-slate-600"><input type="checkbox" checked={form.isActive ?? true} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active account</label> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}{children}</label>;
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
        <span className={`team-stat-icon ${tone}`}><Icon size={26} /></span>
        <div>
          <p className="text-sm font-semibold text-[#53688d]">{label}</p>
          <p className="mt-1 text-3xl font-bold leading-none text-[#06143d]">{value}</p>
        </div>
      </div>
      <Icon className={`team-stat-mark ${tone}`} size={21} />
    </div>
  );
}

function Avatar({ name, admin = false }: { name: string; admin?: boolean }) {
  return <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold ${admin ? 'bg-[#6b7cff] text-white' : 'bg-[#fde7d7] text-[#6b2b12]'}`}>{initials(name)}</span>;
}
