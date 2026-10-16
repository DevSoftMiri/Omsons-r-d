import type { BenchmarkingTableData } from './types';

type Token = { type: 'number' | 'operator' | 'reference' | 'function' | 'paren' | 'comma' | 'colon'; value: string };

function columnIndex(reference: string) {
  return reference
    .toUpperCase()
    .split('')
    .reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /\s*(?:((?:\d+(?:\.\d*)?|\.\d+)(?:E[+\-]?\d+)?)|(\$?[A-Z]+\$?[1-9]\d*)|([A-Z]+)|([+\-*/^%])|([(),:;]))/gi;
  let position = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(expression))) {
    if (match.index !== position) throw new Error('Invalid formula');
    position = pattern.lastIndex;
    if (match[1]) tokens.push({ type: 'number', value: match[1] });
    else if (match[2]) tokens.push({ type: 'reference', value: match[2].replace(/\$/g, '') });
    else if (match[3]) tokens.push({ type: 'function', value: match[3].toUpperCase() });
    else if (match[4]) tokens.push({ type: 'operator', value: match[4] });
    else if (match[5] === '(' || match[5] === ')') tokens.push({ type: 'paren', value: match[5] });
    else if (match[5] === ',' || match[5] === ';') tokens.push({ type: 'comma', value: ',' });
    else tokens.push({ type: 'colon', value: match[5] });
  }
  if (position !== expression.length) throw new Error('Invalid formula');
  return tokens;
}

export function evaluateCell(table: BenchmarkingTableData, rowIndex: number, columnIndexValue: number, stack = new Set<string>(), budget = { remaining: 20000 }): string {
  if (--budget.remaining < 0 || stack.size > 100) return '#LIMIT!';
  const row = table.rows[rowIndex];
  const column = table.columns[columnIndexValue];
  if (!row || !column) return '';
  const raw = row.cells[column.id] || '';
  if (!raw.startsWith('=') || row.literalCells?.includes(column.id)) return raw;
  const key = `${rowIndex}:${columnIndexValue}`;
  if (stack.has(key)) return '#CYCLE!';
  stack.add(key);
  try {
    if (raw.length > 10000) return '#LIMIT!';
    const tokens = tokenize(raw.slice(1).trim().toUpperCase());
    let position = 0;
    const numericReference = (r: number, c: number): number | null => {
      if (!table.rows[r] || !table.columns[c]) throw new Error('Invalid reference');
      const text = evaluateCell(table, r, c, new Set(stack), budget).trim();
      if (text.startsWith('#')) throw new Error(text);
      if (!text) return null;
      const normalized = text.replace(/,/g, '');
      const percent = normalized.endsWith('%');
      const value = Number(percent ? normalized.slice(0, -1) : normalized);
      return Number.isFinite(value) ? value / (percent ? 100 : 1) : null;
    };
    const valuesForReference = (reference: string) => {
      const match = reference.match(/^([A-Z]+)(\d+)$/);
      if (!match) throw new Error('Invalid reference');
      return numericReference(Number(match[2]) - 1, columnIndex(match[1])) ?? 0;
    };
    const parseExpression = (): number => {
      let value = parseTerm();
      while (tokens[position]?.type === 'operator' && ['+', '-'].includes(tokens[position].value)) {
        const operator = tokens[position++].value;
        const right = parseTerm();
        value = operator === '+' ? value + right : value - right;
      }
      return value;
    };
    const parsePercent = (): number => {
      let value = parseFactor();
      while (tokens[position]?.value === '%') { position++; value /= 100; }
      return value;
    };
    const parsePower = (): number => {
      let value = parsePercent();
      while (tokens[position]?.value === '^') { position++; value = value ** parsePercent(); }
      return value;
    };
    const parseTerm = (): number => {
      let value = parsePower();
      while (tokens[position]?.type === 'operator' && ['*', '/'].includes(tokens[position].value)) {
        const operator = tokens[position++].value;
        const right = parsePower();
        value = operator === '*' ? value * right : value / right;
      }
      return value;
    };
    const parseFactor = (): number => {
      const token = tokens[position++];
      if (!token) throw new Error('Invalid formula');
      if (token.type === 'number') return Number(token.value);
      if (token.type === 'operator' && token.value === '-') return -parseFactor();
      if (token.type === 'operator' && token.value === '+') return parseFactor();
      if (token.type === 'reference') {
        if (tokens[position]?.type === 'colon') throw new Error('Range requires a function');
        return valuesForReference(token.value);
      }
      if (token.type === 'function') {
        const functionName = token.value;
        if (tokens[position++]?.value !== '(') throw new Error('Invalid function');
        const values: number[] = [];
        while (tokens[position] && tokens[position].value !== ')') {
          if (tokens[position].type === 'reference' && tokens[position + 1]?.type === 'colon') {
            const start = tokens[position++].value;
            position++;
            const endToken = tokens[position++];
            if (endToken?.type !== 'reference') throw new Error('Invalid range');
            const end = endToken.value;
            const startMatch = start.match(/^([A-Z]+)(\d+)$/);
            const endMatch = end.match(/^([A-Z]+)(\d+)$/);
            if (!startMatch || !endMatch) throw new Error('Invalid range');
            if (Math.max(Number(startMatch[2]), Number(endMatch[2])) > table.rows.length || Math.max(columnIndex(startMatch[1]), columnIndex(endMatch[1])) >= table.columns.length) throw new Error('Invalid range');
            for (let row = Math.min(Number(startMatch[2]), Number(endMatch[2])) - 1; row <= Math.max(Number(startMatch[2]), Number(endMatch[2])) - 1; row++) {
              for (let column = Math.min(columnIndex(startMatch[1]), columnIndex(endMatch[1])); column <= Math.max(columnIndex(startMatch[1]), columnIndex(endMatch[1])); column++) {
                const value = numericReference(row, column);
                if (value !== null) values.push(value);
              }
            }
          } else {
            values.push(parseExpression());
          }
          if (tokens[position]?.type === 'comma') {
            position++;
            if (!tokens[position] || tokens[position].value === ')') throw new Error('Missing argument');
          } else if (tokens[position]?.value !== ')') throw new Error('Missing comma');
        }
        if (tokens[position++]?.value !== ')') throw new Error('Invalid function');
        if (!values.length) return 0;
        if (functionName === 'SUM') return values.reduce((sum, value) => sum + value, 0);
        if (functionName === 'AVERAGE') return values.reduce((sum, value) => sum + value, 0) / values.length;
        if (functionName === 'MIN') return Math.min(...values);
        if (functionName === 'MAX') return Math.max(...values);
        if (functionName === 'COUNT') return values.filter(Number.isFinite).length;
        throw new Error('Unsupported function');
      }
      if (token.value === '(') {
        const value = parseExpression();
        if (tokens[position++]?.value !== ')') throw new Error('Invalid formula');
        return value;
      }
      throw new Error('Invalid formula');
    };
    const result = parseExpression();
    if (position !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid formula');
    return String(Number(result.toFixed(6)));
  } catch {
    return '#ERROR!';
  }
}
