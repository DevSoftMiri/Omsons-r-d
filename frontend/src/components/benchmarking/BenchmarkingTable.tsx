import { Edit3, Maximize2, MoreVertical, X } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useEffect, useState } from 'react';
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
  onDeleteTable,
  editableColumnLabels = false
}: {
  index: number;
  table: BenchmarkingTableData;
  selectedCell: SelectedCell | null;
  onSelectCell: (cell: SelectedCell) => void;
  onChangeTable: (table: BenchmarkingTableData) => void;
  onImportCsv: (table: BenchmarkingTableData, file: File) => void;
  onExportCsv: (table: BenchmarkingTableData) => void;
  onDeleteTable: (table: BenchmarkingTableData) => void;
  editableColumnLabels?: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(table.name);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setDraftName(table.name);
  }, [table.name]);

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

  function resizeColumn(columnId: string, width: number) {
    onChangeTable({
      ...table,
      columns: table.columns.map((column) => column.id === columnId ? { ...column, width } : column)
    });
  }

  function updateColumnLabel(columnId: string, label: string) {
    onChangeTable({
      ...table,
      columns: table.columns.map((column) => column.id === columnId ? { ...column, label } : column)
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
    else setDraftName(table.name);
    setRenaming(false);
  }

  function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onImportCsv(table, file);
    event.target.value = '';
  }

  const content = (
    <>
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-white">{index + 1}</span>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Benchmark table</p>
          {renaming ? (
            <input className="field h-9 w-72" value={draftName} onBlur={saveName} onChange={(event) => setDraftName(event.target.value)} onKeyDown={(event) => {
              if (event.key === 'Enter') saveName();
              if (event.key === 'Escape') {
                setDraftName(table.name);
                setRenaming(false);
              }
            }} autoFocus />
          ) : (
            <button className="inline-flex min-w-0 items-center gap-2 rounded-md px-1 py-1 font-bold text-slate-800 transition hover:bg-slate-100 hover:text-primary" onClick={() => setRenaming(true)}>
              <span className="truncate">{table.name}</span>
              <Edit3 size={15} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="icon-button h-9 w-9 text-primary transition hover:bg-sky-50" onClick={() => setFullscreen(true)} title="Open full-window table" aria-label="Open full-window table">
            <Maximize2 size={16} />
          </button>
          <BenchmarkingToolbar
            onAddColumn={addColumn}
            onAddRow={addRow}
            onDelete={() => onDeleteTable(table)}
            onExport={() => onExportCsv(table)}
            onImport={importFile}
          />
        </div>
      </div>
      <SpreadsheetGrid
        selectedCell={selectedCell}
        table={table}
        onCellChange={updateCell}
        onDeleteColumn={deleteColumn}
        onDeleteRow={deleteRow}
        onPasteCells={pasteCells}
        onResizeColumn={resizeColumn}
        onSelectCell={onSelectCell}
        editableColumnLabels={editableColumnLabels}
        onColumnLabelChange={updateColumnLabel}
      />
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-400">
        <span>{table.rows.length} rows &middot; {table.columns.length} columns &middot; Formulas supported</span>
        <MoreVertical size={17} />
      </div>
    </>
  );

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-soft">
      {content}
      {fullscreen ? (
        <div className="fixed inset-0 z-[70] flex flex-col bg-slate-100 p-3 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-primary">Full Table View</p>
              <h2 className="text-xl font-bold">{table.name}</h2>
            </div>
            <button className="icon-button h-10 w-10" onClick={() => setFullscreen(false)} aria-label="Close full-window table">
              <X size={18} />
            </button>
          </div>
          <section className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            {content}
          </section>
        </div>
      ) : null}
    </section>
  );
}
