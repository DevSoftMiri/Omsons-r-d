import { ExcelTableActions } from './ExcelTableActions';
import type { BenchmarkingTableData } from './types';
import { useState } from 'react';
import { useToast } from '../ToastProvider';
import { getMissingFields, showMissingFieldsToast } from '../../utils/requiredFields';

export function AddTableModal({
  open,
  onClose,
  onCreate,
  title = 'Create Benchmarking Table',
  examples = 'Examples: Material Comparison, Dimensional Comparison, Performance Testing'
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (values: { name: string; initialColumns: number; initialRows: number; importedTable?: BenchmarkingTableData }) => void | Promise<void>;
  title?: string;
  examples?: string;
}) {
  const [importedTable, setImportedTable] = useState<BenchmarkingTableData | undefined>();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const { showToast } = useToast();
  const [initialColumns, setInitialColumns] = useState(5);
  const [initialRows, setInitialRows] = useState(5);

  function close() {
    setName(''); setImportedTable(undefined); setInitialColumns(5); setInitialRows(5); onClose();
  }
  if (!open) return null;

  async function submit() {
    const tableName = name.trim();
    const missing = getMissingFields([
      { label: 'Table Name', value: tableName },
      { label: 'Initial columns (positive whole number)', valid: Number.isInteger(initialColumns) && initialColumns > 0 },
      { label: 'Initial rows (positive whole number)', valid: Number.isInteger(initialRows) && initialRows > 0 },
      { label: 'Table size (maximum 100,000 cells)', valid: initialRows * initialColumns <= 100000 }
    ]);
    if (showMissingFieldsToast(showToast, missing)) return;
    setSaving(true);
    try { await onCreate({ name: tableName, initialColumns, initialRows, importedTable }); }
    catch (error) { showToast({ tone: 'error', title: 'Unable to create table', message: error instanceof Error ? error.message : 'Please try again.' }); return; }
    finally { setSaving(false); }
    setImportedTable(undefined);
    setName('');
    setInitialColumns(5);
    setInitialRows(5);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="border-b border-slate-200 pb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Benchmarking</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">{title}</h2>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Table Name
            <input className="field mt-2" placeholder="Material Comparison" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <ExcelTableActions exportEnabled={false} table={{ _id: 'new-table', name: name || 'Imported Table', columns: [], rows: [] }} onImport={table => {
              setImportedTable(table); setInitialColumns(table.columns.length); setInitialRows(table.rows.length);
              if (!name.trim()) setName('Imported Table');
            }} />
            {importedTable && <span className="text-xs text-emerald-700">{importedTable.rows.length} rows ready to import</span>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Initial columns
              <input className="field mt-2" disabled={Boolean(importedTable)} inputMode="numeric" value={initialColumns} onChange={(event) => setInitialColumns(Number(event.target.value))} />
            </label>
            <label className="block text-sm font-semibold">
              Initial rows
              <input className="field mt-2" disabled={Boolean(importedTable)} inputMode="numeric" value={initialRows} onChange={(event) => setInitialRows(Number(event.target.value))} />
            </label>
          </div>
          <p className="text-sm text-slate-500">{examples}</p>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
          <button className="secondary-button h-10" disabled={saving} onClick={close}>Cancel</button>
          <button className="primary-button h-10" disabled={saving} onClick={submit}>{saving ? 'Creating...' : 'Create Table'}</button>
        </div>
      </section>
    </div>
  );
}
