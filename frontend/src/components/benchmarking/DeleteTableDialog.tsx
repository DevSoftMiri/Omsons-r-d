import type { BenchmarkingTableData } from './types';

export function DeleteTableDialog({ table, onCancel, onConfirm }: { table: BenchmarkingTableData | null; onCancel: () => void; onConfirm: () => void }) {
  if (!table) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-soft">
        <h2 className="text-xl font-bold">Delete "{table.name}"?</h2>
        <p className="mt-3 text-sm text-slate-600">This will permanently remove this benchmarking table and its data.</p>
        <div className="mt-6 flex justify-end gap-3">
          <button className="secondary-button" onClick={onCancel}>Cancel</button>
          <button className="primary-button bg-rose-600 hover:bg-rose-700" onClick={onConfirm}>Delete Table</button>
        </div>
      </section>
    </div>
  );
}
