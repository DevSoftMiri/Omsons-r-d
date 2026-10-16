import { useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { ClipboardEvent, KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { BenchmarkingTableData, SelectedCell } from './types';
import { evaluateCell } from './formulaUtils';

const DEFAULT_COLUMN_WIDTH = 176;
const MIN_COLUMN_WIDTH = 40;
const MAX_COLUMN_WIDTH = 520;

const KEYBOARD_SHORTCUTS = [
  ['Ctrl + B', 'Toggle bold for selected cells'],
  ['Ctrl + C', 'Copy selected cells or rows'],
  ['Ctrl + X', 'Cut selected cells or rows'],
  ['Ctrl + V', 'Paste copied content'],
  ['Ctrl + Z', 'Undo the last change'],
  ['Ctrl + Y', 'Redo the last change'],
  ['Delete', 'Clear contents'],
  ['F2 / double-click', 'Edit cell'],
  ['Shift + Space', 'Select row'],
  ['Ctrl + Space', 'Select column'],
  ['Ctrl + A', 'Select all cells'],
  ['Ctrl + Shift + +', 'Insert row above'],
  ['Ctrl + -', 'Delete selected rows'],
  ['Ctrl + D', 'Copy full row down; add a row at the end'],
  ['Ctrl + R', 'Fill right'],
  ['Arrow keys', 'Move between cells'],
  ['Tab / Shift + Tab', 'Next / previous cell'],
  ['Enter', 'Save and move down'],
  ['Esc', 'Cancel editing'],
  ['Shift + Arrow keys', 'Extend selection'],
];

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
  onChangeTable,
  onUndo,
  onRedo,
  onPasteCells,
  onDeleteRow,
  onDeleteColumn,
  onResizeColumn,
}: {
  table: BenchmarkingTableData;
  selectedCell: SelectedCell | null;
  onSelectCell: (cell: SelectedCell) => void;
  onChangeTable: (table: BenchmarkingTableData) => void;
  onUndo: () => void;
  onRedo: () => void;
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
  const rowsPerPage = Math.max(1, Math.min(50, Math.floor(2000 / Math.max(1, table.columns.length))));
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(table.rows.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const rowDrag = useRef<{ rowId: string; startY: number; startHeight: number; height: number } | null>(null);
  const [rowPreview, setRowPreview] = useState<{ rowId: string; height: number } | null>(null);
  function rowHeight(row: BenchmarkingTableData['rows'][number]) {
    return rowPreview?.rowId === row.id ? rowPreview.height : row.height;
  }
  function saveRowHeight(rowId: string, height: number | undefined) {
    onChangeTable({ ...table, rows: table.rows.map(row => row.id === rowId ? { ...row, height } : row) });
  }

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
    if ((column?.label !== undefined || rowIndex > 0) && header === 'results') {
      if (normalized === 'pass') return 'bg-emerald-50 text-emerald-800';
      if (normalized === 'fail') return 'bg-rose-50 text-rose-800';
      if (normalized === 'retest') return 'bg-amber-50 text-amber-800';
    }
    return 'bg-white';
  }

  const root = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<[number, number] | null>(null);
  const [extent, setExtent] = useState<[number, number] | null>(null);
  const [editing, setEditing] = useState<{ row: number; column: number; original: string } | null>(null);
  function bounds(row: number, column: number) {
    const a = anchor || [row, column];
    const b = extent || a;
    return [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[1], b[1])];
  }
  function focusCell(row: number, column: number, extend = false) {
    row = Math.max(0, Math.min(table.rows.length - 1, row));
    column = Math.max(0, Math.min(table.columns.length - 1, column));
    if (!extend) setAnchor([row, column]);
    setExtent([row, column]);
    setPage(Math.floor(row / rowsPerPage));
    requestAnimationFrame(() => root.current?.querySelector<HTMLTextAreaElement>(`[data-row-index="${row}"][data-column-index="${column}"]`)?.focus());
  }
  function changeRange(row: number, column: number, value: (r: number, c: number) => string) {
    const [r0, r1, c0, c1] = bounds(row, column);
    onChangeTable({ ...table, rows: table.rows.map((item, r) => {
      if (r < r0 || r > r1) return item;
      const cells = { ...item.cells };
      for (let c = c0; c <= c1; c++) cells[table.columns[c].id] = value(r, c);
      return { ...item, cells, literalCells: item.literalCells?.filter(id => !table.columns.slice(c0, c1 + 1).some(col => col.id === id)) };
    }) });
  }
  function clipboard(event: ClipboardEvent<HTMLTextAreaElement>, row: number, column: number, cut: boolean) {
    if (editing) return;
    event.preventDefault();
    const [r0, r1, c0, c1] = bounds(row, column);
    event.clipboardData.setData('text/plain', table.rows.slice(r0, r1 + 1).map(item => table.columns.slice(c0, c1 + 1).map(col => item.cells[col.id] || '').join('\t')).join('\n'));
    if (cut) changeRange(row, column, () => '');
  }
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>, rowId: string, columnId: string) {
    const text = event.clipboardData.getData('text/plain');
    if (editing && !text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    const normalized = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
    const row = table.rows.findIndex(item => item.id === rowId);
    const column = table.columns.findIndex(item => item.id === columnId);
    const [r0, , c0] = bounds(row, column);
    onPasteCells(table.rows[r0].id, table.columns[c0].id, normalized.split('\n').map(row => row.split('\t')));
  }
  function isCellBold(row: number, column: number) {
    return table.rows[row].cellBold?.[table.columns[column].id]
      ?? (row === 0 && !table.columns.some(item => item.label !== undefined));
  }
  function toggleBold(row: number, column: number) {
    const [r0, r1, c0, c1] = bounds(row, column);
    let allBold = true;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (!isCellBold(r, c)) allBold = false;
      }
    }
    onChangeTable({ ...table, rows: table.rows.map((item, r) => {
      if (r < r0 || r > r1) return item;
      const cellBold = { ...item.cellBold };
      for (let c = c0; c <= c1; c++) cellBold[table.columns[c].id] = !allBold;
      return { ...item, cellBold };
    }) });
  }
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>, row: number, column: number) {
    if (event.nativeEvent.isComposing) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const stop = () => event.preventDefault();
    if (ctrl && key === 'b') { stop(); toggleBold(row, column); return; }
    if (ctrl && (key === 'z' || key === 'y')) { stop(); setEditing(null); if (key === 'y' || event.shiftKey) onRedo(); else onUndo(); return; }
    if (key === 'escape') {
      stop();
      if (editing) onCellChange(table.rows[editing.row].id, table.columns[editing.column].id, editing.original);
      setEditing(null); setAnchor([row, column]); setExtent([row, column]); return;
    }
    if (key === 'f2') { stop(); setEditing({ row, column, original: table.rows[row].cells[table.columns[column].id] || '' }); return; }
    if (key === 'enter' || key === 'tab') {
      stop(); setEditing(null);
      if (key === 'enter') focusCell(row + (event.shiftKey ? -1 : 1), column);
      else { const next = row * table.columns.length + column + (event.shiftKey ? -1 : 1); if (next >= 0 && next < table.rows.length * table.columns.length) focusCell(Math.floor(next / table.columns.length), next % table.columns.length); }
      return;
    }
    if (editing) return;
    if (ctrl && key === 'a') { stop(); setAnchor([0, 0]); setExtent([table.rows.length - 1, table.columns.length - 1]); return; }
    if (key === ' ' && (ctrl || event.shiftKey)) { stop(); setAnchor(ctrl ? [0, column] : [row, 0]); setExtent(ctrl ? [table.rows.length - 1, column] : [row, table.columns.length - 1]); return; }
    if (ctrl && (key === '+' || (event.shiftKey && key === '='))) {
      stop(); const [r0] = bounds(row, column); const rows = [...table.rows];
      rows.splice(r0, 0, { id: `row_${crypto.randomUUID()}`, cells: Object.fromEntries(table.columns.map(col => [col.id, ''])) });
      onChangeTable({ ...table, rows }); focusCell(r0, column); return;
    }
    if (ctrl && (key === '-' || key === '\u2212')) {
      stop(); const [r0, r1] = bounds(row, column);
      const rows = table.rows.filter((_, index) => index < r0 || index > r1);
      if (rows.length) { onChangeTable({ ...table, rows }); setAnchor(null); setExtent(null); requestAnimationFrame(() => focusCell(Math.min(r0, rows.length - 1), column)); }
      return;
    }
    if (ctrl && key === 'd') {
      stop();
      const source = table.rows[row];
      const rows = [...table.rows];
      const target = rows[row + 1];
      const copiedRow = {
        ...(target || source),
        id: target?.id || `row_${crypto.randomUUID()}`,
        cells: { ...source.cells },
        cellBold: source.cellBold ? { ...source.cellBold } : undefined,
        literalCells: source.literalCells ? [...source.literalCells] : undefined,
      };
      if (target) rows[row + 1] = copiedRow;
      else rows.push(copiedRow);
      onChangeTable({ ...table, rows });
      return;
    }
    if (ctrl && key === 'r') {
      stop();
      const [r0, r1, c0, c1] = bounds(row, column);
      if (c0 === c1) {
        // A single selected column fills the adjacent column to its right.
        const nextColumn = table.columns[c0 + 1];
        if (!nextColumn) return;
        onChangeTable({ ...table, rows: table.rows.map((item, index) =>
          index < r0 || index > r1 ? item : {
            ...item,
            cells: { ...item.cells, [nextColumn.id]: item.cells[table.columns[c0].id] || '' },
            literalCells: item.literalCells?.filter(id => id !== nextColumn.id),
          }
        ) });
      } else {
        changeRange(row, column, r => table.rows[r].cells[table.columns[c0].id] || '');
      }
      return;
    }
    if (key === 'delete' || key === 'backspace') { stop(); changeRange(row, column, () => ''); return; }
    const direction = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
    if (direction && !ctrl && !event.altKey) { stop(); focusCell(row + direction[0], column + direction[1], event.shiftKey); return; }
    if (!ctrl && !event.altKey && event.key.length === 1) {
      stop(); setEditing({ row, column, original: table.rows[row].cells[table.columns[column].id] || '' });
      onCellChange(table.rows[row].id, table.columns[column].id, event.key);
    }
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
    <div ref={root} className="space-y-2">
      <details className="rounded-lg border border-slate-200 bg-white text-xs text-black">
        <summary className="cursor-pointer px-3 py-2 font-semibold">Keyboard shortcuts</summary>
        <dl className="grid gap-x-6 gap-y-3 border-t border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-3">
          {KEYBOARD_SHORTCUTS.map(([shortcut, description]) => (
            <div key={shortcut} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <dt><kbd className="inline-block rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold">{shortcut}</kbd></dt>
              <dd className="min-w-0 flex-1 leading-5">{description}</dd>
            </div>
          ))}
        </dl>
      </details>
      <div className="flex min-w-0 items-center overflow-hidden rounded-md border border-slate-300 bg-white text-black focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
        <output aria-label="Selected cell address" className="flex h-10 w-20 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 font-mono text-sm">
          {selectedRowIndex >= 0 && selectedColumnIndex >= 0 ? `${columnLetter(selectedColumnIndex)}${selectedRowIndex + 1}` : ''}
        </output>
        <label htmlFor={`formula-${table._id}`} className="shrink-0 px-3 font-serif text-lg italic" title="Formula bar">fx</label>
        <input
          id={`formula-${table._id}`}
          className="h-10 min-w-0 flex-1 bg-white pr-3 font-mono text-sm text-black outline-none disabled:bg-slate-50"
          value={selectedRawValue}
          disabled={selectedRowIndex < 0 || selectedColumnIndex < 0}
          placeholder="Enter a value or formula, e.g. =A1+B1"
          onChange={(event) => {
            if (selectedRowIndex >= 0 && selectedColumnIndex >= 0) {
              onCellChange(table.rows[selectedRowIndex].id, table.columns[selectedColumnIndex].id, event.target.value);
            }
          }}
          onFocus={() => {
            if (selectedRowIndex >= 0 && selectedColumnIndex >= 0) setEditing({ row: selectedRowIndex, column: selectedColumnIndex, original: selectedRawValue });
          }}
          onBlur={() => setEditing(null)}
          onKeyDown={event => {
            if (selectedRowIndex >= 0 && selectedColumnIndex >= 0) handleKeyDown(event, selectedRowIndex, selectedColumnIndex);
          }}
          aria-label="Formula bar"
        />
      </div>
      {pageCount > 1 && <div className="flex items-center justify-between gap-3 text-xs text-black">
        <button type="button" className="secondary-button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous rows</button>
        <span>Rows {currentPage * rowsPerPage + 1}-{Math.min((currentPage + 1) * rowsPerPage, table.rows.length)} of {table.rows.length}</span>
        <button type="button" className="secondary-button" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next rows</button>
      </div>}
      <div className="w-full max-w-full overflow-auto rounded-lg border border-[#00494B]">
        <table className="table-fixed border-collapse text-left text-xs" style={{ width: tableWidth, minWidth: tableWidth, maxWidth: tableWidth }}>
        <colgroup>
          <col style={{ width: 48, minWidth: 48, maxWidth: 48 }} />
          {table.columns.map((column) => (
            <col key={column.id} style={{ width: columnWidth(column.width), minWidth: columnWidth(column.width), maxWidth: columnWidth(column.width) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="h-9 w-12 border border-[#B3C9CA] bg-white px-1.5 py-2.5 text-center font-extrabold text-black" />
            {table.columns.map((column, index) => (
              <th
                key={column.id}
                className="relative h-9 overflow-hidden border border-[#B3C9CA] bg-white px-2 py-2.5 text-center font-extrabold leading-tight text-black"
              >
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded px-1 py-1 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`Select column ${columnLetter(index)}`}
                    title={`Select column ${columnLetter(index)}`}
                    onClick={() => {
                      if (!table.rows.length) return;
                      setEditing(null);
                      focusCell(0, index);
                      setAnchor([0, index]);
                      setExtent([table.rows.length - 1, index]);
                    }}
                  >
                    {columnLetter(index)}
                  </button>
                  {table.columns.length > 1 ? (
                    <button
                      type="button"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black transition hover:bg-rose-50 hover:text-rose-600"
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
          {table.rows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage).map((row, visibleIndex) => {
            const rowIndex = currentPage * rowsPerPage + visibleIndex;
            return (
            <tr key={row.id}>
              <th className="relative h-9 w-12 select-none border border-[#B3C9CA] px-1.5 text-center text-xs font-extrabold text-black">
                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded py-1 hover:bg-sky-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`Select row ${rowIndex + 1}`}
                    title={`Select row ${rowIndex + 1}`}
                    onClick={() => {
                      if (!table.columns.length) return;
                      setEditing(null);
                      focusCell(rowIndex, 0);
                      setAnchor([rowIndex, 0]);
                      setExtent([rowIndex, table.columns.length - 1]);
                    }}
                  >{rowIndex + 1}</button>
                  {table.rows.length > 1 ? (
                    <button
                      type="button"
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black transition hover:bg-rose-50 hover:text-rose-600"
                      title="Delete row"
                      onClick={() => onDeleteRow(row.id)}
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="absolute bottom-0 left-0 z-10 h-2 w-full cursor-row-resize touch-none bg-transparent transition hover:bg-primary/30 focus-visible:bg-primary/30"
                  aria-label={`Resize row ${rowIndex + 1}`}
                  title="Drag to resize row; double-click to fit content"
                  onPointerDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    const height = event.currentTarget.closest('tr')?.getBoundingClientRect().height || 36;
                    rowDrag.current = { rowId: row.id, startY: event.clientY, startHeight: height, height };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={event => {
                    const drag = rowDrag.current;
                    if (!drag || drag.rowId !== row.id) return;
                    drag.height = Math.min(1000, Math.max(36, Math.round(drag.startHeight + event.clientY - drag.startY)));
                    setRowPreview({ rowId: row.id, height: drag.height });
                  }}
                  onPointerUp={() => {
                    const drag = rowDrag.current;
                    if (drag) saveRowHeight(drag.rowId, drag.height);
                    rowDrag.current = null;
                    setRowPreview(null);
                  }}
                  onPointerCancel={() => { rowDrag.current = null; setRowPreview(null); }}
                  onLostPointerCapture={() => { rowDrag.current = null; setRowPreview(null); }}
                  onDoubleClick={() => saveRowHeight(row.id, undefined)}
                  onKeyDown={event => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    const height = event.currentTarget.closest('tr')?.getBoundingClientRect().height || 36;
                    saveRowHeight(row.id, Math.min(1000, Math.max(36, height + (event.key === 'ArrowDown' ? 8 : -8))));
                  }}
                />
              </th>
              {table.columns.map((column, columnIndex) => {
                const selected =
                  selectedCell?.tableId === table._id &&
                  selectedCell.rowId === row.id &&
                  selectedCell.columnId === column.id;
                const [r0, r1, c0, c1] = bounds(selectedRowIndex, selectedColumnIndex);
                const inRange = selectedRowIndex >= 0 && rowIndex >= r0 && rowIndex <= r1 && columnIndex >= c0 && columnIndex <= c1;
                const fontWeight = isCellBold(rowIndex, columnIndex) ? 800 : 400;
                const isEditing = editing?.row === rowIndex && editing?.column === columnIndex;
                const rawValue = row.cells[column.id] || '';
                const value = evaluateCell(table, rowIndex, columnIndex);
                const colorClass = cellClass(rowIndex, column.id, value);
                return (
                  <td
                    key={column.id}
                    className={`overflow-hidden border border-[#B3C9CA] p-0 align-top ${inRange ? 'bg-sky-100' : colorClass}`}
                  >
                    <div className="relative min-h-9 overflow-hidden" style={rowHeight(row) !== undefined ? { height: rowHeight(row) } : undefined}>
                      {/* The mirror sizes the cell through normal CSS layout, without measuring or observing the grid. */}
                      <div
                        aria-hidden="true"
                        style={{ fontWeight }}
                        className={`invisible min-h-9 whitespace-pre-wrap break-words px-2 py-2 text-xs ${rowIndex === 0 && !table.columns.some(column => column.label !== undefined) ? 'font-extrabold' : ''}`}
                      >{`${isEditing ? rawValue : value} `}</div>
                    <textarea
                      style={{ fontWeight }}
                      className={`absolute inset-0 block h-full w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-transparent px-2 py-2 text-xs text-black outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${rowIndex === 0 && !table.columns.some(column => column.label !== undefined) ? 'font-extrabold text-black' : ''} ${selected ? 'bg-primary/[.06] ring-2 ring-inset ring-primary' : ''}`}
                      aria-label={`Cell ${columnLetter(columnIndex)}${rowIndex + 1}`}
                      data-column-index={columnIndex}
                      data-row-index={rowIndex}
                      data-spreadsheet-table={table._id}
                      rows={1}
                      value={isEditing ? rawValue : value}
                      onChange={(event) =>
                        onCellChange(row.id, column.id, event.target.value)
                      }
                      onMouseDown={(event) => {
                        if (editing && (editing.row !== rowIndex || editing.column !== columnIndex)) {
                          const active = document.activeElement;
                          const editRow = table.rows[editing.row];
                          const editColumn = table.columns[editing.column];
                          const formula = editRow.cells[editColumn.id] || '';
                          if (formula.startsWith('=') && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) && root.current?.contains(active)) {
                            event.preventDefault();
                            const start = active.selectionStart ?? formula.length;
                            const end = active.selectionEnd ?? start;
                            const reference = `${columnLetter(columnIndex)}${rowIndex + 1}`;
                            onCellChange(editRow.id, editColumn.id, formula.slice(0, start) + reference + formula.slice(end));
                            requestAnimationFrame(() => { active.focus(); active.setSelectionRange(start + reference.length, start + reference.length); });
                            return;
                          }
                        }
                        setEditing(null);
                        if (!event.shiftKey) setAnchor([rowIndex, columnIndex]);
                        setExtent([rowIndex, columnIndex]);
                      }}
                      onDoubleClick={() => setEditing({ row: rowIndex, column: columnIndex, original: rawValue })}
                      onCopy={(event) => clipboard(event, rowIndex, columnIndex, false)}
                      onCut={(event) => clipboard(event, rowIndex, columnIndex, true)}
                      onBlur={() => setEditing(null)}
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
                    </div>
                  </td>
                );
              })}
            </tr>
          ); })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
