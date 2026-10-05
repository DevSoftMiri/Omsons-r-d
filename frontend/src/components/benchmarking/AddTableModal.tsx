import { useState } from 'react';
import { useToast } from '../ToastProvider';
import { getMissingFields, showMissingFieldsToast } from '../../utils/requiredFields';

export function AddTableModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (values: { name: string; initialColumns: number; initialRows: number }) => void }) {
  const [name, setName] = useState('');
  const { showToast } = useToast();
  const [initialColumns, setInitialColumns] = useState(5);
  const [initialRows, setInitialRows] = useState(5);

  if (!open) return null;

  function submit() {
    const tableName = name.trim();
    const missing = getMissingFields([
      { label: 'Table Name', value: tableName },
      { label: 'Initial columns', valid: initialColumns > 0 },
      { label: 'Initial rows', valid: initialRows > 0 }
    ]);
    if (showMissingFieldsToast(showToast, missing)) return;
    onCreate({ name: tableName, initialColumns, initialRows });
    setName('');
    setInitialColumns(5);
    setInitialRows(5);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">Create Benchmarking Table</h2>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">
            Table Name
            <input className="field mt-2" placeholder="Material Comparison" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Initial columns
              <input className="field mt-2" inputMode="numeric" value={initialColumns} onChange={(event) => setInitialColumns(Number(event.target.value))} />
            </label>
            <label className="block text-sm font-semibold">
              Initial rows
              <input className="field mt-2" inputMode="numeric" value={initialRows} onChange={(event) => setInitialRows(Number(event.target.value))} />
            </label>
          </div>
          <p className="text-sm text-slate-500">Examples: Material Comparison, Dimensional Comparison, Performance Testing</p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={submit}>Create Table</button>
        </div>
      </section>
    </div>
  );
}
