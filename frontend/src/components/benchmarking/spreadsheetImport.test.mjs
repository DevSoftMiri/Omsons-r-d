import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as XLSX from 'xlsx';

const source = readFileSync(new URL('./spreadsheetImport.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const resolved = js.replace(/from 'xlsx'/g, `from '${new URL('../../../node_modules/xlsx/xlsx.mjs', import.meta.url).href}'`);
const testModule = resolved.replace("new URL('./spreadsheetImport.worker.ts', import.meta.url)", `new URL('${new URL('./spreadsheetImport.worker.ts', import.meta.url).href}')`);
const { readSpreadsheet, importWorksheet } = await import(`data:text/javascript;base64,${Buffer.from(testModule).toString('base64')}`);
const table = { _id: 'existing', name: 'Comparison', columns: [], rows: [] };
const values = result => result.rows.map(row => result.columns.map(col => row.cells[col.id]));
const file = (name, data) => ({ name, arrayBuffer: async () => new Uint8Array(data).buffer });

for (const bookType of ['xlsx', 'xls']) {
  test(`${bookType}: preserve displayed values, worksheet choice and blank positions`, async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Name', 'Unicode', 'Date', 'Percent', 'Formula', 'Literal'],
      ['00123', 'line 1\nline 2', '\u0939\u093f\u0928\u094d\u0926\u0940', 45292, 0.125, 3, '=text'],
      [], ['last', '', 'value']
    ]);
    sheet.D2.z = 'yyyy-mm-dd';
    sheet.E2.z = '0.0%';
    sheet.F2.f = '1+2';
    sheet['!cols'] = [{ wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'First');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['second']]), 'Second');
    const parsed = await readSpreadsheet(file(`sample.${bookType}`, XLSX.write(wb, { type: 'array', bookType })));
    assert.deepEqual(parsed.SheetNames, ['First', 'Second']);
    const imported = importWorksheet(parsed, 'First', table);
    assert.equal(imported._id, table._id);
    assert.equal(imported.name, table.name);
    assert.deepEqual(values(imported)[1], ['00123', 'line 1\nline 2', '\u0939\u093f\u0928\u094d\u0926\u0940', '2024-01-01', '12.5%', parsed.Sheets.First.F2.f ? '=1+2' : '3', '=text']);
    assert.deepEqual(values(imported)[2], Array(7).fill(''));
    assert.equal(imported.rows[1].literalCells[0], imported.columns[6].id);
    assert.ok(imported.columns[0].width > 150);
    assert.equal(values(importWorksheet(parsed, 'Second', table))[0][0], 'second');
    assert.deepEqual(values(imported)[0], ['Name', 'Name', 'Unicode', 'Date', 'Percent', 'Formula', 'Literal']);
    assert.ok(imported.columns.every(column => column.label === undefined));
  });
}

test('CSV preserves quoted commas, line breaks, leading zeros, duplicate headers and blanks', async () => {
  const csv = '\uFEFFName,Name,Code\r\n"a,b","line 1\nline 2",00123\r\n,,\r\nlast,,value';
  const parsed = await readSpreadsheet(file('sample.csv', new TextEncoder().encode(csv)));
  assert.deepEqual(values(importWorksheet(parsed, parsed.SheetNames[0], table)), [
    ['Name', 'Name', 'Code'], ['a,b', 'line 1\nline 2', '00123'], ['', '', ''], ['last', '', 'value']
  ]);
});

test('reject invalid files and empty sheets; preserve uncached formulas', async () => {
  await assert.rejects(readSpreadsheet(file('bad.xlsx', new TextEncoder().encode('garbage'))), /Unable to read/);
  await assert.rejects(readSpreadsheet(file('empty.csv', [])), /Unable to read/);
  await assert.rejects(readSpreadsheet(file('bad.pdf', [])), /Choose an/);
  assert.throws(() => importWorksheet({ Sheets: { Empty: {} } }, 'Empty', table), /empty/);
  assert.equal(values(importWorksheet({ Sheets: { Sheet: { '!ref': 'A1:B2', A1: { t: 's', v: 'Title' }, B2: { t: 'n', f: '1+2' } } } }, 'Sheet', table))[1][1], '=1+2');
  assert.deepEqual(table.rows, []);
});

