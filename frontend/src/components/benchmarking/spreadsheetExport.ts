import { utils, writeFile } from 'xlsx';
import type { BenchmarkingTableData } from './types';
import { evaluateCell } from './formulaUtils';

export function tableToWorkbook(table: BenchmarkingTableData) {
  const values = table.rows.map(row => table.columns.map(col => row.cells[col.id] || ''));
  const sheet = utils.aoa_to_sheet(values);
  table.rows.forEach((row, r) => table.columns.forEach((col, c) => {
    const raw = row.cells[col.id] || '';
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) sheet[utils.encode_cell({r, c})] = { t: 'n', v: Number(raw) };
    if (raw.startsWith('=') && !row.literalCells?.includes(col.id)) {
      const result = evaluateCell(table, r, c);
      const number = Number(result);
      sheet[utils.encode_cell({r, c})] = Number.isFinite(number)
        ? { t: 'n', f: raw.slice(1), v: number }
        : { t: 's', f: raw.slice(1), v: result };
    }
  }));
  sheet['!cols'] = table.columns.map(col => ({ wpx: col.width || 176 }));
  sheet['!rows'] = table.rows.map(row => row.height ? { hpx: row.height } : {});
  const book = utils.book_new();
  const name = table.name.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31).trim() || 'Table';
  utils.book_append_sheet(book, sheet, name);
  return book;
}

export function exportTableToExcel(table: BenchmarkingTableData) {
  writeFile(tableToWorkbook(table), `${table.name.replace(/[<>:"/\\|?*]/g, '-').trim() || 'Table'}.xlsx`, { bookType: 'xlsx' });
}
