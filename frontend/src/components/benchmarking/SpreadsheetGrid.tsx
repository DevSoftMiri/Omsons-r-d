import { X } from 'lucide-react';
import type { ClipboardEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { BenchmarkingTableData, SelectedCell } from './types';

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
    const header = table.rows[0]?.cells[columnId]?.trim().toLowerCase();
    const normalized = value.trim().toLowerCase();
    if (rowIndex > 0 && header === 'results') {
      if (normalized === 'pass') return 'bg-emerald-100 text-emerald-800';
      if (normalized === 'fail') return 'bg-red-600 text-white';
      if (normalized === 'retest') return 'bg-amber-100 text-amber-800';
    }
    return rowIndex === 0 ? 'bg-blue-50' : 'bg-white';
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

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-lg border border-slate-200">
      <table className="table-fixed border-collapse text-sm" style={{ width: tableWidth, minWidth: tableWidth, maxWidth: tableWidth }}>
        <colgroup>
          <col className="w-12" />
          {table.columns.map((column) => (
            <col key={column.id} style={{ width: columnWidth(column.width), minWidth: columnWidth(column.width), maxWidth: columnWidth(column.width) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 h-8 w-12 border border-slate-200 bg-slate-100 text-slate-400" />
            {table.columns.map((column, index) => (
              <th
                key={column.id}
                className="relative h-8 overflow-hidden border border-slate-200 bg-slate-100 px-2 text-center text-xs font-semibold text-slate-500"
              >
                <div className="flex items-center justify-center gap-2">
                  <span>{columnLetter(index)}</span>
                  {table.columns.length > 1 ? (
                    <button
                      className="grid h-5 w-5 place-items-center text-slate-400 hover:text-rose-600"
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
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none bg-transparent hover:bg-primary/20"
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
              <th className="sticky left-0 z-10 h-9 w-12 border border-slate-200 bg-slate-100 text-center text-xs font-semibold text-slate-500">
                <div className="flex items-center justify-center gap-1">
                  <span>{rowIndex + 1}</span>
                  {table.rows.length > 1 ? (
                    <button
                      className="grid h-5 w-5 place-items-center text-slate-400 hover:text-rose-600"
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
                const value = row.cells[column.id] || '';
                const colorClass = cellClass(rowIndex, column.id, value);
                return (
                  <td
                    key={column.id}
                    className={`overflow-hidden border border-slate-200 p-0 ${colorClass}`}
                  >
                    <textarea
                      className={`block min-h-9 w-full resize-none whitespace-normal break-words bg-transparent px-2 py-2 leading-5 outline-none ${rowIndex === 0 ? 'font-semibold' : ''} ${selected ? 'ring-2 ring-inset ring-primary' : 'focus:ring-2 focus:ring-inset focus:ring-primary'}`}
                      data-column-index={columnIndex}
                      data-row-index={rowIndex}
                      data-spreadsheet-table={table._id}
                      rows={1}
                      value={value}
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
  );
}
