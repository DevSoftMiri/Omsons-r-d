import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AddTableModal } from '../../../components/benchmarking/AddTableModal';
import { BenchmarkingTable } from '../../../components/benchmarking/BenchmarkingTable';
import { DeleteTableDialog } from '../../../components/benchmarking/DeleteTableDialog';
import type { BenchmarkingTableData, SelectedCell } from '../../../components/benchmarking/types';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { readProductSpecifications } from '../../../services/productSpecificationsService';
import { showMissingFieldsToast } from '../../../utils/requiredFields';
import { useProjectWorkspace } from './context';

type StoredValidation = {
  tables: BenchmarkingTableData[];
  findings?: string;
  nextSteps?: string[];
  lastSaved: string;
};

function makeDefaultTables(projectCode: string) {
  const specifications = readProductSpecifications(projectCode).rows.filter((row) => row.parameter.trim() || row.specification.trim());
  return [
    makeTable('Key Features', [
      ['Key Features', 'Checkbox', 'Results'],
      ['• Advanced microprocessor-based auto-tuning PID controller for precise temperature control', '', 'Pass'],
      ['• High thermal stability up to ±0.5°C with reliable performance', '', 'Fail'],
      ['• Fine temperature control with 0.1°C resolution', '', ''],
      ['• PT100 RTD sensor for accurate temperature measurement', '', '']
    ]),
    makeTable('Validation', [
      ['Test Name', 'Required Parameter', 'Tolerance', 'Observed Parameter', 'Results'],
      ...specifications.map((row) => [row.parameter, row.specification, '', '', ''])
    ])
  ];
}

