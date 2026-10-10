import { CheckCircle2, ChevronDown, Clock3, Mail, MoreHorizontal, PackageCheck, Phone, Plus, Search, Store, UsersRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageTopBar } from '../components/PageTopBar';
import { useToast } from '../components/ToastProvider';
import { useAppDispatch, useAppSelector } from '../hooks';
import { fetchProjects } from '../services/projectService';
import { createVendor, fetchVendors, updateVendor, type VendorPaymentType, type VendorRecord, type VendorStatus } from '../services/vendorService';
import { setProjects } from '../store';
import type { Project } from '../types';
import { getMissingFields, showMissingFieldsToast } from '../utils/requiredFields';

interface VendorRow {
  id: string;
  persisted: boolean;
  name: string;
  code?: string;
  category: string;
  contactPerson: string;
  designation?: string;
  phone?: string;
  email?: string;
  location?: string;
  suppliedComponents: string;
  paymentType: VendorPaymentType;
  advancePercentage: number;
  creditDays: number;
  paymentTerms?: string;
  projects: Project[];
  status: VendorStatus;
  preferred: boolean;
  notes?: string;
}

const categoryOptions = ['All Categories', 'Raw Material', 'Packaging', 'Component', 'Service', 'Tooling', 'Testing'] as const;
const statusOptions = ['All Status', 'Active', 'Inactive'] as const;

const emptyForm = {
  name: '',
  code: '',
  category: '',
  contactPerson: '',
  designation: '',
  phone: '',
  email: '',
  location: '',
  supply: '',
  projectId: '',
  paymentType: 'Advance' as VendorPaymentType,
  advancePercentage: '',
  creditDays: '',
  paymentTerms: '',
  preferred: true,
  status: 'Active' as VendorStatus,
  notes: ''
};

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function categoryFromText(value: string) {
  const text = value.toLowerCase();
  if (text.includes('pack')) return 'Packaging';
  if (text.includes('tool') || text.includes('mould') || text.includes('mold')) return 'Tooling';
  if (text.includes('test') || text.includes('lab')) return 'Testing';
  if (text.includes('component')) return 'Component';
  return 'Raw Material';
}

function paymentSummary(vendor: VendorRow) {
  if (vendor.paymentType === 'Credit') return `Credit ${vendor.creditDays || 0} days`;
  return `Advance ${vendor.advancePercentage || 0}%`;
}

function mapSavedVendor(vendor: VendorRecord, projects: Project[]): VendorRow {
  return {
    ...vendor,
    persisted: true,
    projects: projects.filter((project) =>
      project.bom.some((item) => item.vendor?.trim().toLowerCase() === vendor.name.trim().toLowerCase())
    )
  };
}

function buildVendorsFromProjects(projects: Project[]): VendorRow[] {
  const byVendor = new Map<string, VendorRow>();

  projects.forEach((project) => {
    project.bom.forEach((item) => {
      const name = item.vendor?.trim();
      if (!name) return;

      const key = name.toLowerCase();
      const existing = byVendor.get(key);
      if (existing) {
        if (!existing.projects.some((candidate) => candidate.id === project.id)) {
          existing.projects.push(project);
        }
        return;
      }

      byVendor.set(key, {
        id: `bom-${key}`,
        persisted: false,
        name,
        code: '',
        category: categoryFromText(item.materialName),
        contactPerson: '',
        designation: '',
        phone: '',
        email: '',
        location: '',
        suppliedComponents: item.materialName,
        paymentType: 'Advance',
        advancePercentage: 0,
        creditDays: 0,
        paymentTerms: '',
        projects: [project],
        status: 'Active',
        preferred: false,
        notes: ''
      });
    });
  });

  return Array.from(byVendor.values());
}

