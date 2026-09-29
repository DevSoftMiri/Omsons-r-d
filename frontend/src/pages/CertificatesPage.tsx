import { Download, Eye, FileBadge, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageTopBar } from '../components/PageTopBar';
import { useToast } from '../components/ToastProvider';
import { useAppDispatch, useAppSelector } from '../hooks';
import { certificateStatus, certificateTypes, readCertificates, saveCertificates, type CertificateRecord } from '../services/adminModuleStorage';
import { fetchProjects } from '../services/projectService';
import { setProjects } from '../store';

const emptyCertificate: Omit<CertificateRecord, 'id' | 'createdAt'> = {
  name: '',
  number: '',
  type: 'Product Certificate',
  projectId: '',
  product: '',
  vendor: '',
  authority: '',
  issueDate: '',
  expiryDate: '',
  notes: '',
  documentName: ''
};

export function CertificatesPage() {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const { showToast } = useToast();
  const [certificates, setCertificates] = useState<CertificateRecord[]>(() => readCertificates());
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('All Projects');
  const [typeFilter, setTypeFilter] = useState('All Types');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [drawerMode, setDrawerMode] = useState<'add' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCertificate);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects().then((items) => dispatch(setProjects(items))).catch(() => undefined);
  }, [dispatch]);

  useEffect(() => {
    saveCertificates(certificates);
  }, [certificates]);

  const filtered = useMemo(() => certificates.filter((certificate) => {
    const status = certificateStatus(certificate.expiryDate);
    const project = projects.find((item) => item.id === certificate.projectId || item.productCode === certificate.projectId);
    const haystack = `${certificate.name} ${certificate.number} ${certificate.type} ${certificate.authority} ${project?.name || ''} ${project?.productCode || ''}`.toLowerCase();
    return (!query || haystack.includes(query.toLowerCase()))
      && (projectFilter === 'All Projects' || certificate.projectId === projectFilter)
      && (typeFilter === 'All Types' || certificate.type === typeFilter)
      && (statusFilter === 'All Status' || status === statusFilter);
  }), [certificates, projectFilter, projects, query, statusFilter, typeFilter]);

  const counts = {
    total: certificates.length,
    valid: certificates.filter((item) => certificateStatus(item.expiryDate) === 'Valid').length,
    soon: certificates.filter((item) => certificateStatus(item.expiryDate) === 'Expiring Soon').length,
    expired: certificates.filter((item) => certificateStatus(item.expiryDate) === 'Expired').length
  };

  function openAdd() {
    setForm({ ...emptyCertificate, projectId: projects[0]?.id || '' });
    setEditingId(null);
    setErrors({});
    setDrawerMode('add');
  }

  function openCertificate(certificate: CertificateRecord, mode: 'edit' | 'view') {
    setForm({
      name: certificate.name,
      number: certificate.number,
      type: certificate.type,
      projectId: certificate.projectId,
      product: certificate.product,
      vendor: certificate.vendor,
      authority: certificate.authority,
      issueDate: certificate.issueDate,
      expiryDate: certificate.expiryDate,
      notes: certificate.notes,
      documentName: certificate.documentName
    });
    setEditingId(certificate.id);
    setErrors({});
    setDrawerMode(mode);
  }

  function validate() {
    const next: Record<string, string> = {};
    ['name', 'number', 'type', 'projectId', 'authority', 'issueDate', 'expiryDate', 'documentName'].forEach((field) => {
      if (!String(form[field as keyof typeof form] || '').trim()) next[field] = 'Required';
    });
    setErrors(next);
    return !Object.keys(next).length;
  }

  function saveCertificate() {
    if (!validate()) return;
    if (drawerMode === 'edit' && editingId) {
      setCertificates((current) => current.map((item) => item.id === editingId ? { ...item, ...form } : item));
      showToast({ tone: 'success', title: 'Certificate updated' });
    } else {
      setCertificates((current) => [{ ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...current]);
      showToast({ tone: 'success', title: 'Certificate created' });
    }
    setDrawerMode(null);
  }

  function confirmDelete() {
    setCertificates((current) => current.filter((item) => item.id !== deleteId));
    setDeleteId(null);
    showToast({ tone: 'success', title: 'Certificate deleted' });
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="Certificates" subtitle="Manage product, testing and compliance certificates" searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search certificates..." actionLabel="Add Certificate" onAction={openAdd} />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Certificates" value={counts.total} />
        <Stat label="Valid" value={counts.valid} tone="green" />
        <Stat label="Expiring Soon" value={counts.soon} tone="orange" />
        <Stat label="Expired" value={counts.expired} tone="red" />
      </section>

      <section className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
        <div className="mb-4 flex flex-wrap gap-3">
          <Select value={projectFilter} onChange={setProjectFilter} options={['All Projects', ...projects.map((project) => project.id)]} labels={Object.fromEntries(projects.map((project) => [project.id, project.productCode]))} />
          <Select value={typeFilter} onChange={setTypeFilter} options={['All Types', ...certificateTypes]} />
          <Select value={statusFilter} onChange={setStatusFilter} options={['All Status', 'Valid', 'Expiring Soon', 'Expired', 'Pending']} />
          <button className="secondary-button h-11" onClick={() => { setQuery(''); setProjectFilter('All Projects'); setTypeFilter('All Types'); setStatusFilter('All Status'); }}>Clear Filters</button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left">
            <thead><tr className="bg-[#f7faff] text-sm font-bold text-[#40577f]">{['Certificate', 'Certificate No.', 'Type', 'Project / Product', 'Issued By', 'Issue Date', 'Expiry Date', 'Status', 'Actions'].map((head) => <th key={head} className="px-4 py-3 first:rounded-l-lg last:rounded-r-lg">{head}</th>)}</tr></thead>
            <tbody>
              {filtered.map((certificate) => {
                const project = projects.find((item) => item.id === certificate.projectId);
                const status = certificateStatus(certificate.expiryDate);
                return (
                  <tr key={certificate.id} className="border-b border-[#e2e8f2] last:border-b-0">
                    <td className="px-4 py-4 font-bold text-[#06143d]"><button onClick={() => openCertificate(certificate, 'view')} className="hover:text-[#0066ff]">{certificate.name}</button><p className="text-sm font-medium text-[#53688d]">{certificate.documentName}</p></td>
                    <td className="px-4 py-4 text-sm font-semibold text-[#20385f]">{certificate.number}</td>
                    <td className="px-4 py-4"><Badge>{certificate.type}</Badge></td>
                    <td className="px-4 py-4 text-sm font-semibold text-[#20385f]">{project?.productCode || '--'}<p className="text-xs text-[#53688d]">{certificate.product || project?.name}</p></td>
                    <td className="px-4 py-4 text-sm font-semibold text-[#20385f]">{certificate.authority}</td>
                    <td className="px-4 py-4 text-sm text-[#53688d]">{certificate.issueDate}</td>
                    <td className="px-4 py-4 text-sm text-[#53688d]">{certificate.expiryDate}</td>
                    <td className="px-4 py-4"><StatusBadge status={status} /></td>
                    <td className="px-4 py-4"><div className="flex gap-1">
                      <button className="icon-button h-8 w-8" title="View Certificate" onClick={() => openCertificate(certificate, 'view')}><Eye size={15} /></button>
                      <button className="icon-button h-8 w-8" title="Edit" onClick={() => openCertificate(certificate, 'edit')}><Pencil size={15} /></button>
                      <button className="icon-button h-8 w-8" title="Download Document" onClick={() => showToast({ tone: 'success', title: 'Document ready', message: certificate.documentName })}><Download size={15} /></button>
                      <button className="icon-button h-8 w-8 text-rose-600" title="Delete" onClick={() => setDeleteId(certificate.id)}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filtered.length ? <EmptyState /> : null}
        </div>
      </section>

      {drawerMode ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#06143d]/30 backdrop-blur-sm">
          <aside className="h-full w-full max-w-[520px] overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5">
              <h2 className="text-xl font-bold text-[#06143d]">{drawerMode === 'view' ? 'Certificate Details' : drawerMode === 'edit' ? 'Edit Certificate' : 'Add Certificate'}</h2>
              <button className="icon-button h-9 w-9" onClick={() => setDrawerMode(null)}><X size={18} /></button>
            </div>
            <div className="grid gap-3 p-5">
              <CertField label="Certificate Name" error={errors.name}><input disabled={drawerMode === 'view'} className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></CertField>
              <CertField label="Certificate Number" error={errors.number}><input disabled={drawerMode === 'view'} className="field" value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} /></CertField>
              <CertField label="Certificate Type" error={errors.type}><select disabled={drawerMode === 'view'} className="field" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{certificateTypes.map((type) => <option key={type}>{type}</option>)}</select></CertField>
              <CertField label="Associated Project" error={errors.projectId}><select disabled={drawerMode === 'view'} className="field" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}><option value="">Select project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.productCode} - {project.name}</option>)}</select></CertField>
              <CertField label="Associated Product"><input disabled={drawerMode === 'view'} className="field" value={form.product} onChange={(event) => setForm({ ...form, product: event.target.value })} /></CertField>
              <CertField label="Vendor (optional)"><input disabled={drawerMode === 'view'} className="field" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} /></CertField>
              <CertField label="Issuing Authority" error={errors.authority}><input disabled={drawerMode === 'view'} className="field" value={form.authority} onChange={(event) => setForm({ ...form, authority: event.target.value })} /></CertField>
              <div className="grid gap-3 md:grid-cols-2">
                <CertField label="Issue Date" error={errors.issueDate}><input disabled={drawerMode === 'view'} type="date" className="field" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} /></CertField>
                <CertField label="Expiry Date" error={errors.expiryDate}><input disabled={drawerMode === 'view'} type="date" className="field" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} /></CertField>
              </div>
              <CertField label="Upload Certificate Document" error={errors.documentName}><input disabled={drawerMode === 'view'} type="file" className="field" onChange={(event) => setForm({ ...form, documentName: event.target.files?.[0]?.name || form.documentName })} />{form.documentName ? <p className="mt-1 text-xs font-semibold text-[#53688d]">{form.documentName}</p> : null}</CertField>
              <CertField label="Description / Notes"><textarea disabled={drawerMode === 'view'} className="field min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></CertField>
              <div><span className="mb-1.5 block text-sm font-bold text-slate-600">Status</span><StatusBadge status={certificateStatus(form.expiryDate)} /></div>
            </div>
            {drawerMode !== 'view' ? <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white p-5"><button className="secondary-button h-10" onClick={() => setDrawerMode(null)}>Cancel</button><button className="primary-button h-10" onClick={saveCertificate}>Save Certificate</button></div> : null}
          </aside>
        </div>
      ) : null}

      {deleteId ? <Confirm title="Delete certificate?" onCancel={() => setDeleteId(null)} onConfirm={confirmDelete} /> : null}
    </div>
  );
}

