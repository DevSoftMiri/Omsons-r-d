import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box, CalendarDays, Check, ChevronRight, Download, Edit2, FileText, PackagePlus, Paperclip, Plus, ReceiptText, Search, ShoppingCart, Trash2, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { deleteProjectAttachment, fetchProjectAttachments, uploadProjectAttachment, type ProjectAttachment } from '../../../services/attachmentService';
import { NO_FILE_AVAILABLE, openFile, resolveFileUrl } from '../../../utils/fileActions';
import { showMissingFieldsToast } from '../../../utils/requiredFields';
import { useProjectWorkspace } from './context';

type BomStatus = 'Pending' | 'Ordered' | 'Procured';

type BomRow = {
  id: string;
  itemName: string;
  category: string;
  specification: string;
  supplier: string;
  unit: string;
  quantityPerUnit: number;
  unitCost: number | null;
  referenceDocument: string;
  status: BomStatus;
};

const units = ['kg', 'g', 'mg', 'L', 'ml', 'pcs', 'm', 'cm', 'mm', 'roll', 'sheet', 'box'];
const defaultNotes = '';

export function BOM() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const storageKey = `bom:${project.productCode}`;
  const [rows, setRows] = useState<BomRow[]>(() => readStoredBom(storageKey, project.bom).rows);
  const [activeCategory, setActiveCategory] = useState('All Items');
  const [statusFilter, setStatusFilter] = useState<'All' | BomStatus>('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editingRow, setEditingRow] = useState<BomRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteRow, setDeleteRow] = useState<BomRow | null>(null);
  const [notes, setNotes] = useState(() => readStoredBom(storageKey, project.bom).notes);
  const [lastSaved, setLastSaved] = useState(() => readStoredBom(storageKey, project.bom).lastSaved);
  const [saveState, setSaveState] = useState<'Saved' | 'Saving...'>('Saved');
  const [referenceFiles, setReferenceFiles] = useState<ProjectAttachment[]>([]);

  useEffect(() => {
    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      const timestamp = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ rows, notes, lastSaved: timestamp }));
      setLastSaved(timestamp);
      setSaveState('Saved');
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [notes, rows, storageKey]);

  useEffect(() => {
    let active = true;
    fetchProjectAttachments(project.productCode, 'BOM')
      .then((attachments) => {
        if (active) setReferenceFiles(attachments);
      })
      .catch(() => {
        if (active) setReferenceFiles([]);
      });
    return () => {
      active = false;
    };
  }, [project.productCode]);

  const categories = useMemo(() => {
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + 1;
      return acc;
    }, {});
    return ['All Items', ...Object.keys(counts)].map((category) => ({
      category,
      count: category === 'All Items' ? rows.length : counts[category]
    }));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const categoryMatch = activeCategory === 'All Items' || row.category === activeCategory;
      const statusMatch = statusFilter === 'All' || row.status === statusFilter;
      const searchMatch = !normalized || [row.itemName, row.specification, row.supplier, row.referenceDocument].some((value) => value.toLowerCase().includes(normalized));
      return categoryMatch && statusMatch && searchMatch;
    });
  }, [activeCategory, query, rows, statusFilter]);

  const pricedRows = rows.filter((row) => row.unitCost !== null);
  const estimatedCost = pricedRows.reduce((sum, row) => sum + row.quantityPerUnit * (row.unitCost || 0), 0);
  const withReference = rows.filter((row) => row.supplier || row.referenceDocument || row.specification).length;
  const statusCounts = {
    Procured: rows.filter((row) => row.status === 'Procured').length,
    Ordered: rows.filter((row) => row.status === 'Ordered').length,
    Pending: rows.filter((row) => row.status === 'Pending').length
  };
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id));
  const canComplete = rows.length > 0 && rows.every((row) => row.itemName && row.category && row.unit && row.quantityPerUnit > 0);

  function upsertRow(row: BomRow) {
    setRows((current) => current.some((item) => item.id === row.id)
      ? current.map((item) => item.id === row.id ? row : item)
      : [...current, row]);
    setShowForm(false);
    setEditingRow(null);
  }

  async function removeRow(rowToRemove: BomRow) {
    setRows((current) => current.filter((row) => row.id !== rowToRemove.id));
    setSelected((current) => current.filter((id) => id !== rowToRemove.id));
    setDeleteRow(null);
    const matchingAttachment = referenceFiles.find((file) => file.name === rowToRemove.referenceDocument);
    if (!matchingAttachment) return;
    try {
      await deleteProjectAttachment(project.productCode, 'BOM', matchingAttachment._id);
      setReferenceFiles((current) => current.filter((file) => file._id !== matchingAttachment._id));
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Reference file not deleted',
        message: error instanceof Error ? error.message : 'The BOM item was removed, but its reference file could not be deleted.'
      });
    }
  }

  async function deleteReferenceDocument(file: ProjectAttachment) {
    try {
      await deleteProjectAttachment(project.productCode, 'BOM', file._id);
      setReferenceFiles((current) => current.filter((attachment) => attachment._id !== file._id));
      setRows((current) => current.map((row) => row.referenceDocument === file.name ? { ...row, referenceDocument: '' } : row));
      showToast({ tone: 'success', title: 'Reference deleted', message: `${file.name} was removed from this BOM.` });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Delete failed',
        message: error instanceof Error ? error.message : 'Reference document could not be deleted.'
      });
    }
  }

  function removeSelected() {
    setRows((current) => current.filter((row) => !selected.includes(row.id)));
    setSelected([]);
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelected((current) => current.filter((id) => !visibleRows.some((row) => row.id === id)));
      return;
    }
    setSelected((current) => Array.from(new Set([...current, ...visibleRows.map((row) => row.id)])));
  }

  function exportCsv() {
    const header = ['Sr No', 'Item Name', 'Category', 'Specification', 'Supplier / Reference', 'Unit', 'Quantity Per Unit', 'Unit Cost', 'Total Cost', 'Reference', 'Status'];
    const csv = [
      header.join(','),
      ...visibleRows.map((row, index) => [
        index + 1,
        row.itemName,
        row.category,
        row.specification,
        row.supplier,
        row.unit,
        row.quantityPerUnit,
        row.unitCost ?? '',
        row.unitCost === null ? '' : row.quantityPerUnit * row.unitCost,
        row.referenceDocument,
        row.status
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.productCode}-BOM.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = parseCsv(text);
    setRows((current) => {
      const existingNames = new Set(current.map((row) => row.itemName.trim().toLowerCase()));
      const freshRows = imported.filter((row) => !existingNames.has(row.itemName.trim().toLowerCase()));
      return [...current, ...freshRows];
    });
    event.target.value = '';
  }

  function resetBom() {
    const seeded = seedBomRows(project.bom);
    setRows(seeded);
    setNotes(defaultNotes);
    setSelected([]);
    setActiveCategory('All Items');
    setStatusFilter('All');
    setQuery('');
  }

  function handleCompleteStage() {
    const missing = [
      !rows.length ? 'At least one BOM item' : '',
      rows.some((row) => !row.itemName.trim()) ? 'Item Name' : '',
      rows.some((row) => !row.category.trim()) ? 'Category' : '',
      rows.some((row) => !row.unit.trim()) ? 'Unit' : '',
      rows.some((row) => !Number.isFinite(row.quantityPerUnit) || row.quantityPerUnit <= 0) ? 'Quantity per Unit' : ''
    ].filter(Boolean);
    if (showMissingFieldsToast(showToast, missing)) return;
    completeStage('BOM');
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 text-sm">
      <TopCrumbs title={project.name} code={project.productCode} />
      <ProjectStageHeader project={project} currentStage="BOM" />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Bill of Materials (BOM)</h2>
          <p className="mt-1.5 max-w-4xl text-sm text-slate-600">Manage all raw materials, components, packaging, costs, suppliers, and references required to manufacture this product.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input id="bom-csv-import" className="sr-only" type="file" accept=".csv,text/csv" onChange={importCsv} />
          <label className="secondary-button h-10 cursor-pointer gap-2" htmlFor="bom-csv-import"><Upload size={16} />Import CSV</label>
          <button className="secondary-button h-10 gap-2" onClick={exportCsv}><Download size={16} />Export to Excel</button>
          <button className="secondary-button h-10 gap-2" onClick={resetBom}>Reset</button>
          <button className="primary-button" onClick={() => { setEditingRow(null); setShowForm(true); }}><Plus size={18} />Add Item</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Box size={28} />} tone="blue" label="Total Items" value={rows.length.toString()} note="Active items" />
        <SummaryCard icon={<ReceiptText size={28} />} tone="green" label="Total Estimated Cost" value={formatCurrency(estimatedCost)} note={`${pricedRows.length} of ${rows.length} items priced`} />
        <SummaryCard icon={<FileText size={28} />} tone="blue" label="Items with Reference" value={`${withReference} / ${rows.length}`} note="Have supplier/reference" />
        <ProcurementStatusCard counts={statusCounts} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3">
          <div className="flex flex-wrap gap-5">
            {categories.map((item) => (
              <button key={item.category} className={`border-b-2 px-1 pb-2.5 text-sm font-bold ${activeCategory === item.category ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-ink'}`} onClick={() => setActiveCategory(item.category)}>
                {item.category} ({item.count})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="relative block w-80 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input className="field pl-10" placeholder="Search items, supplier, or reference..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select className="field h-10 w-32" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | BomStatus)}>
              <option>All</option>
              <option>Pending</option>
              <option>Ordered</option>
              <option>Procured</option>
            </select>
          </div>
        </div>

        {selected.length ? (
          <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50 px-4 py-3 text-sm">
            <span className="font-bold text-primary">{selected.length} selected</span>
            <button className="secondary-button h-9 gap-2 text-rose-600" onClick={removeSelected}><Trash2 size={16} />Delete Selected</button>
          </div>
        ) : null}

        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px] text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="px-2.5 py-2.5"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} /></th>
                  <th className="px-2.5 py-2.5 font-bold">#</th>
                  <th className="px-2.5 py-2.5 font-bold">Item Name</th>
                  <th className="px-2.5 py-2.5 font-bold">Category</th>
                  <th className="px-2.5 py-2.5 font-bold">Specification</th>
                  <th className="px-2.5 py-2.5 font-bold">Supplier / Reference</th>
                  <th className="px-2.5 py-2.5 font-bold">Unit</th>
                  <th className="px-2.5 py-2.5 font-bold">Qty / Unit</th>
                  <th className="px-2.5 py-2.5 font-bold">Unit Cost</th>
                  <th className="px-2.5 py-2.5 font-bold">Total Cost</th>
                  <th className="px-2.5 py-2.5 font-bold">Reference Document</th>
                  <th className="px-2.5 py-2.5 font-bold">Status</th>
                  <th className="px-2.5 py-2.5 text-center font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-slate-200 text-xs">
                    <td className="px-2.5 py-2.5"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} /></td>
                    <td className="px-2.5 py-2.5">{index + 1}</td>
                    <td className="px-2.5 py-2.5 font-bold">{row.itemName}</td>
                    <td className="px-2.5 py-2.5"><CategoryBadge category={row.category} /></td>
                    <td className="px-2.5 py-2.5">{row.specification || '-'}</td>
                    <td className="px-2.5 py-2.5">{row.supplier || '-'}</td>
                    <td className="px-2.5 py-2.5">{row.unit}</td>
                    <td className="px-2.5 py-2.5">{row.quantityPerUnit}</td>
                    <td className="px-2.5 py-2.5">{row.unitCost === null ? '-' : formatCurrency(row.unitCost)}</td>
                    <td className="px-2.5 py-2.5 font-bold">{row.unitCost === null ? '-' : formatCurrency(row.quantityPerUnit * row.unitCost)}</td>
                    <td className="px-2.5 py-2.5">{row.referenceDocument ? <button className="inline-flex items-center gap-1 font-semibold text-primary disabled:cursor-not-allowed disabled:text-slate-400" disabled={!resolveFileUrl(referenceFiles.find((file) => file.name === row.referenceDocument))} title={resolveFileUrl(referenceFiles.find((file) => file.name === row.referenceDocument)) ? 'Open reference' : NO_FILE_AVAILABLE} onClick={() => openFile(referenceFiles.find((file) => file.name === row.referenceDocument))}><Paperclip size={14} />{row.referenceDocument}</button> : '-'}</td>
                    <td className="px-2.5 py-2.5">
                      <select className={`rounded-full px-2.5 py-1 text-xs font-bold outline-none ${statusClass(row.status)}`} value={row.status} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: event.target.value as BomStatus } : item))}>
                        <option>Pending</option><option>Ordered</option><option>Procured</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-2.5">
                      <div className="flex justify-center gap-2">
                        <button className="icon-button h-8 w-8 text-primary" title="Edit item" onClick={() => { setEditingRow(row); setShowForm(true); }}><Edit2 size={14} /></button>
                        <button className="icon-button h-8 w-8 text-rose-600" title="Delete item" onClick={() => setDeleteRow(row)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState onAdd={() => setShowForm(true)} />}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.8fr)]">
        <ReferenceDocuments files={referenceFiles} rows={rows} onDelete={deleteReferenceDocument} />
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><FileText className="text-primary" size={22} /><h3 className="font-bold">BOM Notes <span className="font-normal text-slate-500">(Optional)</span></h3></div>
            <span className="text-xs font-semibold text-slate-400">Auto-saved</span>
          </div>
          <textarea className="field min-h-24 resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>Last saved: {formatDateTime(lastSaved)}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{saveState}</span>
        </div>
        <div className="text-right">
          {!canComplete ? <p className="mb-2 text-sm font-semibold text-amber-700">Add at least one valid BOM item to complete this stage.</p> : null}
          <button className={`primary-button h-10 min-w-60 justify-center ${!canComplete ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`} aria-disabled={!canComplete} onClick={handleCompleteStage}><Check size={18} />Mark BOM Complete</button>
        </div>
      </section>

      {showForm ? (
        <BomItemForm
          projectId={project.productCode}
          row={editingRow}
          onClose={() => setShowForm(false)}
          onReferenceUploaded={(attachment) => setReferenceFiles((current) => [attachment, ...current])}
          onSave={upsertRow}
          showToast={showToast}
        />
      ) : null}
      {deleteRow ? <DeleteDialog row={deleteRow} onCancel={() => setDeleteRow(null)} onDelete={() => removeRow(deleteRow)} /> : null}
    </div>
  );
}

