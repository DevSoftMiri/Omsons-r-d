import { useState } from 'react';
import type { WorkBook } from 'xlsx';
import { Download, Upload } from 'lucide-react';
import { readSpreadsheet, importWorksheet } from './spreadsheetImport';
import { exportTableToExcel } from './spreadsheetExport';
import type { BenchmarkingTableData } from './types';
import { useToast } from '../ToastProvider';

export function ExcelTableActions({ table, onImport, exportEnabled = true }: {
  table: BenchmarkingTableData;
  onImport: (table: BenchmarkingTableData) => void | Promise<void>;
  exportEnabled?: boolean;
}) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<WorkBook | null>(null);
  const [sheet, setSheet] = useState('');
  function error(err: unknown) { showToast({ tone: 'error', title: 'Excel import failed', message: err instanceof Error ? err.message : 'Unable to import spreadsheet.' }); }
  async function apply(book: WorkBook, name: string) {
    try { await onImport(importWorksheet(book, name, table)); setSource(null); }
    catch (err) { error(err); }
    finally { setBusy(false); }
  }
  return <>
    <label className={`secondary-button cursor-pointer text-primary ${busy ? 'pointer-events-none opacity-50' : ''}`}>
      <Upload size={16} />{busy ? 'Importing...' : 'Import from Excel'}
      <input type="file" className="hidden" disabled={busy} accept=".xlsx,.xls,.csv" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy) return;
        setBusy(true);
        try {
          const book = await readSpreadsheet(file);
          if (!book.SheetNames.length) throw new Error('This workbook contains no worksheets.');
          if (book.SheetNames.length > 1) { setSheet(book.SheetNames[0]); setSource(book); setBusy(false); }
          else await apply(book, book.SheetNames[0]);
        } catch (err) { error(err); setBusy(false); }
      }} />
    </label>
    {exportEnabled && <button type="button" className="secondary-button text-primary" onClick={() => { try { exportTableToExcel(table); } catch (err) { error(err); } }}><Download size={16} />Export to Excel</button>}
    {source && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-label="Choose worksheet" className="w-full max-w-md space-y-4 rounded-lg bg-white p-5 text-black">
      <h2 className="text-lg font-bold">Choose worksheet</h2>
      <select className="field" aria-label="Worksheet" value={sheet} onChange={event => setSheet(event.target.value)}>{source.SheetNames.map(name => <option key={name}>{name}</option>)}</select>
      <div className="flex justify-end gap-2"><button type="button" className="secondary-button" disabled={busy} onClick={() => setSource(null)}>Cancel</button><button type="button" className="primary-button" disabled={busy} onClick={() => { setBusy(true); void apply(source, sheet); }}>Import</button></div>
    </section></div>}
  </>;
}