function Stat({ label, value, tone = 'blue' }: { label: string; value: number; tone?: 'blue' | 'green' | 'orange' | 'red' }) {
  const colors = { blue: 'text-[#0066ff] bg-[#eaf2ff]', green: 'text-[#00834f] bg-[#d9f7eb]', orange: 'text-[#d06b00] bg-[#fff0d2]', red: 'text-[#e11d48] bg-[#ffdce5]' };
  return <div className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-sm"><FileBadge className={`mb-3 rounded-lg p-2 ${colors[tone]}`} size={42} /><p className="text-sm font-semibold text-[#53688d]">{label}</p><p className="mt-1 text-3xl font-bold text-[#06143d]">{value}</p></div>;
}

function Select({ value, onChange, options, labels = {} }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return <select className="h-11 rounded-lg border border-[#d8e2f2] bg-white px-3 text-sm font-semibold text-[#203b66]" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{labels[option] || option}</option>)}</select>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-lg bg-[#eaf2ff] px-3 py-1.5 text-xs font-bold text-[#0066ff]">{children}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const className = status === 'Valid' ? 'bg-[#d9f7eb] text-[#00834f]' : status === 'Expiring Soon' ? 'bg-[#fff0d2] text-[#d06b00]' : status === 'Expired' ? 'bg-[#ffdce5] text-[#e11d48]' : 'bg-[#edf2f7] text-[#64748b]';
  return <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${className}`}>{status}</span>;
}

function CertField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-600">{label} {['Certificate Name', 'Certificate Number', 'Certificate Type', 'Associated Project', 'Issuing Authority', 'Issue Date', 'Expiry Date', 'Upload Certificate Document'].includes(label) ? <span className="text-rose-600">*</span> : null}</span>{children}{error ? <span className="mt-1 block text-xs font-bold text-rose-600">{error}</span> : null}</label>;
}

function EmptyState() {
  return <div className="py-12 text-center text-sm text-[#53688d]"><FileBadge className="mx-auto mb-3 text-[#7a8aa8]" size={36} /><p className="font-bold text-[#06143d]">No certificates found</p><p>Certificates will appear here when you add them.</p></div>;
}

function Confirm({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-[#06143d]/30 px-4"><div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-2xl"><p className="text-lg font-bold text-[#06143d]">{title}</p><p className="mt-1 text-sm text-slate-600">This action cannot be undone.</p><div className="mt-5 flex justify-end gap-3"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button bg-rose-600 hover:bg-rose-700" onClick={onConfirm}>Delete</button></div></div></div>;
}
