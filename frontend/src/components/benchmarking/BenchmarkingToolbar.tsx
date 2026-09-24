import { Download, Plus, Trash2, Upload } from 'lucide-react';
import type { ChangeEvent } from 'react';

export function BenchmarkingToolbar({
  onAddRow,
  onAddColumn,
  onImport,
  onExport,
  onDelete
}: {
  onAddRow: () => void;
  onAddColumn: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="secondary-button text-primary" onClick={onAddRow}><Plus size={16} />Add Row</button>
      <button className="secondary-button text-primary" onClick={onAddColumn}><Plus size={16} />Add Column</button>
      <label className="secondary-button cursor-pointer text-primary">
        <Upload size={16} />
        Import from Excel
        <input className="hidden" type="file" accept=".csv,text/csv" onChange={onImport} />
      </label>
      <button className="secondary-button text-primary" onClick={onExport}><Download size={16} />Export to Excel</button>
      <button className="secondary-button text-rose-600" onClick={onDelete}><Trash2 size={16} />Delete Table</button>
    </div>
  );
}
