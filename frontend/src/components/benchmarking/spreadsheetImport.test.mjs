import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as XLSX from 'xlsx';

const source = readFileSync(new URL('./spreadsheetImport.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const resolved = js.replace(/from 'xlsx'/g, `from '${new URL('../../../node_modules/xlsx/xlsx.mjs', import.meta.url).href}'`);
const { readSpreadsheet, importWorksheet } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`);
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
    assert.deepEqual(values(imported)[0], ['00123', 'line 1\nline 2', '\u0939\u093f\u0928\u094d\u0926\u0940', '2024-01-01', '12.5%', '3', '=text']);
    assert.deepEqual(values(imported)[1], Array(7).fill(''));
    assert.equal(imported.rows[0].literalCells[0], imported.columns[6].id);
    assert.ok(imported.columns[0].width > 150);
    assert.equal(importWorksheet(parsed, 'Second', table).columns[0].label, 'second');
    assert.deepEqual(imported.columns.map(column => column.label), ['Name', 'Name', 'Unicode', 'Date', 'Percent', 'Formula', 'Literal']);
  });
}

test('CSV preserves quoted commas, line breaks, leading zeros, duplicate headers and blanks', async () => {
  const csv = '\uFEFFName,Name,Code\r\n"a,b","line 1\nline 2",00123\r\n,,\r\nlast,,value';
  const parsed = await readSpreadsheet(file('sample.csv', new TextEncoder().encode(csv)));
  assert.deepEqual(values(importWorksheet(parsed, parsed.SheetNames[0], table)), [
    ['a,b', 'line 1\nline 2', '00123'], ['', '', ''], ['last', '', 'value']
  ]);
});

test('reject invalid files, empty sheets and uncached formulas', async () => {
  await assert.rejects(readSpreadsheet(file('bad.xlsx', new TextEncoder().encode('garbage'))), /Unable to read/);
  await assert.rejects(readSpreadsheet(file('empty.csv', [])), /Unable to read/);
  await assert.rejects(readSpreadsheet(file('bad.pdf', [])), /Choose an/);
  assert.throws(() => importWorksheet({ Sheets: { Empty: {} } }, 'Empty', table), /empty/);
  assert.throws(() => importWorksheet({ Sheets: { Sheet: { '!ref': 'A1:B2', A1: { t: 's', v: 'Title' }, B2: { t: 'n', f: '1+2' } } } }, 'Sheet', table), /Cell B2/);
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
    assert.deepEqual(result.tables[0].columns.map(column => column.label), ['Header', 'Header']);
    assert.deepEqual(saved.rows, imported.rows);
    assert.deepEqual(values(result.tables[0]), values(imported));
  } finally {
    globalThis.localStorage = previousStorage;
    globalThis.fetch = previousFetch;
  }
});