export function VendorsPage() {
  const dispatch = useAppDispatch();
  const { showToast } = useToast();
  const projects = useAppSelector((state) => state.projects.projects);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<(typeof categoryOptions)[number]>('All Categories');
  const [statusFilter, setStatusFilter] = useState<(typeof statusOptions)[number]>('All Status');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [savedVendors, setSavedVendors] = useState<VendorRecord[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchProjects()
      .then((items) => dispatch(setProjects(items)))
      .catch(() => undefined);
  }, [dispatch]);

  useEffect(() => {
    setVendorsLoading(true);
    fetchVendors()
      .then(setSavedVendors)
      .catch((error) => {
        showToast({
          tone: 'error',
          title: 'Unable to load vendors',
          message: error instanceof Error ? error.message : 'Please try again.'
        });
      })
      .finally(() => setVendorsLoading(false));
  }, [showToast]);

  const vendors = useMemo(() => {
    const savedRows = savedVendors.map((vendor) => mapSavedVendor(vendor, projects));
    const savedNames = new Set(savedRows.map((vendor) => vendor.name.trim().toLowerCase()));
    const bomRows = buildVendorsFromProjects(projects).filter((vendor) => !savedNames.has(vendor.name.trim().toLowerCase()));
    return [...savedRows, ...bomRows];
  }, [projects, savedVendors]);
  const filteredVendors = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const searchable = `${vendor.name} ${vendor.contactPerson} ${vendor.category} ${vendor.email || ''}`.toLowerCase();
      const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
      const matchesCategory = categoryFilter === 'All Categories' || vendor.category === categoryFilter;
      const matchesStatus = statusFilter === 'All Status' || vendor.status === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [categoryFilter, query, statusFilter, vendors]);

  const activeCount = vendors.filter((vendor) => vendor.status === 'Active').length;
  const linkedCount = vendors.filter((vendor) => vendor.projects.length > 0).length;

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingVendorId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = getMissingFields([
      { label: 'Vendor / Company Name', value: form.name },
      { label: 'Category', value: form.category },
      { label: 'Contact Person', value: form.contactPerson },
      { label: 'Components / Materials Supplied', value: form.supply },
      { label: 'Payment Type', value: form.paymentType },
      { label: 'Status', value: form.status }
    ]);
    if (showMissingFieldsToast(showToast, missing)) return;

    const advancePercentage = Number(form.advancePercentage || 0);
    const creditDays = Number(form.creditDays || 0);
    if (form.paymentType === 'Advance' && (!Number.isFinite(advancePercentage) || advancePercentage < 0 || advancePercentage > 100)) {
      showToast({ tone: 'error', title: 'Check advance percentage', message: 'Advance percentage must be between 0 and 100.' });
      return;
    }
    if (form.paymentType === 'Credit' && (!Number.isFinite(creditDays) || creditDays <= 0)) {
      showToast({ tone: 'error', title: 'Check credit days', message: 'Credit days must be greater than 0.' });
      return;
    }

    const linkedProject = projects.find((project) => project.id === form.projectId);
    const category = form.category || categoryFromText(form.supply);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      category,
      contactPerson: form.contactPerson.trim(),
      designation: form.designation.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      location: form.location.trim(),
      suppliedComponents: form.supply.trim(),
      paymentType: form.paymentType,
      advancePercentage: form.paymentType === 'Advance' ? advancePercentage : 0,
      creditDays: form.paymentType === 'Credit' ? creditDays : 0,
      paymentTerms: form.paymentTerms.trim(),
      status: form.status,
      preferred: form.preferred,
      notes: form.notes.trim()
    };

    try {
      const editingSavedVendor = savedVendors.some((vendor) => vendor.id === editingVendorId);
      const saved = editingVendorId && editingSavedVendor
        ? await updateVendor(editingVendorId, payload)
        : await createVendor(payload);
      setSavedVendors((current) => {
        if (editingSavedVendor) return current.map((vendor) => vendor.id === saved.id ? saved : vendor);
        return [...current, saved];
      });
      if (linkedProject && !linkedProject.bom.some((item) => item.vendor?.trim().toLowerCase() === saved.name.trim().toLowerCase())) {
        showToast({ tone: 'success', title: 'Vendor saved', message: 'Project assignment is shown when the vendor is used in a project BOM.' });
      } else {
        showToast({ tone: 'success', title: editingSavedVendor ? 'Vendor updated' : 'Vendor added' });
      }
      closeForm();
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Unable to save vendor',
        message: error instanceof Error ? error.message : 'Please try again.'
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
      <PageTopBar title="Vendors" subtitle="Manage suppliers and vendors used across R&D projects." searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search vendors..." actionLabel="Add Vendor" onAction={() => setIsFormOpen(true)} />

      <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <VendorStat icon={UsersRound} label="Total Vendors" value={vendors.length} tone="blue" />
        <VendorStat icon={CheckCircle2} label="Active Vendors" value={activeCount} tone="green" />
        <VendorStat icon={Clock3} label="Inactive Vendors" value={vendors.length - activeCount} tone="orange" />
        <VendorStat icon={PackageCheck} label="Linked to Projects" value={linkedCount} tone="purple" />
      </section>

      <section className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <SelectLike value={categoryFilter} options={categoryOptions} onChange={setCategoryFilter} />
          <SelectLike value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#00494B] transition hover:bg-[#f4f8ff]"
            onClick={() => {
              setQuery('');
              setCategoryFilter('All Categories');
              setStatusFilter('All Status');
            }}
          >
            <X size={16} />
            Clear Filters
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1380px] w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#f7faff] text-sm font-bold text-[#40577f]">
                <th className="w-12 rounded-l-lg px-4 py-3">#</th>
                <th className="w-[245px] px-4 py-3">Vendor / Company</th>
                <th className="w-[150px] px-4 py-3">Category</th>
                <th className="w-[220px] px-4 py-3">Components</th>
                <th className="w-[150px] px-4 py-3">Payment</th>
                <th className="w-[170px] px-4 py-3">Contact Person</th>
                <th className="w-[210px] px-4 py-3">Contact</th>
                <th className="w-[135px] px-4 py-3">Projects</th>
                <th className="w-[120px] px-4 py-3">Status</th>
                <th className="w-[90px] rounded-r-lg px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVendors.map((vendor, index) => (
                <tr key={vendor.id} className="border-b border-[#e2e8f2] last:border-b-0">
                  <td className="px-4 py-4 text-sm font-medium text-[#3f5580]">{index + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#eaf2ff] text-base font-black text-[#00494B]">{initials(vendor.name)}</span>
                      <div>
                        <p className="font-bold text-[#333333]">{vendor.name}</p>
                        <p className="text-sm font-medium text-[#53688d]">{vendor.code || '--'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><span className="vendor-category">{vendor.category}</span></td>
                  <td className="px-4 py-4">
                    <p className="line-clamp-2 text-sm font-semibold text-[#20385f]">{vendor.suppliedComponents || vendor.notes || '--'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-[#20385f]">{paymentSummary(vendor)}</p>
                    {vendor.paymentTerms ? <p className="mt-1 line-clamp-2 text-xs font-medium text-[#53688d]">{vendor.paymentTerms}</p> : null}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-[#20385f]">{vendor.contactPerson || '--'}</p>
                    <p className="text-sm font-medium text-[#53688d]">{vendor.designation || 'Contact person'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1 text-sm font-semibold text-[#20385f]">
                      <p className="flex items-center gap-2"><Phone size={14} className="text-[#00494B]" />{vendor.phone || '--'}</p>
                      <p className="flex items-center gap-2"><Mail size={14} className="text-[#00494B]" />{vendor.email || '--'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {vendor.projects.length ? <span className="rounded-lg bg-[#eaf2ff] px-3 py-2 text-xs font-bold text-[#00494B]">{vendor.projects.length} Project{vendor.projects.length > 1 ? 's' : ''}</span> : <span className="text-sm font-semibold text-[#7a8aa8]">--</span>}
                  </td>
                  <td className="px-4 py-4"><span className={`team-status ${vendor.status.toLowerCase()}`}>{vendor.status}</span></td>
                  <td className="px-4 py-4">
                    <VendorActions vendor={vendor} onEdit={() => { setEditingVendorId(vendor.id); setForm({
                      name: vendor.name,
                      code: vendor.code || '',
                      category: vendor.category,
                      contactPerson: vendor.contactPerson,
                      designation: vendor.designation || '',
                      phone: vendor.phone || '',
                      email: vendor.email || '',
                      location: vendor.location || '',
                      supply: vendor.suppliedComponents || vendor.notes || vendor.category,
                      projectId: vendor.projects[0]?.id || '',
                      paymentType: vendor.paymentType,
                      advancePercentage: String(vendor.advancePercentage || ''),
                      creditDays: String(vendor.creditDays || ''),
                      paymentTerms: vendor.paymentTerms || '',
                      preferred: vendor.preferred,
                      status: vendor.status,
                      notes: vendor.notes || ''
                    }); setIsFormOpen(true); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredVendors.length ? (
            <div className="px-4 py-12 text-center">
              <Store className="mx-auto text-[#7a8aa8]" size={34} />
              <p className="mt-3 font-bold text-[#333333]">{vendorsLoading ? 'Loading vendors...' : 'No vendors found'}</p>
              <p className="mt-1 text-sm text-[#53688d]">Vendors will appear here from project BOMs or when you add one.</p>
            </div>
          ) : null}
        </div>
      </section>

      {isFormOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#333333]/30 px-4 py-3 backdrop-blur-sm">
          <form noValidate onSubmit={handleSubmit} className="w-full max-w-[900px] rounded-lg bg-white shadow-[0_24px_80px_rgba(6,20,61,0.25)]">
            <div className="flex items-center justify-between border-b border-[#d8e2f2] bg-white px-6 py-2.5">
              <h2 className="text-lg font-bold text-[#333333]">{editingVendorId ? 'Edit Vendor' : 'Add New Vendor'}</h2>
              <button type="button" onClick={closeForm} className="grid h-8 w-8 place-items-center rounded-lg text-[#28406e] hover:bg-[#f4f8ff]" title="Close form">
                <X size={19} />
              </button>
            </div>

            <div className="space-y-2.5 px-6 py-2.5">
              <FormSection title="Vendor Information">
                <FormField label="Vendor / Company Name" required className="md:col-span-4">
                  <input required value={form.name} onChange={(event) => updateForm('name', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="Enter company name" />
                </FormField>
                <FormField label="Vendor Code" className="md:col-span-2">
                  <input value={form.code} onChange={(event) => updateForm('code', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="e.g. VEN-001" />
                </FormField>
                <FormField label="Category" required className="md:col-span-2">
                  <select required value={form.category} onChange={(event) => updateForm('category', event.target.value)} className="field h-9 px-3 py-1.5 text-sm">
                    <option value="">Select category</option>
                    {categoryOptions.filter((option) => option !== 'All Categories').map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </FormField>
                <FormField label="Contact Person" required className="md:col-span-2">
                  <input required value={form.contactPerson} onChange={(event) => updateForm('contactPerson', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="Enter contact person name" />
                </FormField>
                <FormField label="Designation" className="md:col-span-2">
                  <input value={form.designation} onChange={(event) => updateForm('designation', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="e.g. Sales Manager" />
                </FormField>
                <FormField label="Phone Number" className="md:col-span-2">
                  <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="+91 98765 43210" />
                </FormField>
                <FormField label="Email" className="md:col-span-3">
                  <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="Enter email address" />
                </FormField>
                <FormField label="Location" className="md:col-span-3">
                  <input value={form.location} onChange={(event) => updateForm('location', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="Enter city, country" />
                </FormField>
              </FormSection>

              <FormSection title="R&D Information">
                <FormField label="Components / Materials Supplied" required className="md:col-span-3">
                  <textarea required value={form.supply} onChange={(event) => updateForm('supply', event.target.value)} className="field min-h-[52px] resize-none px-3 py-1.5 text-sm" placeholder="E.g. Borosilicate glass tubes, bottles, components..." />
                </FormField>
                <FormField label="Assigned Projects" className="md:col-span-3">
                  <select value={form.projectId} onChange={(event) => updateForm('projectId', event.target.value)} className="field h-9 px-3 py-1.5 text-sm">
                    <option value="">Select projects</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.productCode} - {project.name}</option>)}
                  </select>
                </FormField>
                <FormField label="Payment Type" required className="md:col-span-2">
                  <select required value={form.paymentType} onChange={(event) => updateForm('paymentType', event.target.value as VendorPaymentType)} className="field h-9 px-3 py-1.5 text-sm">
                    <option value="Advance">Advance</option>
                    <option value="Credit">Credit</option>
                  </select>
                </FormField>
                {form.paymentType === 'Advance' ? (
                  <FormField label="Advance Percentage" required className="md:col-span-2">
                    <input type="number" min="0" max="100" value={form.advancePercentage} onChange={(event) => updateForm('advancePercentage', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="e.g. 30" />
                  </FormField>
                ) : (
                  <FormField label="Credit Days" required className="md:col-span-2">
                    <input type="number" min="1" value={form.creditDays} onChange={(event) => updateForm('creditDays', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="e.g. 45" />
                  </FormField>
                )}
                <FormField label="Payment Terms" className="md:col-span-2">
                  <input value={form.paymentTerms} onChange={(event) => updateForm('paymentTerms', event.target.value)} className="field h-9 px-3 py-1.5 text-sm" placeholder="50% before dispatch..." />
                </FormField>
                <label className="flex h-11 items-center gap-3 rounded-lg border border-[#d8e2f2] bg-[#f8fbff] px-3 text-sm font-semibold text-[#20385f] md:col-span-3">
                  <input type="checkbox" checked={form.preferred} onChange={(event) => updateForm('preferred', event.target.checked)} className="h-4 w-4 rounded border-[#b8c8dd] text-[#00494B]" />
                  <span><span className="block font-bold">Preferred Vendor</span><span className="text-xs font-medium text-[#53688d]">Mark as preferred</span></span>
                </label>
                <FormField label="Status" required className="md:col-span-3">
                  <div className="flex h-11 items-center gap-6 rounded-lg border border-[#d8e2f2] bg-[#f8fbff] px-3">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#20385f]"><input type="radio" checked={form.status === 'Active'} onChange={() => updateForm('status', 'Active')} />Active</label>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#20385f]"><input type="radio" checked={form.status === 'Inactive'} onChange={() => updateForm('status', 'Inactive')} />Inactive</label>
                  </div>
                </FormField>
              </FormSection>

              <FormSection title="Additional Information">
                <FormField label="Notes" className="md:col-span-3">
                  <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} className="field min-h-[52px] resize-none px-3 py-1.5 text-sm" placeholder="Add any additional information..." />
                </FormField>
                <FormField label="Documents (Optional)" className="md:col-span-3">
                  <label className="grid min-h-[52px] place-items-center rounded-lg border border-dashed border-[#b8c8dd] bg-[#f8fbff] px-4 py-1.5 text-center text-sm font-semibold text-[#28406e]">
                    Drag &amp; drop files here or browse
                    <span className="text-xs font-medium text-[#53688d]">Upload quotations, technical specs, certificates, agreements, etc.</span>
                    <input type="file" multiple className="sr-only" />
                  </label>
                </FormField>
              </FormSection>
            </div>

            <div className="flex justify-end gap-3 border-t border-[#d8e2f2] bg-white px-6 py-2.5">
              <button type="button" onClick={closeForm} className="h-9 rounded-lg border border-[#d8e2f2] px-5 text-sm font-bold text-[#20385f] hover:bg-[#f4f8ff]">Cancel</button>
              <button type="submit" className="h-9 rounded-lg bg-[#00494B] px-5 text-sm font-bold text-white hover:bg-[#007D7D]">{editingVendorId ? 'Save Vendor' : 'Add Vendor'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function VendorActions({ vendor, onEdit }: { vendor: VendorRow; onEdit: () => void }) {
  const linkedProject = vendor.projects[0];
  return (
    <div className="group relative inline-block">
      <button className="grid h-9 w-9 place-items-center rounded-lg border border-[#d8e2f2] text-[#28406e] hover:bg-[#f4f8ff]" title="Vendor actions">
        <MoreHorizontal size={18} />
      </button>
      <div className="invisible absolute right-0 top-10 z-20 w-48 rounded-lg border border-slate-200 bg-white p-2 opacity-0 shadow-soft transition group-hover:visible group-hover:opacity-100">
        <button className="menu-action" onClick={onEdit}>View / Edit</button>
        <button className="menu-action" disabled={!vendor.email} onClick={() => vendor.email && navigator.clipboard?.writeText(vendor.email)}>Copy Email</button>
        {linkedProject ? <a className="menu-action" href={`/projects/${linkedProject.productCode}/overview`}>Open Linked Project</a> : <button className="menu-action" disabled>No linked project</button>}
      </div>
    </div>
  );
}

function SearchBox({ query, setQuery }: { query: string; setQuery: (value: string) => void }) {
  return (
    <label className="flex h-11 w-full items-center gap-3 rounded-lg border border-[#d8e2f2] bg-white px-4 text-[#28406e] shadow-sm sm:w-[420px]">
      <Search size={19} />
      <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full border-0 bg-transparent text-sm font-medium outline-none placeholder:text-[#7282a1]" placeholder="Search vendors by name, contact or category..." />
    </label>
  );
}

function SelectLike<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (value: T) => void }) {
  return (
    <label className="relative">
      <select value={value} onChange={(event) => onChange(event.target.value as T)} className="h-11 min-w-[150px] appearance-none rounded-lg border border-[#d8e2f2] bg-white px-4 pr-10 text-sm font-semibold text-[#203b66] shadow-sm outline-none">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-3 text-[#284b7c]" size={18} />
    </label>
  );
}

function VendorStat({ icon: Icon, label, value, tone }: { icon: typeof UsersRound; label: string; value: number; tone: 'blue' | 'purple' | 'green' | 'orange' }) {
  return (
    <div className="flex h-[86px] items-center gap-4 rounded-lg border border-[#dde6f2] bg-white px-5 shadow-[0_12px_35px_rgba(21,40,80,0.07)]">
      <span className={`team-stat-icon ${tone}`}><Icon size={26} /></span>
      <div>
        <p className="text-sm font-semibold text-[#53688d]">{label}</p>
        <p className="mt-1 text-3xl font-bold leading-none text-[#333333]">{value}</p>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 border-b border-[#d8e2f2] pb-1 text-sm font-bold text-[#333333]">{title}</h3>
      <div className="grid gap-x-3 gap-y-2 md:grid-cols-6">{children}</div>
    </section>
  );
}

function FormField({ label, required = false, className = '', children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-bold text-[#20385f]">{label}{required ? <span className="text-[#ef4444]"> *</span> : null}</span>
      {children}
    </label>
  );
}
