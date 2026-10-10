import { X } from 'lucide-react';
import type { ClipboardEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { BenchmarkingTableData, SelectedCell } from './types';
import { evaluateCell } from './formulaUtils';

const DEFAULT_COLUMN_WIDTH = 176;
const MIN_COLUMN_WIDTH = 40;
const MAX_COLUMN_WIDTH = 520;

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
  onDeleteColumn,
  onResizeColumn,
  editableColumnLabels = false,
  onColumnLabelChange,
}: {
  table: BenchmarkingTableData;
  selectedCell: SelectedCell | null;
  onSelectCell: (cell: SelectedCell) => void;
  onCellChange: (rowId: string, columnId: string, value: string) => void;
  onPasteCells: (
    startRowId: string,
    startColumnId: string,
    values: string[][],
  ) => void;
  onDeleteRow: (rowId: string) => void;
  onDeleteColumn: (columnId: string) => void;
  onResizeColumn: (columnId: string, width: number) => void;
  editableColumnLabels?: boolean;
  onColumnLabelChange?: (columnId: string, label: string) => void;
}) {
  function columnWidth(width?: number) {
    if (!Number.isFinite(width)) return DEFAULT_COLUMN_WIDTH;
    return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width || DEFAULT_COLUMN_WIDTH)));
  }

  function startColumnResize(event: ReactMouseEvent, columnId: string, width?: number) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = columnWidth(width);

    function handleMouseMove(moveEvent: MouseEvent) {
      onResizeColumn(columnId, columnWidth(startWidth + moveEvent.clientX - startX));
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function cellClass(rowIndex: number, columnId: string, value: string) {
    const column = table.columns.find((candidate) => candidate.id === columnId);
    const header = (column?.label || table.rows[0]?.cells[columnId] || '').trim().toLowerCase();
    const normalized = value.trim().toLowerCase();
    if (rowIndex > 0 && header === 'results') {
      if (normalized === 'pass') return 'bg-emerald-50 text-emerald-800';
      if (normalized === 'fail') return 'bg-rose-50 text-rose-800';
      if (normalized === 'retest') return 'bg-amber-50 text-amber-800';
    }
    return 'bg-white';
  }

  function handlePaste(
    event: ClipboardEvent<HTMLTextAreaElement>,
    rowId: string,
    columnId: string,
  ) {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    onPasteCells(
      rowId,
      columnId,
      text
        .trimEnd()
        .split(/\r?\n/)
        .map((row) => row.split('\t')),
    );
  }

  function moveCellFocus(rowIndex: number, columnIndex: number, rowDelta: number, columnDelta: number) {
    const targetRow = rowIndex + rowDelta;
    const targetColumn = columnIndex + columnDelta;
    if (targetRow < 0 || targetColumn < 0 || targetRow >= table.rows.length || targetColumn >= table.columns.length) return;
    const input = document.querySelector<HTMLTextAreaElement>(
      `[data-spreadsheet-table="${table._id}"][data-row-index="${targetRow}"][data-column-index="${targetColumn}"]`
    );
    input?.focus();
    input?.select();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>, rowIndex: number, columnIndex: number) {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1]
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    moveCellFocus(rowIndex, columnIndex, direction[0], direction[1]);
  }

  const tableWidth = 48 + table.columns.reduce((sum, column) => sum + columnWidth(column.width), 0);
  const selectedRowIndex = selectedCell?.tableId === table._id
    ? table.rows.findIndex((row) => row.id === selectedCell.rowId)
    : -1;
  const selectedColumnIndex = selectedCell?.tableId === table._id
    ? table.columns.findIndex((column) => column.id === selectedCell.columnId)
    : -1;
  const selectedRawValue = selectedRowIndex >= 0 && selectedColumnIndex >= 0
    ? table.rows[selectedRowIndex].cells[table.columns[selectedColumnIndex].id] || ''
    : '';

  return (
    <div className="space-y-2">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-slate-400">Formula</span>
        <input
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-slate-700 outline-none"
          value={selectedRawValue}
          placeholder="Select a cell to view or enter a formula"
          onChange={(event) => {
            if (selectedRowIndex >= 0 && selectedColumnIndex >= 0) {
              onCellChange(table.rows[selectedRowIndex].id, table.columns[selectedColumnIndex].id, event.target.value);
            }
          }}
          aria-label="Formula bar"
        />
        <span className="hidden shrink-0 text-[11px] text-slate-400 sm:inline">Use =SUM(A2:A5)</span>
      </div>
      <div className="w-full max-w-full overflow-auto rounded-lg border border-slate-200">
        <table className="table-fixed border-collapse text-left text-xs" style={{ width: tableWidth, minWidth: tableWidth, maxWidth: tableWidth }}>
        <colgroup>
          <col style={{ width: 48, minWidth: 48, maxWidth: 48 }} />
          {table.columns.map((column) => (
            <col key={column.id} style={{ width: columnWidth(column.width), minWidth: columnWidth(column.width), maxWidth: columnWidth(column.width) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="h-9 w-12 border border-slate-200 bg-white px-1.5 py-2.5 text-center font-extrabold text-slate-700" />
            {table.columns.map((column, index) => (
              <th
                key={column.id}
                className="relative h-9 overflow-hidden border border-slate-200 bg-white px-2 py-2.5 text-center font-extrabold leading-tight text-slate-700"
              >
                <div className="flex items-center justify-center gap-2">
                  {editableColumnLabels ? (
                    <input
                      className="h-7 min-w-0 flex-1 bg-transparent px-1 text-center text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                      value={column.label || ''}
                      onChange={(event) => onColumnLabelChange?.(column.id, event.target.value)}
                      placeholder={columnLetter(index)}
                    />
                  ) : (
                    <span>{columnLetter(index)}</span>
                  )}
                  {table.columns.length > 1 ? (
                    <button
                      type="button"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Delete column"
                      onClick={() => {
                        if (window.confirm('Delete this column?'))
                          onDeleteColumn(column.id);
                      }}
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none bg-transparent transition hover:bg-primary/30"
                  aria-label={`Resize column ${columnLetter(index)}`}
                  onMouseDown={(event) => startColumnResize(event, column.id, column.width)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={row.id}>
              <th className="h-9 w-12 border border-slate-200 px-1.5 text-center text-xs font-extrabold text-slate-700">
                <div className="flex items-center justify-center gap-1">
                  <span>{rowIndex + 1}</span>
                  {table.rows.length > 1 ? (
                    <button
                      type="button"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Delete row"
                      onClick={() => onDeleteRow(row.id)}
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
              </th>
              {table.columns.map((column, columnIndex) => {
                const selected =
                  selectedCell?.tableId === table._id &&
                  selectedCell.rowId === row.id &&
                  selectedCell.columnId === column.id;
                const rawValue = row.cells[column.id] || '';
                const value = evaluateCell(table, rowIndex, columnIndex);
                const colorClass = cellClass(rowIndex, column.id, value);
                return (
                  <td
                    key={column.id}
                    className={`overflow-hidden border border-slate-200 p-0 align-top ${colorClass}`}
                  >
                    <textarea
                      className={`block h-9 w-full resize-none whitespace-normal break-words bg-transparent px-2 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${rowIndex === 0 ? 'font-extrabold text-slate-800' : ''} ${selected ? 'bg-primary/[.06] ring-2 ring-inset ring-primary' : ''}`}
                      data-column-index={columnIndex}
                      data-row-index={rowIndex}
                      data-spreadsheet-table={table._id}
                      rows={1}
                      value={selected ? rawValue : value}
                      onChange={(event) =>
                        onCellChange(row.id, column.id, event.target.value)
                      }
                      onFocus={() =>
                        onSelectCell({
                          tableId: table._id,
                          rowId: row.id,
                          columnId: column.id,
                        })
                      }
                      onKeyDown={(event) => handleKeyDown(event, rowIndex, columnIndex)}
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
    </div>
  );
}