function TopCrumbs({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Link to="../overview" relative="path" className="icon-button h-10 w-10" title="Back to overview"><ChevronRight className="rotate-180" size={18} /></Link><h1 className="text-xl font-bold">{title}</h1></div>
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500"><Link to="/projects" className="hover:text-primary">Projects</Link><ChevronRight size={15} /><Link to="../overview" relative="path" className="hover:text-primary">{code}</Link><ChevronRight size={15} /><span className="font-bold text-ink">BOM</span></div>
    </div>
  );
}

function ProjectSummary({ currentStage }: { currentStage: string }) {
  const { project } = useProjectWorkspace();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center rounded-lg bg-slate-100"><BeakerVisual /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">{project.name}</h2><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{project.status}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Meta label="Product Code" value={project.productCode} />
            <Meta label="Category" value="Laboratory Glassware" />
            <Meta label="Current Stage" value={currentStage} />
            <Meta label="Priority" value={project.priority} pill />
            <Meta label="Target Date" value={formatDate(project.targetDate)} icon={<CalendarDays size={20} className="text-primary" />} />
          </div>
        </div>
      </div>
    </section>
  );
}

function BomItemForm({
  projectId,
  row,
  onClose,
  onReferenceUploaded,
  onSave,
  showToast
}: {
  projectId: string;
  row: BomRow | null;
  onClose: () => void;
  onReferenceUploaded: (attachment: ProjectAttachment) => void;
  onSave: (row: BomRow) => void;
  showToast: (toast: { tone: 'success' | 'error'; title: string; message?: string }) => void;
}) {
  const [form, setForm] = useState<BomRow>(row || { id: `bom_${Date.now()}`, itemName: '', category: 'Raw Material', specification: '', supplier: '', unit: 'pcs', quantityPerUnit: 1, unitCost: null, referenceDocument: '', status: 'Pending' });
  const [uploadingReference, setUploadingReference] = useState(false);
  const calculated = form.unitCost === null ? null : form.quantityPerUnit * form.unitCost;
  const uploadInputId = `bom-reference-upload-${form.id}`;

  async function uploadReferenceDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingReference(true);
    try {
      const attachment = await uploadProjectAttachment(projectId, 'BOM', file);
      setForm((current) => ({ ...current, referenceDocument: attachment.name }));
      onReferenceUploaded(attachment);
      showToast({ tone: 'success', title: 'Reference uploaded', message: `${attachment.name} was stored in Supabase.` });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Reference document could not be uploaded.'
      });
    } finally {
      setUploadingReference(false);
      event.target.value = '';
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const missingFields = [
      !form.itemName.trim() ? 'Item Name' : '',
      !form.category.trim() ? 'Category' : '',
      !form.unit.trim() ? 'Unit' : '',
      !Number.isFinite(form.quantityPerUnit) || form.quantityPerUnit <= 0 ? 'Quantity per Unit' : ''
    ].filter(Boolean);

    if (missingFields.length) {
      showToast({
        tone: 'error',
        title: 'Add required BOM value',
        message: `Please add ${missingFields.join(', ')} before saving this item.`
      });
      return;
    }

    onSave({
      ...form,
      itemName: form.itemName.trim(),
      category: form.category.trim(),
      unit: form.unit.trim(),
      specification: form.specification.trim(),
      supplier: form.supplier.trim(),
      referenceDocument: form.referenceDocument.trim()
    });
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <form className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-2xl" onSubmit={submit}>
        <div className="mb-5 flex items-center justify-between gap-4"><h3 className="text-xl font-bold">{row ? 'Edit BOM Item' : 'Add BOM Item'}</h3><button type="button" className="text-sm font-bold text-slate-500" onClick={onClose}>Cancel</button></div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Item Name *"><input className="field" value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} /></Field>
          <Field label="Category *"><input className="field" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
          <Field label="Specification"><input className="field" value={form.specification} onChange={(event) => setForm({ ...form, specification: event.target.value })} /></Field>
          <Field label="Supplier / Reference"><input className="field" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} /></Field>
          <Field label="Unit *"><select className="field" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
          <Field label="Quantity per Unit *"><input className="field" type="number" min="0" step="0.001" value={form.quantityPerUnit} onChange={(event) => setForm({ ...form, quantityPerUnit: Number(event.target.value) })} /></Field>
          <Field label="Unit Cost"><input className="field" type="number" min="0" step="0.01" value={form.unitCost ?? ''} onChange={(event) => setForm({ ...form, unitCost: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
          <Field label="Calculated Cost"><input className="field bg-slate-50 font-bold" readOnly value={calculated === null ? '-' : formatCurrency(calculated)} /></Field>
          <Field label="Reference Document">
            <div className="flex items-center gap-3">
              <label className={`secondary-button h-9 shrink-0 cursor-pointer gap-2 text-primary ${uploadingReference ? 'pointer-events-none opacity-60' : ''}`} htmlFor={uploadInputId}>
                <Upload size={15} />
                {uploadingReference ? 'Uploading...' : 'Upload'}
              </label>
              <input id={uploadInputId} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={uploadReferenceDocument} />
              {form.referenceDocument ? <span className="min-w-0 truncate text-sm font-semibold text-slate-600">{form.referenceDocument}</span> : null}
            </div>
          </Field>
          <Field label="Status"><select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BomStatus })}><option>Pending</option><option>Ordered</option><option>Procured</option></select></Field>
        </div>
        <div className="mt-5 flex justify-end gap-3"><button type="button" className="secondary-button h-11" onClick={onClose}>Cancel</button><button className="primary-button">{row ? 'Save Item' : 'Add Item'}</button></div>
      </form>
    </div>
  );
}

