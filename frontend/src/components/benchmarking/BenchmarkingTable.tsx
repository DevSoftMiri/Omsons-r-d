import { Edit3, MoreVertical } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { BenchmarkingToolbar } from './BenchmarkingToolbar';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import type { BenchmarkingTableData, SelectedCell } from './types';

export function BenchmarkingTable({
  index,
  table,
  selectedCell,
  onSelectCell,
  onChangeTable,
  onImportCsv,
  onExportCsv,
  onDeleteTable
}: {
  index: number;
  table: BenchmarkingTableData;
  selectedCell: SelectedCell | null;
  onSelectCell: (cell: SelectedCell) => void;
  onChangeTable: (table: BenchmarkingTableData) => void;
  onImportCsv: (table: BenchmarkingTableData, file: File) => void;
  onExportCsv: (table: BenchmarkingTableData) => void;
  onDeleteTable: (table: BenchmarkingTableData) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(table.name);

  function updateCell(rowId: string, columnId: string, value: string) {
    onChangeTable({
      ...table,
      rows: table.rows.map((row) => row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row)
    });
  }

  function addRow() {
    onChangeTable({
      ...table,
      rows: [
        ...table.rows,
        {
          id: `row_${crypto.randomUUID()}`,
          cells: table.columns.reduce<Record<string, string>>((cells, column) => {
            cells[column.id] = '';
            return cells;
          }, {})
        }
      ]
    });
  }

  function addColumn() {
    const column = { id: `col_${crypto.randomUUID()}` };
    onChangeTable({
      ...table,
      columns: [...table.columns, column],
      rows: table.rows.map((row) => ({ ...row, cells: { ...row.cells, [column.id]: '' } }))
    });
  }

  function deleteRow(rowId: string) {
    onChangeTable({ ...table, rows: table.rows.filter((row) => row.id !== rowId) });
  }

  function deleteColumn(columnId: string) {
    onChangeTable({
      ...table,
      columns: table.columns.filter((column) => column.id !== columnId),
      rows: table.rows.map((row) => {
        const cells = { ...row.cells };
        delete cells[columnId];
        return { ...row, cells };
      })
    });
  }

  function pasteCells(startRowId: string, startColumnId: string, values: string[][]) {
    const rowStart = table.rows.findIndex((row) => row.id === startRowId);
    const columnStart = table.columns.findIndex((column) => column.id === startColumnId);
    const rows = table.rows.map((row) => ({ ...row, cells: { ...row.cells } }));

    values.forEach((pasteRow, pasteRowIndex) => {
      const targetRow = rows[rowStart + pasteRowIndex];
      if (!targetRow) return;
      pasteRow.forEach((value, pasteColumnIndex) => {
        const targetColumn = table.columns[columnStart + pasteColumnIndex];
        if (targetColumn) targetRow.cells[targetColumn.id] = value;
      });
    });

    onChangeTable({ ...table, rows });
  }

  function saveName() {
    const name = draftName.trim();
    if (name) onChangeTable({ ...table, name });
    setRenaming(false);
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImportCsv(table, file);
    event.target.value = '';
  }

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <p className="text-lg font-bold">Table {index + 1}</p>
          {renaming ? (
            <input className="field h-9 w-72" value={draftName} onBlur={saveName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') saveName();
            }} autoFocus />
          ) : (
            <button className="inline-flex min-w-0 items-center gap-2 font-bold text-slate-700 hover:text-primary" onClick={() => setRenaming(true)}>
              <span className="truncate">{table.name}</span>
              <Edit3 size={15} />
            </button>
          )}
        </div>
        <BenchmarkingToolbar
          onAddColumn={addColumn}
          onAddRow={addRow}
          onDelete={() => onDeleteTable(table)}
          onExport={() => onExportCsv(table)}
          onImport={importFile}
        />
      </div>
      <SpreadsheetGrid
        selectedCell={selectedCell}
        table={table}
        onCellChange={updateCell}
        onDeleteColumn={deleteColumn}
        onDeleteRow={deleteRow}
        onPasteCells={pasteCells}
        onSelectCell={onSelectCell}
      />
      <div className="mt-2 flex justify-end text-slate-500">
        <MoreVertical size={18} />
      </div>
    </section>
  );
}
