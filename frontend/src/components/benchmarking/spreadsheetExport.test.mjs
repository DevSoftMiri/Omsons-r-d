import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as XLSX from 'xlsx';
const compile = source => ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020}}).outputText;
const formula = `data:text/javascript;base64,${Buffer.from(compile(readFileSync(new URL('./formulaUtils.ts', import.meta.url), 'utf8'))).toString('base64')}`;
const code = compile(readFileSync(new URL('./spreadsheetExport.ts', import.meta.url), 'utf8'))
  .replace(/from 'xlsx'/g, `from '${new URL('../../../node_modules/xlsx/xlsx.mjs', import.meta.url).href}'`)
  .replace("from './formulaUtils'", `from '${formula}'`);
const {tableToWorkbook} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('real xlsx export retains formulas, numeric cells, literal text, leading zeros and worksheet limits', () => {
  const table = {name: 'Test/Workbook: very long title which exceeds 31 characters', columns: [{id:'a', width: 200}, {id:'b'}, {id:'c'}, {id:'d'}], rows: [{id:'r', height:60, cells:{a:'2', b:'3', c:'=SUM(A1:B1)', d:'001'}}, {id:'r2', cells:{a:'=literal'}, literalCells:['a']}]};
  const workbook = tableToWorkbook(table);
  assert.ok(workbook.SheetNames[0].length <= 31);
  const output = XLSX.read(XLSX.write(workbook, {type:'array', bookType:'xlsx'}), {type:'array', cellStyles:true});
  const sheet = output.Sheets[output.SheetNames[0]];
  assert.equal(sheet.A1.t, 'n'); assert.equal(sheet.A1.v, 2);
  assert.equal(sheet.C1.f, 'SUM(A1:B1)'); assert.equal(sheet.C1.v, 5);
  assert.equal(sheet.D1.v, '001'); assert.equal(sheet.A2.v, '=literal'); assert.equal(sheet.A2.f, undefined);
});
