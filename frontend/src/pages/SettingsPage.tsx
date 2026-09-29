import { GripVertical, Pencil, Plus, Save } from 'lucide-react';
import { useState } from 'react';
import { PageTopBar } from '../components/PageTopBar';
import { useToast } from '../components/ToastProvider';
import { readSettings, saveSettings, type AppSettings, type WorkflowSetting } from '../services/adminModuleStorage';

const sections = ['General', 'Project Workflow', 'Roles & Permissions', 'Project Defaults', 'Notifications', 'Documents'];
const permissionRows = ['View Projects', 'Create Projects', 'Edit Projects', 'Delete Projects', 'Manage Team', 'Manage Vendors', 'Manage Certificates', 'Generate Reports', 'Manage Settings'];
const roles = ['Admin', 'Manager', 'Staff'];
const notificationLabels: Array<[keyof AppSettings['notifications'], string]> = [
  ['projectAssignment', 'Project Assignment'],
  ['stageCompleted', 'Stage Completed'],
  ['stageChanged', 'Stage Changed'],
  ['projectDeadlineApproaching', 'Project Deadline Approaching'],
  ['projectOverdue', 'Project Overdue'],
  ['certificateExpiring', 'Certificate Expiring'],
  ['certificateExpired', 'Certificate Expired']
];
const documentTypes = ['PDF', 'DOC/DOCX', 'XLS/XLSX', 'JPG/JPEG', 'PNG'];