export function TestingValidation() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const storageKey = `testing-validation:${project.productCode}`;
  const initial = readStored(storageKey, project.productCode);
  const [tables, setTables] = useState(initial.tables);
  const [lastSaved, setLastSaved] = useState(initial.lastSaved);
  const [saveState, setSaveState] = useState<'Saving...' | 'Saved'>('Saved');
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BenchmarkingTableData | null>(null);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      const timestamp = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ tables, lastSaved: timestamp }));
      setLastSaved(timestamp);
      setSaveState('Saved');
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [storageKey, tables]);

  const hasMeaningfulData = useMemo(
    () => tables.some((table) => table.rows.slice(1).some((row) => Object.values(row.cells).some((value) => value.trim()))),
    [tables]
  );
  const hasFailingResult = useMemo(() => tables.some(hasFailResult), [tables]);
  const canComplete = tables.length >= 2 && hasMeaningfulData && !hasFailingResult && saveState === 'Saved';

  function updateTable(table: BenchmarkingTableData) {
    setTables((current) => current.map((candidate) => candidate._id === table._id ? table : candidate));
  }

  function createTable(values: { name: string; initialColumns: number; initialRows: number }) {
    const columns = Array.from({ length: values.initialColumns }, () => ({ id: makeId('col') }));
    const rows = Array.from({ length: values.initialRows }, () => ({
      id: makeId('row'),
      cells: columns.reduce<Record<string, string>>((cells, column) => {
        cells[column.id] = '';
        return cells;
      }, {})
    }));
    setTables((current) => [...current, { _id: makeId('table'), name: values.name, columns, rows }]);
    setShowAddModal(false);
  }

  function confirmDeleteTable() {
    if (!deleteTarget) return;
    setTables((current) => current.filter((table) => table._id !== deleteTarget._id));
    setDeleteTarget(null);
  }

  async function importCsv(table: BenchmarkingTableData, file: File) {
    const imported = makeTable(table.name, parseCsv(await file.text()));
    setTables((current) => current.map((candidate) => candidate._id === table._id ? { ...imported, _id: table._id } : candidate));
  }

  function exportCsv(table: BenchmarkingTableData) {
    const csv = table.rows
      .map((row) => table.columns.map((column) => `"${(row.cells[column.id] || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.productCode}-${table.name.replace(/\s+/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleCompleteStage() {
    const missing = [
      tables.length < 2 ? 'Key Features and Validation tables' : '',
      !hasMeaningfulData ? 'Testing and validation data' : '',
      hasFailingResult ? 'Resolve failed results' : '',
      saveState !== 'Saved' ? 'Saved changes' : ''
    ].filter(Boolean);
    if (showMissingFieldsToast(showToast, missing)) return;
    completeStage('Testing & Validation');
  }

  return (
    <div className="mx-auto min-w-0 max-w-full space-y-4 overflow-hidden text-sm 2xl:max-w-[1500px]">
      <TopCrumbs title={project.name} code={project.productCode} />
      <ProjectStageHeader project={project} currentStage="Testing & Validation" />
      <StageResponseBuilder projectCode={project.productCode} stageName="Testing & Validation" mode="controls" />

      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Testing & Validation</h2>
          <p className="mt-1.5 text-sm text-slate-600">Maintain customizable validation tables, test checks, observed parameters and result status for this product.</p>
        </div>
        <button className="primary-button h-10" onClick={() => setShowAddModal(true)}><Plus size={18} />Add Table</button>
      </section>

      {tables.map((table, index) => (
        <BenchmarkingTable
          key={table._id}
          index={index}
          selectedCell={selectedCell}
          table={table}
          onChangeTable={updateTable}
          onDeleteTable={setDeleteTarget}
          onExportCsv={exportCsv}
          onImportCsv={importCsv}
          onSelectCell={setSelectedCell}
        />
      ))}

      <button className="w-full rounded-lg border border-dashed border-blue-200 bg-white p-8 text-center text-primary shadow-soft" onClick={() => setShowAddModal(true)}>
        <Plus className="mx-auto" size={38} />
        <span className="mt-2 block font-bold">Add Another Custom Table</span>
        <span className="mt-1 block text-sm text-slate-500">Create additional validation sheets with custom fields</span>
      </button>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>Last saved: {formatDateTime(lastSaved)}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            {saveState}
          </span>
        </div>
        <div className="text-right">
          {!canComplete ? <p className="mb-2 text-sm font-semibold text-amber-700">Add validation data, save changes and resolve failed results before completing this stage.</p> : null}
          <button className={`primary-button h-10 min-w-72 justify-center ${!canComplete ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`} aria-disabled={!canComplete} onClick={handleCompleteStage}>
            <Check size={18} />
            Mark Testing & Validation Complete
          </button>
        </div>
      </section>

      <AddTableModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreate={createTable} />
      <DeleteTableDialog table={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteTable} />
      <StageResponseBuilder projectCode={project.productCode} stageName="Testing & Validation" mode="blocks" />
    </div>
  );
}

function TopCrumbs({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link to="../overview" relative="path" className="icon-button h-10 w-10"><ChevronRight className="rotate-180" size={18} /></Link>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-primary">Projects</Link>
        <ChevronRight size={15} />
        <Link to="../overview" relative="path">{code}</Link>
        <ChevronRight size={15} />
        <span className="font-bold text-ink">Testing & Validation</span>
      </div>
    </div>
  );
}

function readStored(key: string, projectCode: string): StoredValidation {
  const fallback = { tables: makeDefaultTables(projectCode), lastSaved: new Date().toISOString() };
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved) as Partial<StoredValidation>;
    return {
      tables: Array.isArray(parsed.tables) && parsed.tables.length ? parsed.tables : fallback.tables,
      lastSaved: typeof parsed.lastSaved === 'string' ? parsed.lastSaved : fallback.lastSaved
    };
  } catch {
    return fallback;
  }
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

function hasFailResult(table: BenchmarkingTableData) {
  const resultColumnIds = table.columns
    .filter((column) => (table.rows[0]?.cells[column.id] || '').trim().toLowerCase() === 'results')
    .map((column) => column.id);
  return table.rows.slice(1).some((row) => resultColumnIds.some((columnId) => row.cells[columnId]?.trim().toLowerCase() === 'fail'));
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

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
