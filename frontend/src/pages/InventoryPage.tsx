import { ArrowDown, ArrowUp, ArrowUpDown, FileText, Filter, MoreHorizontal, Paperclip, Plus, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageTopBar } from '../components/PageTopBar';
import { useToast } from '../components/ToastProvider';
import { useAppSelector } from '../hooks';
import { createInventory, deleteInventory, fetchInventory, updateInventory, uploadInventoryAttachment, type InventoryItem } from '../services/inventoryService';
import { fetchVendors, type VendorRecord } from '../services/vendorService';

const emptyForm = { itemCode: '', itemName: '', specification: '', unit: 'pcs', price: '', vendor: '' };
type SortKey = 'itemCode' | 'itemName' | 'specification' | 'unit' | 'price' | 'vendorName';
type SortDirection = 'asc' | 'desc';

export function InventoryPage() {
  const { showToast } = useToast();
  const user = useAppSelector((state) => state.auth.user);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [query, setQuery] = useState('');
  const [vendorFilter, setVendorFilter] = useState('All Vendors');
  const [unitFilter, setUnitFilter] = useState('All Units');
  const [form, setForm] = useState(emptyForm);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('itemCode');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => { Promise.all([fetchInventory(), fetchVendors()]).then(([inventory, vendorRows]) => { setItems(inventory); setVendors(vendorRows); }).catch((error) => showToast({ tone: 'error', title: 'Unable to load inventory', message: error instanceof Error ? error.message : 'Please try again.' })); }, [showToast]);
  const units = useMemo(() => ['All Units', ...Array.from(new Set(items.map((item) => item.unit).filter(Boolean)))], [items]);
  const filtered = useMemo(() => {
    const rows = items.filter((item) => {
      const text = `${item.itemCode} ${item.itemName} ${item.specification} ${item.vendorName}`.toLowerCase();
      return (!query || text.includes(query.toLowerCase())) && (vendorFilter === 'All Vendors' || item.vendorId === vendorFilter) && (unitFilter === 'All Units' || item.unit === unitFilter);
    });
    return rows.sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      const comparison = sortKey === 'price'
        ? Number(leftValue) - Number(rightValue)
        : String(leftValue || '').localeCompare(String(rightValue || ''), undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, query, sortKey, sortDirection, unitFilter, vendorFilter]);

  function changeSort(nextKey: SortKey) {
    if (sortKey === nextKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortKey(nextKey); setSortDirection('asc'); }
  }

  function sortIcon(column: SortKey) {
    if (sortKey !== column) return <ArrowUpDown size={14} className="text-slate-400" />;
    return sortDirection === 'asc' ? <ArrowUp size={14} className="text-[#00494B]" /> : <ArrowDown size={14} className="text-[#00494B]" />;
  }

  function sortHeader(label: string, column: SortKey, rounded = '') {
    return <th className={`${rounded} px-4 py-3`}><button type="button" className="inline-flex items-center gap-1.5 hover:text-[#00494B]" onClick={() => changeSort(column)}>{label}{sortIcon(column)}</button></th>;
  }

  function startCreate() { setEditingId(null); setForm(emptyForm); setAttachmentFile(null); setOpen(true); }
  function startEdit(item: InventoryItem) { setEditingId(item.id); setAttachmentFile(null); setForm({ itemCode: item.itemCode, itemName: item.itemName, specification: item.specification, unit: item.unit, price: String(item.price), vendor: item.vendorId || '' }); setOpen(true); }
  async function save(event: React.FormEvent) { event.preventDefault(); if (!form.itemCode.trim() || !form.itemName.trim()) return; setSaving(true); try { const payload = { ...form, price: Number(form.price || 0), vendor: form.vendor || undefined }; let saved = editingId ? await updateInventory(editingId, payload) : await createInventory(payload); if (attachmentFile) saved = await uploadInventoryAttachment(saved.id, attachmentFile); setItems((current) => editingId ? current.map((item) => item.id === saved.id ? { ...item, ...saved } : item) : [saved, ...current]); setOpen(false); setAttachmentFile(null); showToast({ tone: 'success', title: editingId ? 'Inventory item updated' : 'Inventory item added' }); } catch (error) { showToast({ tone: 'error', title: 'Unable to save item', message: error instanceof Error ? error.message : 'Please try again.' }); } finally { setSaving(false); } }
  async function remove(item: InventoryItem) { if (!window.confirm(`Delete ${item.itemName}?`)) return; try { await deleteInventory(item.id); setItems((current) => current.filter((row) => row.id !== item.id)); showToast({ tone: 'success', title: 'Inventory item deleted' }); } catch (error) { showToast({ tone: 'error', title: 'Unable to delete item', message: error instanceof Error ? error.message : 'Please try again.' }); } }
  async function upload(item: InventoryItem, file?: File) { if (!file) return; try { const saved = await uploadInventoryAttachment(item.id, file); setItems((current) => current.map((row) => row.id === saved.id ? saved : row)); showToast({ tone: 'success', title: 'Attachment uploaded' }); } catch (error) { showToast({ tone: 'error', title: 'Attachment failed', message: error instanceof Error ? error.message : 'Please try again.' }); } }

  return <div className="min-h-screen bg-[#f4f8ff] px-6 py-4 lg:px-8">
    <PageTopBar title="Inventory" subtitle="Track materials, specifications, pricing, suppliers and supporting documents." searchValue={query} onSearchChange={setQuery} searchPlaceholder="Search item code, item or vendor..." actionLabel="Add Inventory Item" onAction={startCreate} />
    <section className="rounded-lg border border-[#dde6f2] bg-white p-5 shadow-[0_18px_55px_rgba(21,40,80,0.08)]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-[#333333]">Inventory Items</h2><p className="mt-1 text-sm font-medium text-[#53688d]">{filtered.length} of {items.length} items shown</p></div><div className="flex items-center gap-2 text-sm font-semibold text-[#53688d]"><Filter size={16} />Filter inventory</div></div>
      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_160px]"><label className="field flex items-center gap-2"><Search size={16} className="text-slate-400" /><input className="w-full bg-transparent outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory..." /></label><select className="field" value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}><option>All Vendors</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select><select className="field" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></div>
      <div className="overflow-x-auto"><table className="min-w-[1050px] w-full border-collapse text-left"><thead><tr className="bg-[#f7faff] text-sm font-bold text-[#40577f]">{sortHeader('Item Code', 'itemCode', 'rounded-l-lg')}{sortHeader('Item', 'itemName')}{sortHeader('Specification', 'specification')}{sortHeader('Unit', 'unit')}{sortHeader('Price', 'price')}{sortHeader('Vendor', 'vendorName')}<th className="px-4 py-3">Attachment</th><th className="rounded-r-lg px-4 py-3">Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id} className="border-b border-[#e2e8f2] last:border-0"><td className="px-4 py-4 font-bold text-[#00494B]">{item.itemCode}</td><td className="px-4 py-4 font-bold text-[#333333]">{item.itemName}</td><td className="max-w-[230px] px-4 py-4 text-sm font-medium text-[#53688d]">{item.specification || '--'}</td><td className="px-4 py-4"><span className="rounded-lg bg-[#edf4ff] px-3 py-1.5 text-xs font-bold text-[#244879]">{item.unit}</span></td><td className="px-4 py-4 font-bold text-[#20385f]">&#8377;{item.price.toFixed(2)}</td><td className="px-4 py-4 font-semibold text-[#53688d]">{item.vendorName || '--'}</td><td className="px-4 py-4">{item.attachment?.url ? <a className="inline-flex items-center gap-1 text-sm font-bold text-[#00494B]" href={item.attachment.url} target="_blank" rel="noreferrer"><Paperclip size={15} />View file</a> : <label className="inline-flex cursor-pointer items-center gap-1 text-sm font-bold text-[#53688d] hover:text-[#00494B]"><Paperclip size={15} />Attach<input type="file" className="hidden" onChange={(event) => void upload(item, event.target.files?.[0])} /></label>}</td><td className="px-4 py-4"><div className="flex items-center gap-1"><button className="icon-button h-8 w-8" title="Edit item" onClick={() => startEdit(item)}><MoreHorizontal size={16} /></button>{user?.role === 'admin' ? <button className="icon-button h-8 w-8 text-rose-600" title="Delete item" onClick={() => void remove(item)}><Trash2 size={15} /></button> : null}</div></td></tr>)}</tbody></table>{!filtered.length ? <div className="py-12 text-center"><FileText className="mx-auto mb-3 text-slate-300" size={38} /><p className="font-bold text-[#333333]">No inventory items found</p><p className="mt-1 text-sm text-[#53688d]">Add an item or change your filters.</p></div> : null}</div>
    </section>
    {open ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><form onSubmit={save} className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-xl font-bold text-[#333333]">{editingId ? 'Edit Inventory Item' : 'Add Inventory Item'}</h2><p className="mt-1 text-sm text-[#53688d]">Keep item details and supplier information up to date.</p></div><button type="button" className="icon-button h-9 w-9" onClick={() => setOpen(false)}><X size={17} /></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="field-label">Item Code<input required className="field mt-1" value={form.itemCode} onChange={(event) => setForm({ ...form, itemCode: event.target.value })} placeholder="e.g. INS-001" /></label><label className="field-label">Item<input required className="field mt-1" value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} placeholder="Heating Mantle" /></label><label className="field-label sm:col-span-2">Specification<textarea className="field mt-1 min-h-20" value={form.specification} onChange={(event) => setForm({ ...form, specification: event.target.value })} placeholder="Size, grade, model or technical specification" /></label><label className="field-label">Unit<select className="field mt-1" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}><option>pcs</option><option>metre</option><option>kg</option><option>litre</option><option>set</option><option>box</option><option>other</option></select></label><label className="field-label">Price<input type="text" inputMode="decimal" className="field mt-1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="0.00" /></label><label className="field-label sm:col-span-2">Vendor<select className="field mt-1" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })}><option value="">Select vendor</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label></div><div className="mt-5 flex justify-end gap-3"><button type="button" className="secondary-button h-10" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button h-10 min-w-28 justify-center" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update Item' : 'Add Item'}</button></div></form></div> : null}
  </div>;
}
