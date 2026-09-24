export interface BenchmarkingColumn {
  id: string;
}

export interface BenchmarkingRow {
  id: string;
  cells: Record<string, string>;
}

export interface BenchmarkingTableData {
  _id: string;
  name: string;
  columns: BenchmarkingColumn[];
  rows: BenchmarkingRow[];
  createdAt?: string;
  updatedAt?: string;
}

export interface BenchmarkingWorkbook {
  _id?: string;
  project?: string;
  tables: BenchmarkingTableData[];
  reviewStatus: 'draft' | 'completed';
  completedAt?: string;
  updatedAt?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function localKey(projectId: string) {
  return `benchmarking:${projectId}`;
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

function makeTable(name: string, values: string[][]): BenchmarkingTableData {
  const columnCount = Math.max(...values.map((row) => row.length));
  const columns = Array.from({ length: columnCount }, (_, index) => ({ id: `col_${index + 1}` }));
  return {
    _id: makeId('table'),
    name,
    columns,
    rows: values.map((row, rowIndex) => ({
      id: `row_${rowIndex + 1}`,
      cells: columns.reduce<Record<string, string>>((cells, column, columnIndex) => {
        cells[column.id] = row[columnIndex] || '';
        return cells;
      }, {})
    }))
  };
}

function demoWorkbook(projectId: string): BenchmarkingWorkbook {
  const now = new Date().toISOString();
  return {
    _id: `local_${projectId}`,
    project: projectId,
    reviewStatus: 'draft',
    updatedAt: now,
    tables: [
      makeTable('Material Comparison', [
        ['Parameter', 'Our Target', 'Borosil (Competitor)', 'Duran (Competitor)', 'Remarks'],
        ['Glass Type', 'Borosilicate 3.3', 'Borosilicate 3.3', 'Borosilicate 3.3', 'Both meet requirement'],
        ['Thermal Resistance', '>= 500', '510', '560', 'Duran better'],
        ['Chemical Resistance', 'Excellent', 'Excellent', 'Excellent', 'All good'],
        ['Transparency', 'High', 'High', 'Very High', 'Duran slightly better'],
        ['', '', '', '', '']
      ]),
      makeTable('Dimensional Comparison', [
        ['Parameter', 'Our Target', 'Brand A', 'Brand B', 'Unit', 'Tolerance', 'Remarks'],
        ['Capacity (Nominal)', '250', '250', '250', 'ml', '+/-5%', 'Matches'],
        ['Height', '90', '88', '91', 'mm', '+/-2', 'Within range'],
        ['Top Diameter', '70', '69', '71', 'mm', '+/-2', 'Within range'],
        ['Wall Thickness', '1.5', '1.4', '1.6', 'mm', '+/-0.2', 'Brand B better'],
        ['', '', '', '', '', '', '']
      ])
    ]
  };
}

function readLocalWorkbook(projectId: string) {
  const saved = localStorage.getItem(localKey(projectId));
  if (saved) return JSON.parse(saved) as BenchmarkingWorkbook;
  const workbook = demoWorkbook(projectId);
  writeLocalWorkbook(projectId, workbook);
  return workbook;
}

function writeLocalWorkbook(projectId: string, workbook: BenchmarkingWorkbook) {
  const updated = { ...workbook, updatedAt: new Date().toISOString() };
  localStorage.setItem(localKey(projectId), JSON.stringify(updated));
  return updated;
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let cell = '';
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows.length ? rows : [['']];
}

function hasBackendAuth() {
  const token = localStorage.getItem('token');
  return Boolean(token);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json() as Promise<T>;
}

export async function fetchBenchmarking(projectId: string) {
  if (!hasBackendAuth()) return readLocalWorkbook(projectId);
  const response = await fetch(`${API_BASE}/projects/${projectId}/benchmarking`, {
    headers: authHeaders()
  });
  return parseResponse<BenchmarkingWorkbook>(response);
}

export async function createBenchmarkingTable(projectId: string, payload: { name: string; initialColumns: number; initialRows: number }) {
  if (!hasBackendAuth()) {
    const workbook = readLocalWorkbook(projectId);
    const columns = Array.from({ length: payload.initialColumns }, () => ({ id: makeId('col') }));
    const rows = Array.from({ length: payload.initialRows }, () => ({
      id: makeId('row'),
      cells: columns.reduce<Record<string, string>>((cells, column) => {
        cells[column.id] = '';
        return cells;
      }, {})
    }));
    return writeLocalWorkbook(projectId, {
      ...workbook,
      tables: [...workbook.tables, { _id: makeId('table'), name: payload.name, columns, rows }]
    });
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/benchmarking/tables`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify(payload)
  });
  return parseResponse<BenchmarkingWorkbook>(response);
}

export async function updateBenchmarkingTable(projectId: string, table: BenchmarkingTableData) {
  if (!hasBackendAuth()) {
    const workbook = readLocalWorkbook(projectId);
    return writeLocalWorkbook(projectId, {
      ...workbook,
      reviewStatus: 'draft',
      tables: workbook.tables.map((candidate) => candidate._id === table._id ? table : candidate)
    });
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/benchmarking/tables/${table._id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({
      name: table.name,
      columns: table.columns,
      rows: table.rows
    })
  });
  return parseResponse<BenchmarkingWorkbook>(response);
}

export async function deleteBenchmarkingTable(projectId: string, tableId: string) {
  if (!hasBackendAuth()) {
    const workbook = readLocalWorkbook(projectId);
    writeLocalWorkbook(projectId, {
      ...workbook,
      tables: workbook.tables.filter((table) => table._id !== tableId)
    });
    return;
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/benchmarking/tables/${tableId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
}

export async function importBenchmarkingCsv(projectId: string, tableId: string, csv: string) {
  if (!hasBackendAuth()) {
    const workbook = readLocalWorkbook(projectId);
    const imported = makeTable('Imported table', parseCsv(csv));
    return writeLocalWorkbook(projectId, {
      ...workbook,
      tables: workbook.tables.map((table) => table._id === tableId ? { ...imported, _id: tableId, name: table.name } : table)
    });
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/benchmarking/tables/${tableId}/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({ csv })
  });
  return parseResponse<BenchmarkingWorkbook>(response);
}

export async function completeBenchmarking(projectId: string) {
  if (!hasBackendAuth()) {
    const workbook = readLocalWorkbook(projectId);
    return writeLocalWorkbook(projectId, {
      ...workbook,
      reviewStatus: 'completed',
      completedAt: new Date().toISOString()
    });
  }

  const response = await fetch(`${API_BASE}/projects/${projectId}/benchmarking/complete`, {
    method: 'PATCH',
    headers: authHeaders()
  });
  return parseResponse<unknown>(response);
}