test('structured imports survive local storage and use the authenticated table update API', async () => {
  const serviceSource = readFileSync(new URL('../../services/benchmarkingService.ts', import.meta.url), 'utf8').replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
  const serviceJs = ts.transpileModule(serviceSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const service = await import(`data:text/javascript;base64,${Buffer.from(serviceJs).toString('base64')}`);
  const store = new Map();
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  try {
    const initial = await service.fetchBenchmarking('project');
    const sheet = XLSX.utils.aoa_to_sheet([['Header', 'Header'], ['001', 'long\ntext']]);
    const imported = importWorksheet({ Sheets: { Sheet: sheet } }, 'Sheet', initial.tables[0]);
    await service.updateBenchmarkingTable('project', imported);
    assert.deepEqual(values((await service.fetchBenchmarking('project')).tables[0]), values(imported));
    store.set('token', 'test-token');
    let saved;
    globalThis.fetch = async (url, options) => {
      assert.equal(url, `/api/projects/project/benchmarking/tables/${imported._id}`);
      assert.equal(options.method, 'PATCH');
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      saved = JSON.parse(options.body);
      return { ok: true, json: async () => ({ tables: [{ ...imported, ...saved }], reviewStatus: 'draft' }) };
    };
    const result = await service.updateBenchmarkingTable('project', imported);
    assert.deepEqual(saved.columns, imported.columns);
    assert.deepEqual(values(result.tables[0])[0], ['Header', 'Header']);
    assert.deepEqual(saved.rows, imported.rows);
    assert.deepEqual(values(result.tables[0]), values(imported));
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.fetch = previousFetch;
  }
});

for (const bookType of ['xlsx', 'xls']) {
  test(`${bookType}: keep a single-row worksheet visible and preserve leading blank coordinates`, async () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Only row', '001']]), 'Single');
    const offset = XLSX.utils.aoa_to_sheet([['Value', 7]], { origin: 'C3' });
    XLSX.utils.book_append_sheet(book, offset, 'Offset');
    const parsed = await readSpreadsheet(file(`positions.${bookType}`, XLSX.write(book, {type: 'array', bookType})));
    assert.deepEqual(values(importWorksheet(parsed, 'Single', table)), [['Only row', '001']]);
    assert.deepEqual(values(importWorksheet(parsed, 'Offset', table)), [
      ['', '', '', ''], ['', '', '', ''], ['', '', 'Value', '7']
    ]);
  });
}

test('imported Excel formulas recalculate after their source cells change', async () => {
  const formulaSource = readFileSync(new URL('./formulaUtils.ts', import.meta.url), 'utf8');
  const formulaJs = ts.transpileModule(formulaSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  const { evaluateCell } = await import(`data:text/javascript;base64,${Buffer.from(formulaJs).toString('base64')}`);
  const sheet = XLSX.utils.aoa_to_sheet([['Input', 'Input', 'Total'], [2, 3, 5]]);
  sheet.C2.f = 'SUM(A2:B2)';
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Sheet');
  const parsed = await readSpreadsheet(file('formulas.xlsx', XLSX.write(book, {type: 'array', bookType: 'xlsx'})));
  const imported = importWorksheet(parsed, 'Sheet', table);
  assert.equal(imported.rows[1].cells[imported.columns[2].id], '=SUM(A2:B2)');
  assert.equal(evaluateCell(imported, 1, 2), '5');
  imported.rows[1].cells[imported.columns[0].id] = '10';
  assert.equal(evaluateCell(imported, 1, 2), '13');
});

test('oversized spreadsheet fails before reading its contents', async () => {
  let read = false;
  await assert.rejects(readSpreadsheet({ name: 'large.xlsx', size: 11 * 1024 * 1024, arrayBuffer: async () => { read = true; return new ArrayBuffer(0); } }), /10 MB/);
  assert.equal(read, false);
});

test('spreadsheet workers are terminated on success and processing failure', async () => {
  const original = globalThis.Worker;
  let terminated = 0;
  const workbook = { SheetNames: ['Sheet'], Sheets: {} };
  try {
    globalThis.Worker = class {
      postMessage() { queueMicrotask(() => this.onmessage({ data: { workbook } })); }
      terminate() { terminated++; }
    };
    assert.deepEqual(await readSpreadsheet(file('worker.csv', new TextEncoder().encode('a,b'))), workbook);
    globalThis.Worker = class {
      postMessage() { queueMicrotask(() => this.onerror()); }
      terminate() { terminated++; }
    };
    await assert.rejects(readSpreadsheet(file('worker.csv', new TextEncoder().encode('a,b'))), /Unable to process/);
    assert.equal(terminated, 2);
  } finally {
    if (original === undefined) delete globalThis.Worker;
    else globalThis.Worker = original;
  }
});

test('Add Table saves imported data instead of creating blank cells', async () => {
  const source = readFileSync(new URL('../../services/benchmarkingService.ts', import.meta.url), 'utf8').replace('import.meta.env.VITE_API_BASE_URL', 'undefined');
  const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2020}}).outputText;
  const service = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  const original = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value)};
  try {
    const importedTable = importWorksheet({Sheets:{Sheet:XLSX.utils.aoa_to_sheet([['Part', 'Qty'], ['Motor', 2]])}}, 'Sheet', table);
    const result = await service.createBenchmarkingTable('add-import-test', {name:'Imported BOM', initialColumns:2, initialRows:2, importedTable});
    const created = result.tables[result.tables.length - 1];
    assert.equal(created.name, 'Imported BOM');
    assert.deepEqual(values(created), [['Part', 'Qty'], ['Motor', '2']]);
    assert.notEqual(created._id, importedTable._id);
  } finally { globalThis.localStorage = original; }
});
