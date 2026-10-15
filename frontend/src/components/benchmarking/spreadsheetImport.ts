import { read, utils } from 'xlsx';
import type { WorkBook } from 'xlsx';
import type { BenchmarkingTableData } from './types';

export async function readSpreadsheet(file: File): Promise<WorkBook> {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Choose an .xlsx, .xls, or .csv file.');
  try {
    const data = await file.arrayBuffer();
    if (!data.byteLength) throw new Error('Empty file');
    // CSV must remain text: raw prevents conversion of dates and leading zeros.
    if (/\.csv$/i.test(file.name)) {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
      if (/[\x00-\x08\x0e-\x1f]/.test(text)) throw new Error('Binary file');
      return read(text.replace(/^\uFEFF/, ''), { type: 'string', raw: true });
    }
    const bytes = new Uint8Array(data);
    const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    const ole = bytes[0] === 0xd0 && bytes[1] === 0xcf;
    if (!zip && !ole) throw new Error('Invalid Excel file');
    return read(data, { type: 'array', cellStyles: true, cellText: true, sheetStubs: true });
  } catch {
    throw new Error('Unable to read this spreadsheet. Check that it is a valid, unencrypted Excel or UTF-8 CSV file.');
  }
}

export function importWorksheet(workbook: WorkBook, sheetName: string, table: BenchmarkingTableData): BenchmarkingTableData {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet?.['!ref']) throw new Error('This worksheet is empty. Choose a worksheet containing data.');
  let lastRow = -1;
  let lastColumn = -1;
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue;
    const cell = sheet[address];
    if (cell.f && cell.v == null) throw new Error(`Cell ${address} has a formula without a saved result. Open the file in Excel, recalculate, save, and import again.`);
    if (cell.v != null && String(cell.v) !== '') {
      const position = utils.decode_cell(address);
      lastRow = Math.max(lastRow, position.r);
      lastColumn = Math.max(lastColumn, position.c);
    }
  }
  if (lastRow < 0) throw new Error('This worksheet is empty. Choose a worksheet containing data.');
  // Bound work before allocating a potentially enormous sparse worksheet.
  if ((lastRow + 1) * (lastColumn + 1) > 100000) throw new Error('This worksheet is too large. Import a range of up to 100,000 cells.');
  const values = utils.sheet_to_json<string[]>(sheet, {
    header: 1, raw: false, defval: '', blankrows: true,
    range: { s: { r: 0, c: 0 }, e: { r: lastRow, c: lastColumn } }
  });
  const columns = Array.from({ length: lastColumn + 1 }, (_, index) => {
    const source = sheet['!cols']?.[index];
    const longest = Math.max(0, ...values.map(row => Math.max(0, ...String(row[index] ?? '').split('\n').map(line => line.length))));
    const width = source?.wpx ?? (source?.wch != null ? source.wch * 7 + 5 : source?.width != null ? source.width * 7 : Math.max(120, longest * 7 + 24));
    return { id: `col_${crypto.randomUUID()}`, label: String(values[0]?.[index] ?? ''), width: Math.max(40, Math.min(520, Math.round(width))) };
  });
  return {
    ...table, columns,
    rows: values.slice(1).map(row => ({
      id: `row_${crypto.randomUUID()}`,
      literalCells: columns.filter((_, index) => String(row[index] ?? '').startsWith('=')).map(column => column.id),
      cells: Object.fromEntries(columns.map((column, index) => [column.id, String(row[index] ?? '')]))
    }))
  };
}