export function SettingsPage() {
  const { showToast } = useToast();
  const [active, setActive] = useState(sections[0]);
  const [settings, setSettings] = useState<AppSettings>(() => readSettings());
  const [draggedStage, setDraggedStage] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState('');
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState(() => defaultPermissions());
  const [newRole, setNewRole] = useState('');

  function persist(next = settings) {
    saveSettings(next);
    showToast({ tone: 'success', title: 'Settings saved' });
  }

  function updateSettings(next: AppSettings) {
    setSettings(next);
  }

  function moveStage(stageId: string, targetId: string) {
    if (stageId === targetId) return;
    const from = settings.workflow.findIndex((stage) => stage.id === stageId);
    const to = settings.workflow.findIndex((stage) => stage.id === targetId);
    if (from < 0 || to < 0) return;
    const workflow = [...settings.workflow];
    const [stage] = workflow.splice(from, 1);
    workflow.splice(to, 0, stage);
    updateSettings({ ...settings, workflow });
  }

  function addStage() {
    const name = newStageName.trim();
    if (!name) return;
    const finalIndex = settings.workflow.findIndex((stage) => stage.name === 'Final Stage');
    const workflow = [...settings.workflow];
    workflow.splice(finalIndex < 0 ? workflow.length : finalIndex, 0, { id: crypto.randomUUID(), name, description: `${name} stage tasks and approvals.`, active: true, required: false });
    updateSettings({ ...settings, workflow });
    setNewStageName('');
  }

  function patchStage(stageId: string, patch: Partial<WorkflowSetting>) {
    updateSettings({ ...settings, workflow: settings.workflow.map((stage) => stage.id === stageId ? { ...stage, ...patch } : stage) });
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="Settings" subtitle="Configure the R&D system" />

      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        <aside className="rounded-lg border border-[#dde6f2] bg-white p-3 shadow-sm">
          {sections.map((section) => <button key={section} className={`mb-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold ${active === section ? 'bg-[#eaf2ff] text-[#0066ff]' : 'text-[#243b67] hover:bg-[#f7faff]'}`} onClick={() => setActive(section)}>{section}</button>)}
        </aside>

        <main className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
          {active === 'General' ? (
            <Panel title="General Settings" onSave={() => persist()}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Company Name"><input className="field" value={settings.general.companyName} onChange={(event) => updateSettings({ ...settings, general: { ...settings.general, companyName: event.target.value } })} /></Field>
                <Field label="Company Logo"><input className="field" type="file" /></Field>
                <Field label="Company Email"><input className="field" value={settings.general.companyEmail} onChange={(event) => updateSettings({ ...settings, general: { ...settings.general, companyEmail: event.target.value } })} /></Field>
                <Field label="Phone"><input className="field" value={settings.general.phone} onChange={(event) => updateSettings({ ...settings, general: { ...settings.general, phone: event.target.value } })} /></Field>
                <Field label="Country"><input className="field" value={settings.general.country} onChange={(event) => updateSettings({ ...settings, general: { ...settings.general, country: event.target.value } })} /></Field>
                <Field label="Timezone"><input className="field" value={settings.general.timezone} onChange={(event) => updateSettings({ ...settings, general: { ...settings.general, timezone: event.target.value } })} /></Field>
                <Field label="Date Format"><select className="field" value={settings.general.dateFormat} onChange={(event) => updateSettings({ ...settings, general: { ...settings.general, dateFormat: event.target.value } })}><option>DD MMM YYYY</option><option>YYYY-MM-DD</option><option>MM/DD/YYYY</option></select></Field>
              </div>
            </Panel>
          ) : null}

          {active === 'Project Workflow' ? (
            <Panel title="Project Workflow" onSave={() => persist()}>
              <div className="mb-4 flex gap-2">
                <input className="field" value={newStageName} onChange={(event) => setNewStageName(event.target.value)} placeholder="Add new stage" />
                <button className="secondary-button h-11 shrink-0" onClick={addStage}><Plus size={16} />Add Stage</button>
              </div>
              <div className="grid gap-2">
                {settings.workflow.map((stage, index) => (
                  <div
                    key={stage.id}
                    draggable={!stage.required}
                    onDragStart={() => setDraggedStage(stage.id)}
                    onDragOver={(event) => { if (draggedStage && draggedStage !== stage.id && !stage.required) event.preventDefault(); }}
                    onDrop={(event) => { event.preventDefault(); if (draggedStage) moveStage(draggedStage, stage.id); setDraggedStage(null); }}
                    onDragEnd={() => setDraggedStage(null)}
                    className="flex items-center gap-3 rounded-lg border border-[#d8e2f2] bg-[#f8fbff] p-3"
                  >
                    <GripVertical className={stage.required ? 'text-slate-300' : 'text-[#0066ff]'} size={18} />
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-sm font-bold text-[#53688d]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      {editingStageId === stage.id ? <input className="field h-9" value={stage.name} onChange={(event) => patchStage(stage.id, { name: event.target.value })} /> : <p className="font-bold text-[#06143d]">{stage.name} {stage.required ? <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-[#0066ff]">Required Stage</span> : null}</p>}
                      <input className="mt-1 w-full bg-transparent text-sm font-medium text-[#53688d] outline-none" value={stage.description} onChange={(event) => patchStage(stage.id, { description: event.target.value })} />
                    </div>
                    <Toggle checked={stage.active} disabled={stage.required} onChange={(checked) => patchStage(stage.id, { active: checked })} />
                    <button className="icon-button h-9 w-9" onClick={() => setEditingStageId(editingStageId === stage.id ? null : stage.id)}><Pencil size={16} /></button>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs font-semibold text-[#53688d]">Active workflow stages are used by project creation and project stage displays. Overview and Final Stage remain protected system stages.</p>
            </Panel>
          ) : null}

          {active === 'Roles & Permissions' ? (
            <Panel title="Roles & Permissions" onSave={() => { window.localStorage.setItem('omsons-permissions', JSON.stringify(permissions)); persist(); }}>
              <div className="mb-4 flex gap-2">
                <input className="field" value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="Role Name" />
                <button className="secondary-button h-11 shrink-0" onClick={() => { if (!newRole.trim()) return; setPermissions({ ...permissions, [newRole.trim()]: Object.fromEntries(permissionRows.map((row) => [row, false])) as Record<string, boolean> }); setNewRole(''); }}><Plus size={16} />Create Role</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-left">
                  <thead><tr className="bg-[#f7faff] text-sm font-bold text-[#40577f]"><th className="px-4 py-3">Permission</th>{Object.keys(permissions).map((role) => <th key={role} className="px-4 py-3">{role}</th>)}</tr></thead>
                  <tbody>{permissionRows.map((permission) => <tr key={permission} className="border-b border-slate-200"><td className="px-4 py-3 font-semibold text-[#20385f]">{permission}</td>{Object.keys(permissions).map((role) => <td key={role} className="px-4 py-3"><input type="checkbox" checked={permissions[role][permission]} onChange={(event) => setPermissions({ ...permissions, [role]: { ...permissions[role], [permission]: event.target.checked } })} /></td>)}</tr>)}</tbody>
                </table>
              </div>
              <p className="mt-3 text-xs font-semibold text-[#53688d]">Permissions are persisted for route/action checks; visible controls can read this saved matrix as modules expand.</p>
            </Panel>
          ) : null}

          {active === 'Project Defaults' ? (
            <Panel title="Project Defaults" onSave={() => persist()}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Default Project Status"><select className="field" value={settings.defaults.status} onChange={(event) => updateSettings({ ...settings, defaults: { ...settings.defaults, status: event.target.value } })}>{['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled', 'Running'].map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Default Priority"><select className="field" value={settings.defaults.priority} onChange={(event) => updateSettings({ ...settings, defaults: { ...settings.defaults, priority: event.target.value } })}>{['Low', 'Medium', 'High', 'Critical'].map((item) => <option key={item}>{item}</option>)}</select></Field>
                <Field label="Project Code Format"><input className="field" value={settings.defaults.codeFormat} onChange={(event) => updateSettings({ ...settings, defaults: { ...settings.defaults, codeFormat: event.target.value } })} /></Field>
                <label className="mt-7 flex items-center gap-3 font-bold text-[#20385f]"><input type="checkbox" checked={settings.defaults.autoCode} onChange={(event) => updateSettings({ ...settings, defaults: { ...settings.defaults, autoCode: event.target.checked } })} />Automatic project code generation</label>
              </div>
            </Panel>
          ) : null}

          {active === 'Notifications' ? (
            <Panel title="Notifications" onSave={() => persist()}>
              <div className="grid gap-3 md:grid-cols-2">{notificationLabels.map(([key, label]) => <SettingToggle key={key} label={label} checked={Boolean(settings.notifications[key])} onChange={(checked) => updateSettings({ ...settings, notifications: { ...settings.notifications, [key]: checked } })} />)}</div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Field label="Deadline reminder days before"><input type="number" className="field" value={settings.notifications.deadlineReminderDays} onChange={(event) => updateSettings({ ...settings, notifications: { ...settings.notifications, deadlineReminderDays: Number(event.target.value) } })} /></Field>
                <Field label="Certificate expiry reminder days before"><input type="number" className="field" value={settings.notifications.certificateReminderDays} onChange={(event) => updateSettings({ ...settings, notifications: { ...settings.notifications, certificateReminderDays: Number(event.target.value) } })} /></Field>
              </div>
            </Panel>
          ) : null}

          {active === 'Documents' ? (
            <Panel title="Document Settings" onSave={() => persist()}>
              <Field label="Maximum Upload Size (MB)"><input type="number" className="field max-w-xs" value={settings.documents.maxUploadSize} onChange={(event) => updateSettings({ ...settings, documents: { ...settings.documents, maxUploadSize: Number(event.target.value) } })} /></Field>
              <div className="mt-4 grid gap-2 md:grid-cols-3">{documentTypes.map((type) => <label key={type} className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm font-bold text-[#20385f]"><input type="checkbox" checked={settings.documents.allowedTypes.includes(type)} onChange={(event) => updateSettings({ ...settings, documents: { ...settings.documents, allowedTypes: event.target.checked ? [...settings.documents.allowedTypes, type] : settings.documents.allowedTypes.filter((item) => item !== type) } })} />{type}</label>)}</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <SettingToggle label="Allow document deletion" checked={settings.documents.allowDeletion} onChange={(checked) => updateSettings({ ...settings, documents: { ...settings.documents, allowDeletion: checked } })} />
                <SettingToggle label="Allow document download" checked={settings.documents.allowDownload} onChange={(checked) => updateSettings({ ...settings, documents: { ...settings.documents, allowDownload: checked } })} />
                <SettingToggle label="Require document description" checked={settings.documents.requireDescription} onChange={(checked) => updateSettings({ ...settings, documents: { ...settings.documents, requireDescription: checked } })} />
              </div>
            </Panel>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function Panel({ title, children, onSave }: { title: string; children: React.ReactNode; onSave: () => void }) {
  return <section><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-xl font-bold text-[#06143d]">{title}</h2><div className="flex gap-2"><button className="secondary-button h-10" onClick={() => window.location.reload()}>Cancel</button><button className="primary-button h-10" onClick={onSave}><Save size={16} />Save Changes</button></div></div>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-[#20385f]">{label}</span>{children}</label>;
}

function Toggle({ checked, disabled = false, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`h-6 w-11 rounded-full p-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-[#0066ff]' : 'bg-slate-300'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} /></button>;
}

function SettingToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-[#f8fbff] p-3"><span className="font-bold text-[#20385f]">{label}</span><Toggle checked={checked} onChange={onChange} /></div>;
}

function defaultPermissions() {
  const saved = window.localStorage.getItem('omsons-permissions');
  if (saved) return JSON.parse(saved) as Record<string, Record<string, boolean>>;
  return Object.fromEntries(roles.map((role) => [role, Object.fromEntries(permissionRows.map((permission) => [permission, role === 'Admin' || (role === 'Manager' && !['Delete Projects', 'Manage Team', 'Manage Settings'].includes(permission)) || (role === 'Staff' && ['View Projects', 'Edit Projects', 'Manage Certificates'].includes(permission))]))])) as Record<string, Record<string, boolean>>;
}
