import type { BenchmarkingTableData } from './types';
import { evaluateCell } from './formulaUtils';
export function dataTable(name: string, headers: string[], values: (string | number)[][]): BenchmarkingTableData {
  const columns = headers.map((_, i) => ({ id: `c${i}` }));
  return { _id: name, name, columns, rows: [headers, ...values].map((row, i) => ({ id: `r${i}`, cells: Object.fromEntries(columns.map((col, c) => [col.id, String(row[c] ?? '')])) })) };
}
export function tableRecords(table: BenchmarkingTableData, required: string[]) {
  const values = table.rows.map((_, r) => table.columns.map((_, c) => evaluateCell(table, r, c)));
  const headers = (values[0] || []).map(text => text.trim().toLowerCase());
  for (const label of required) if (!headers.includes(label.toLowerCase())) throw new Error(`Missing column: ${label}. Export this table to get an Excel template.`);
  return values.slice(1).filter(row => row.some(text => text.trim())).map(row => Object.fromEntries(headers.map((key, c) => [key, row[c] || ''])));
}