function DeleteDialog({ row, onCancel, onDelete }: { row: BomRow; onCancel: () => void; onDelete: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h3 className="text-xl font-bold">Delete BOM Item?</h3>
        <p className="mt-2 text-slate-600">"{row.itemName}" will be removed from this BOM.</p>
        <div className="mt-5 flex justify-end gap-3"><button className="secondary-button h-11" onClick={onCancel}>Cancel</button><button className="primary-button bg-rose-600 hover:bg-rose-700" onClick={onDelete}>Delete</button></div>
      </section>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="grid min-h-80 place-items-center p-6 text-center"><div><PackagePlus className="mx-auto text-slate-400" size={58} /><h3 className="mt-4 text-xl font-bold">No BOM items added yet.</h3><p className="mt-2 max-w-xl text-slate-500">Start building the list of raw materials, components and packaging required to manufacture this product.</p><button className="primary-button mt-5" onClick={onAdd}><Plus size={18} />Add First Item</button></div></div>;
}

function ReferenceDocuments({
  rows,
  files,
  onDelete
}: {
  rows: BomRow[];
  files: ProjectAttachment[];
  onDelete: (file: ProjectAttachment) => void;
}) {
  const rowDocuments = referenceDocuments(rows);
  const rowDocumentNames = new Set(rowDocuments);
  const visibleFiles = files.filter((file, index, list) =>
    rowDocumentNames.has(file.name) && list.findIndex((candidate) => candidate.name === file.name) === index
  );
  const uploadedNames = new Set(visibleFiles.map((file) => file.name));
  const placeholderDocuments = rowDocuments.filter((document) => !uploadedNames.has(document));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Paperclip className="text-primary" size={22} />
          <h3 className="font-bold">Reference Documents</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{visibleFiles.length + placeholderDocuments.length} files</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {visibleFiles.map((file) => (
          <div key={file._id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-100 text-rose-600"><FileText size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{file.name}</p>
              <p className="text-xs text-slate-500">{formatBytes(file.fileSize || 0)} stored in Supabase</p>
            </div>
            <button className="text-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={!resolveFileUrl(file)} title={resolveFileUrl(file) ? 'Open reference' : NO_FILE_AVAILABLE} onClick={() => openFile(file)}>
              <Download size={17} />
            </button>
            <button className="text-rose-600" title="Delete reference" onClick={() => onDelete(file)}>
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {placeholderDocuments.map((document) => (
          <button key={document} className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-dashed border-slate-200 p-3 text-left opacity-70" disabled title={NO_FILE_AVAILABLE}>
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileText size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{document}</p>
              <p className="text-xs text-slate-500">No file available</p>
            </div>
            <Download className="text-primary" size={17} />
          </button>
        ))}
        {!visibleFiles.length && !placeholderDocuments.length ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
            No reference documents uploaded yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-600">{label}</span>{children}</label>;
}

function SummaryCard({ icon, tone, label, value, note }: { icon: ReactNode; tone: 'blue' | 'green' | 'orange'; label: string; value: string; note: string }) {
  const toneClass = tone === 'green' ? 'bg-emerald-100 text-emerald-600' : tone === 'orange' ? 'bg-orange-100 text-orange-500' : 'bg-blue-100 text-primary';
  return <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-soft"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${toneClass}`}>{icon}</span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 whitespace-pre text-xl font-bold">{value}</p><p className="text-xs text-slate-500">{note}</p></div></div>;
}

function ProcurementStatusCard({ counts }: { counts: Record<BomStatus, number> }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-orange-100 text-orange-500">
        <ShoppingCart size={28} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">Procurement Status</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(['Procured', 'Ordered', 'Pending'] as BomStatus[]).map((status) => (
            <div key={status} className="min-w-0">
              <p className="text-base font-bold leading-5 text-ink">{counts[status]}</p>
              <p className="truncate text-xs text-slate-500">{status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, pill, icon }: { label: string; value: string; pill?: boolean; icon?: ReactNode }) {
  return <div className="border-slate-200 xl:border-l xl:pl-6 first:xl:border-l-0 first:xl:pl-0"><p className="text-xs text-slate-500">{label}</p><div className="mt-1.5 flex items-center gap-2 font-bold">{icon}{pill ? <span className="rounded-full bg-rose-100 px-4 py-1.5 text-rose-600">{value}</span> : <span>{value}</span>}</div></div>;
}

function CategoryBadge({ category }: { category: string }) {
  const className = category === 'Raw Material' ? 'bg-blue-100 text-primary' : category === 'Packaging' ? 'bg-orange-100 text-orange-600' : 'bg-violet-100 text-violet-600';
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${className}`}>{category}</span>;
}

function statusClass(status: BomStatus) {
  if (status === 'Procured') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Ordered') return 'bg-blue-100 text-primary';
  return 'bg-slate-100 text-slate-600';
}

function seedBomRows(items: Array<{ id: string; materialName: string; vendor: string; quantity: number; cost: number; procurementStage: string }>): BomRow[] {
  const fallback: BomRow[] = [];
  if (!items.length) return fallback;
  return items.map((item, index) => ({ id: item.id, itemName: item.materialName, category: index % 3 === 0 ? 'Raw Material' : index % 3 === 1 ? 'Component' : 'Packaging', specification: index % 2 === 0 ? 'R&D specification' : 'Supplier specification', supplier: item.vendor, unit: 'pcs', quantityPerUnit: item.quantity, unitCost: item.cost, referenceDocument: index % 2 === 0 ? `${item.materialName.replace(/\s+/g, '_')}.pdf` : '', status: mapStatus(item.procurementStage) }));
}

function mapStatus(status: string): BomStatus {
  if (status === 'Procured' || status === 'Approved') return 'Procured';
  if (status === 'Ordered' || status === 'Quotation Received') return 'Ordered';
  return 'Pending';
}

function referenceDocuments(rows: BomRow[]) {
  return Array.from(new Set(rows.map((row) => row.referenceDocument).filter(Boolean)));
}

function readStoredBom(key: string, seedItems: Parameters<typeof seedBomRows>[0]) {
  const fallback = {
    rows: seedBomRows(seedItems),
    notes: defaultNotes,
    lastSaved: new Date().toISOString()
  };
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved) as Partial<typeof fallback>;
    return {
      rows: Array.isArray(parsed.rows) ? parsed.rows : fallback.rows,
      notes: typeof parsed.notes === 'string' ? parsed.notes : fallback.notes,
      lastSaved: typeof parsed.lastSaved === 'string' ? parsed.lastSaved : fallback.lastSaved
    };
  } catch {
    return fallback;
  }
}

function parseCsv(csv: string): BomRow[] {
  const rows = parseCsvRows(csv);
  const [header = [], ...body] = rows;
  const normalizedHeader = header.map((cell) => cell.trim().toLowerCase());
  const value = (row: string[], names: string[]) => {
    const index = normalizedHeader.findIndex((candidate) => names.includes(candidate));
    return index >= 0 ? row[index]?.trim() || '' : '';
  };
  return body
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row, index) => {
      const quantity = Number(value(row, ['quantity per unit', 'quantity', 'qty', 'qty / unit'])) || 1;
      const unitCostRaw = value(row, ['unit cost', 'cost']);
      const status = normalizeStatus(value(row, ['status']));
      return {
        id: `import_${Date.now()}_${index}`,
        itemName: value(row, ['item name', 'item', 'name']) || `Imported Item ${index + 1}`,
        category: value(row, ['category']) || 'Raw Material',
        specification: value(row, ['specification', 'spec']),
        supplier: value(row, ['supplier / reference', 'supplier', 'reference']),
        unit: value(row, ['unit']) || 'pcs',
        quantityPerUnit: quantity,
        unitCost: unitCostRaw ? Number(unitCostRaw.replace(/[^0-9.]/g, '')) || null : null,
        referenceDocument: value(row, ['reference document', 'reference', 'document']),
        status
      };
    });
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function normalizeStatus(value: string): BomStatus {
  const normalized = value.toLowerCase();
  if (normalized === 'procured' || normalized === 'approved') return 'Procured';
  if (normalized === 'ordered') return 'Ordered';
  return 'Pending';
}

function formatCurrency(value: number) {
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatBytes(value: number) {
  if (!value) return '0 KB';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function BeakerVisual() {
  return <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none"><path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" /><path d="M49 76h22M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" /><rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" /></svg>;
}
