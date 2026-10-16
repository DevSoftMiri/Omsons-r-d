import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('./formulaUtils.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { evaluateCell } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
function table(values) {
  const columns = Array.from({length: Math.max(...values.map(row => row.length))}, (_, i) => ({id: `c${i}`}));
  return { _id: 'test', name: 'Imported', columns, rows: values.map((row, i) => ({id: `r${i}`, cells: Object.fromEntries(columns.map((col, c) => [col.id, row[c] || '']))})) };
}
test('custom arithmetic formulas and absolute references work in individual cells', () => {
  const sheet = table([['2', '3', '=A1+B1', '=A1*B1', '=(B1-A1)/A1', '= $A$1 + B$1 ']]);
  assert.deepEqual([2, 3, 4, 5].map(c => evaluateCell(sheet, 0, c)), ['5', '6', '0.5', '5']);
  sheet.rows[0].cells.c0 = '4';
  assert.equal(evaluateCell(sheet, 0, 2), '7');
});
test('imported formatted numeric text works with arithmetic and aggregates ignore blanks and text', () => {
  const sheet = table([['1,200', '12.5%', '=A1*B1'], ['10', '20', '=AVERAGE(A2:B3)'], ['', 'label', '=COUNT(A2:B3)']]);
  assert.equal(evaluateCell(sheet, 0, 2), '150');
  assert.equal(evaluateCell(sheet, 1, 2), '15');
  assert.equal(evaluateCell(sheet, 2, 2), '2');
});
test('ranges beyond Z and reversed ranges evaluate correctly', () => {
  const row = Array(29).fill(''); row[25] = '2'; row[26] = '3'; row[27] = '=SUM(Z1:AA1)'; row[28] = '=SUM(AA1:Z1)';
  const sheet = table([row]);
  assert.equal(evaluateCell(sheet, 0, 27), '5');
  assert.equal(evaluateCell(sheet, 0, 28), '5');
});
test('invalid formulas and circular references cannot silently return numeric results', () => {
  const sheet = table([['=B1', '=A1', '=SUM(A1:B1)', '=SUM(1 2)', '=1/0', '=ZZ99']]);
  for (let c = 0; c < 6; c++) assert.match(evaluateCell(sheet, 0, c), /^#/);
});

test('Excel percentage, power, decimal and regional argument syntax', () => {
  const sheet = table([['20', '=A1*10%', '=A1^2', '=.5*A1', '=SUM(A1;2)', '=2^3^2', '=1e2+2']]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(c => evaluateCell(sheet, 0, c)), ['2', '400', '10', '22', '64', '102']);
});

test('huge ranges and long dependency chains stop without hanging', () => {
  assert.match(evaluateCell(table([['=SUM(A1:XFD1048576)']]), 0, 0), /^#/);
  const sheet = table(Array.from({length: 150}, (_, i) => [i === 149 ? '1' : `=A${i + 2}`]));
  assert.match(evaluateCell(sheet, 0, 0), /^#/);
});
