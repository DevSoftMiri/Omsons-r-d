import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AddTableModal } from '../../../components/benchmarking/AddTableModal';
import { BenchmarkingTable } from '../../../components/benchmarking/BenchmarkingTable';
import { DeleteTableDialog } from '../../../components/benchmarking/DeleteTableDialog';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useToast } from '../../../components/ToastProvider';
import type { BenchmarkingTableData, BenchmarkingWorkbook, SelectedCell } from '../../../components/benchmarking/types';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import {
  completeBenchmarking,
  createBenchmarkingTable,
  deleteBenchmarkingTable,
  fetchBenchmarking,
  updateBenchmarkingTable
} from '../../../services/benchmarkingService';
import type { WorkBook } from 'xlsx';
import { readSpreadsheet, importWorksheet } from '../../../components/benchmarking/spreadsheetImport';
import { updateProjectStage } from '../../../services/projectService';
import { showMissingFieldsToast } from '../../../utils/requiredFields';
import { useProjectWorkspace } from './context';

const emptyWorkbook: BenchmarkingWorkbook = {
  tables: [],
  reviewStatus: 'draft'
};

export function Benchmarking() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const [workbook, setWorkbook] = useState<BenchmarkingWorkbook>(emptyWorkbook);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BenchmarkingTableData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [sheetPicker, setSheetPicker] = useState<{ source: WorkBook; table: BenchmarkingTableData } | null>(null);
  const [sheetName, setSheetName] = useState('');
  const saveInFlight = useRef<Promise<void>>(Promise.resolve());
  const saveTimer = useRef<number | null>(null);
  const dirtyTables = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    fetchBenchmarking(project.productCode)
      .then((data) => {
        if (!active) return;
        setWorkbook(normalizeWorkbook(data));
        setSaveStatus('saved');
        setLastSaved(data.updatedAt || new Date().toISOString());
      })
      .catch((error) => {
        if (!active) return;
        setWorkbook(emptyWorkbook);
        setMessage(error instanceof Error ? error.message : 'Unable to load benchmarking data');
        setSaveStatus('failed');
      });

    return () => {
      active = false;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [project.productCode]);

  const hasMeaningfulData = useMemo(() => workbook.tables.some((table) => table.rows.some((row) => Object.values(row.cells).some((value) => value.trim()))), [workbook.tables]);
  const canComplete = workbook.tables.length > 0 && hasMeaningfulData && saveStatus === 'saved';

  function scheduleSave(table: BenchmarkingTableData, tablesSnapshot: BenchmarkingTableData[]) {
    dirtyTables.current.add(table._id);
    setSaveStatus('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const tablesToSave = tablesSnapshot.filter((candidate) => dirtyTables.current.has(candidate._id));
      const operation = (async () => {
      try {
        let updated = workbook;
        for (const tableToSave of tablesToSave) {
          updated = normalizeWorkbook(await updateBenchmarkingTable(project.productCode, tableToSave));
        }
        dirtyTables.current.clear();
        setWorkbook(updated);
        setSaveStatus('saved');
        setLastSaved(new Date().toISOString());
        setMessage('');
      } catch (error) {
        setSaveStatus('failed');
        setMessage(error instanceof Error ? error.message : 'Save failed');
      }
      })();
      saveInFlight.current = operation;
      await operation;
    }, 700);
  }

  function updateTable(table: BenchmarkingTableData) {
    setWorkbook((current) => {
      const tables = current.tables.map((candidate) => candidate._id === table._id ? table : candidate);
      scheduleSave(table, tables);
      return { ...current, reviewStatus: 'draft', tables };
    });
  }

  async function createTable(values: { name: string; initialColumns: number; initialRows: number }) {
    try {
      setWorkbook(normalizeWorkbook(await createBenchmarkingTable(project.productCode, values)));
      setShowAddModal(false);
      setSaveStatus('saved');
      setLastSaved(new Date().toISOString());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create table');
      setSaveStatus('failed');
    }
  }

  async function confirmDeleteTable() {
    if (!deleteTarget) return;
    try {
      await deleteBenchmarkingTable(project.productCode, deleteTarget._id);
      setWorkbook((current) => ({ ...current, tables: current.tables.filter((table) => table._id !== deleteTarget._id) }));
      setDeleteTarget(null);
      setLastSaved(new Date().toISOString());
      setSaveStatus('saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed');
      setSaveStatus('failed');
    }
  }

  async function saveImportedSheet(source: WorkBook, name: string, table: BenchmarkingTableData) {
    try {
      const imported = importWorksheet(source, name, table);
      const result = await updateBenchmarkingTable(project.productCode, imported);
      setWorkbook(normalizeWorkbook(result));
      setSelectedCell(null);
      setSaveStatus('saved');
      setLastSaved(new Date().toISOString());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed');
    } finally {
      setSheetPicker(null);
      setImporting(false);
    }
  }

  async function importCsv(table: BenchmarkingTableData, file: File) {
    if (importing) return;
    setImporting(true);
    setMessage('');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const pendingIds = new Set(dirtyTables.current);
    try {
      await saveInFlight.current;
      // Flush unsaved edits before replacing a table, including edits in other tables.
      for (const candidate of workbook.tables) {
        if (pendingIds.has(candidate._id)) {
          await updateBenchmarkingTable(project.productCode, candidate);
        }
      }
      dirtyTables.current.clear();
      setLastSaved(new Date().toISOString());
      setSaveStatus('saved');
      const source = await readSpreadsheet(file);
      if (!source.SheetNames.length) throw new Error('This workbook contains no worksheets.');
      if (source.SheetNames.length > 1) {
        setSheetName(source.SheetNames[0]);
        setSheetPicker({ source, table });
      } else {
        await saveImportedSheet(source, source.SheetNames[0], table);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed');
      if (dirtyTables.current.size) setSaveStatus('failed');
      setImporting(false);
    }
  }

  function exportCsv(table: BenchmarkingTableData) {
    const data = table.rows.map(row => table.columns.map(column => row.cells[column.id] || ''));
    if (table.columns.some(column => column.label !== undefined)) data.unshift(table.columns.map(column => column.label || ''));
    const csv = data
      .map(row => row.map(value => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${project.productCode}-${table.name.replace(/\s+/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function completeStageClick() {
    const missing = [
      !workbook.tables.length ? 'At least one benchmarking table' : '',
      !hasMeaningfulData ? 'Benchmarking data' : '',
      saveStatus !== 'saved' ? 'Saved changes' : ''
    ].filter(Boolean);
    if (showMissingFieldsToast(showToast, missing)) return;
    try {
      await syncCompletedPreviousStages();
      await completeBenchmarking(project.productCode);
      await completeStage('Benchmarking');
      setSaveStatus('saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete benchmarking');
    }
  }

  async function syncCompletedPreviousStages() {
    const benchmarkingIndex = project.stages.findIndex((stage) => stage.name === 'Benchmarking');
    if (benchmarkingIndex <= 0) return;
    const completedPreviousStages = project.stages.slice(0, benchmarkingIndex).filter((stage) => stage.status === 'Completed');
    for (const stage of completedPreviousStages) {
      await updateProjectStage(project.id, stage.name, 'Completed');
    }
  }

  return (
    <>
    <fieldset disabled={importing} className="mx-auto min-w-0 max-w-full space-y-4 overflow-hidden 2xl:max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-primary">Projects</Link>
        <ChevronRight size={15} />
        <Link to="../overview" relative="path" className="hover:text-primary">{project.productCode}</Link>
        <ChevronRight size={15} />
        <span className="font-bold text-ink">Benchmarking</span>
      </div>

      <ProjectStageHeader project={project} currentStage="Benchmarking" />
      <StageResponseBuilder projectCode={project.productCode} stageName="Benchmarking" mode="controls" />

      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Product research workspace</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Benchmarking</h1>
          <p className="mt-1 text-sm text-slate-600">Create comparison sheets with competitor/reference products to define target requirements for R&D.</p>
          {message ? <p className="mt-2 text-sm font-semibold text-amber-700">{message}</p> : null}
        </div>
        <div className="flex gap-2">
          <button className="primary-button" onClick={() => setShowAddModal(true)}><Plus size={18} />Add Table</button>
        </div>
        </div>
      </div>

      {workbook.tables.length ? (
        workbook.tables.map((table, index) => (
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
            editableColumnLabels
          />
        ))
      ) : (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center shadow-soft">
          <h2 className="text-xl font-bold">No benchmarking tables yet.</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">Create comparison tables for materials, dimensions, competitors, performance or any other R&D criteria.</p>
          <button className="primary-button mx-auto mt-5" onClick={() => setShowAddModal(true)}><Plus size={18} />Create First Table</button>
        </section>
      )}

      {workbook.tables.length ? (
        <button className="w-full rounded-xl border border-dashed border-blue-200 bg-sky-50/40 p-8 text-center text-primary transition hover:border-primary hover:bg-sky-50" onClick={() => setShowAddModal(true)}>
          <Plus className="mx-auto" size={38} />
          <span className="mt-2 block font-bold">Add Another Table</span>
          <span className="mt-1 block text-sm text-slate-500">Create multiple comparison tables</span>
        </button>
      ) : null}

      <AddTableModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreate={createTable} />
      <DeleteTableDialog table={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteTable} />
      <StageResponseBuilder projectCode={project.productCode} stageName="Benchmarking" mode="blocks" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>Last saved: {lastSaved ? formatDateTime(lastSaved) : 'Not saved yet'}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${saveStatus === 'saved' ? 'bg-emerald-100 text-emerald-700' : saveStatus === 'saving' ? 'bg-blue-100 text-primary' : saveStatus === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'failed' ? 'Save failed' : saveStatus === 'saved' ? 'Saved' : 'Draft'}
            </span>
          </div>
          <button
            className={`primary-button h-9 px-3 text-xs ${!canComplete ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`}
            aria-disabled={!canComplete}
            onClick={completeStageClick}
          >
            Mark Benchmarking Complete
          </button>
        </div>
        {!canComplete ? <p className="mt-2 text-right text-sm text-slate-500">Create at least one table, enter data, and save changes before completing.</p> : null}
      </section>
    </fieldset>
    {importing ? <p className="mt-3 text-sm text-slate-600" role="status">{sheetPicker ? 'Choose a worksheet to continue.' : 'Importing spreadsheet?'}</p> : null}
    {sheetPicker ? (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="worksheet-title" className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <h2 id="worksheet-title" className="text-xl font-bold">Choose worksheet</h2>
          <p className="mt-2 text-sm text-slate-600">The selected worksheet will replace the contents of {sheetPicker.table.name}.</p>
          <label className="mt-4 block text-sm font-semibold">Worksheet
            <select className="field mt-2" value={sheetName} onChange={event => setSheetName(event.target.value)}>
              {sheetPicker.source.SheetNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <button className="secondary-button" onClick={() => { setSheetPicker(null); setImporting(false); }}>Cancel</button>
            <button className="primary-button" onClick={() => {
              const selection = sheetPicker;
              setSheetPicker(null);
              void saveImportedSheet(selection.source, sheetName, selection.table);
            }}>Import worksheet</button>
          </div>
        </section>
      </div>
    ) : null}
    </>
  );
}

function normalizeWorkbook(workbook: BenchmarkingWorkbook): BenchmarkingWorkbook {
  return {
    ...workbook,
    tables: (workbook.tables || []).map((table) => ({
      ...table,
      rows: table.rows.map((row) => ({
        ...row,
        cells: Object.fromEntries(Object.entries(row.cells || {}))
      }))
    }))
  };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-slate-200 lg:border-l lg:pl-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function BeakerVisual() {
  return (
    <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none">
      <path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" />
      <path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M45 82c8 5 22 5 30 0" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <path d="M49 76h22" stroke="#00494B" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 64h21M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      <rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" />
    </svg>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
