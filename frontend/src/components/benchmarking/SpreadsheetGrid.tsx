import { X } from 'lucide-react';
import type { ClipboardEvent } from 'react';
import type { BenchmarkingTableData, SelectedCell } from './types';

function columnLetter(index: number) {
  let letter = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    current = Math.floor((current - 1) / 26);
  }
  return letter;
}

export function SpreadsheetGrid({
  table,
  selectedCell,
  onSelectCell,
  onCellChange,
  onPasteCells,
  onDeleteRow,
  onDeleteColumn
}: {
  table: BenchmarkingTableData;
  selectedCell: SelectedCell | null;
  onSelectCell: (cell: SelectedCell) => void;
  onCellChange: (rowId: string, columnId: string, value: string) => void;
  onPasteCells: (startRowId: string, startColumnId: string, values: string[][]) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteColumn: (columnId: string) => void;
}) {
  function handlePaste(event: ClipboardEvent<HTMLInputElement>, rowId: string, columnId: string) {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    onPasteCells(rowId, columnId, text.trimEnd().split(/\r?\n/).map((row) => row.split('\t')));
  }

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 h-8 w-12 border border-slate-200 bg-slate-100 text-slate-400" />
            {table.columns.map((column, index) => (
              <th key={column.id} className="h-8 min-w-44 border border-slate-200 bg-slate-100 px-2 text-center text-xs font-semibold text-slate-500">
                <div className="flex items-center justify-center gap-2">
                  <span>{columnLetter(index)}</span>
                  {table.columns.length > 1 ? (
                    <button className="grid h-5 w-5 place-items-center text-slate-400 hover:text-rose-600" title="Delete column" onClick={() => {
                      if (window.confirm('Delete this column?')) onDeleteColumn(column.id);
                    }}>
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={row.id}>
              <th className="sticky left-0 z-10 h-9 w-12 border border-slate-200 bg-slate-100 text-center text-xs font-semibold text-slate-500">
                <div className="flex items-center justify-center gap-1">
                  <span>{rowIndex + 1}</span>
                  {table.rows.length > 1 ? (
                    <button className="grid h-5 w-5 place-items-center text-slate-400 hover:text-rose-600" title="Delete row" onClick={() => onDeleteRow(row.id)}>
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
              </th>
              {table.columns.map((column) => {
                const selected = selectedCell?.tableId === table._id && selectedCell.rowId === row.id && selectedCell.columnId === column.id;
                return (
                  <td key={column.id} className={`border border-slate-200 p-0 ${rowIndex === 0 ? 'bg-blue-50' : 'bg-white'}`}>
                    <input
                      className={`h-9 w-full min-w-44 px-2 outline-none ${rowIndex === 0 ? 'font-semibold' : ''} ${selected ? 'ring-2 ring-inset ring-primary' : 'focus:ring-2 focus:ring-inset focus:ring-primary'}`}
                      value={row.cells[column.id] || ''}
                      onChange={(event) => onCellChange(row.id, column.id, event.target.value)}
                      onFocus={() => onSelectCell({ tableId: table._id, rowId: row.id, columnId: column.id })}
                      onPaste={(event) => handlePaste(event, row.id, column.id)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
