import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AddTableModal } from '../../../components/benchmarking/AddTableModal';
import { BenchmarkingTable } from '../../../components/benchmarking/BenchmarkingTable';
import { DeleteTableDialog } from '../../../components/benchmarking/DeleteTableDialog';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import type { BenchmarkingTableData, BenchmarkingWorkbook, SelectedCell } from '../../../components/benchmarking/types';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import {
  completeBenchmarking,
  createBenchmarkingTable,
  deleteBenchmarkingTable,
  fetchBenchmarking,
  importBenchmarkingCsv,
  updateBenchmarkingTable
} from '../../../services/benchmarkingService';
import { useProjectWorkspace } from './context';

const emptyWorkbook: BenchmarkingWorkbook = {
  tables: [],
  reviewStatus: 'draft'
};

export function Benchmarking() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const [workbook, setWorkbook] = useState<BenchmarkingWorkbook>(emptyWorkbook);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BenchmarkingTableData | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [message, setMessage] = useState('');
  const [lastSaved, setLastSaved] = useState<string | null>(null);
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

  async function importCsv(table: BenchmarkingTableData, file: File) {
    try {
      const text = await file.text();
      setWorkbook(normalizeWorkbook(await importBenchmarkingCsv(project.productCode, table._id, text)));
      setSaveStatus('saved');
      setLastSaved(new Date().toISOString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import failed');
      setSaveStatus('failed');
    }
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

  async function completeStageClick() {
    try {
      await completeBenchmarking(project.productCode);
      completeStage('Benchmarking');
      setSaveStatus('saved');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete benchmarking');
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-full space-y-4 overflow-hidden 2xl:max-w-[1500px]">
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500">
        <Link to="/projects" className="hover:text-primary">Projects</Link>
        <ChevronRight size={15} />
        <Link to="../overview" relative="path" className="hover:text-primary">{project.productCode}</Link>
        <ChevronRight size={15} />
        <span className="font-bold text-ink">Benchmarking</span>
      </div>

      <ProjectStageHeader project={project} currentStage="Benchmarking" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Benchmarking</h1>
          <p className="mt-1 text-sm text-slate-600">Create comparison sheets with competitor/reference products to define target requirements for R&D.</p>
          {message ? <p className="mt-2 text-sm font-semibold text-amber-700">{message}</p> : null}
        </div>
        <div className="flex gap-2">
          <button className="primary-button" onClick={() => setShowAddModal(true)}><Plus size={18} />Add Table</button>
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
        <button className="w-full rounded-lg border border-dashed border-blue-200 bg-white p-8 text-center text-primary shadow-soft" onClick={() => setShowAddModal(true)}>
          <Plus className="mx-auto" size={38} />
          <span className="mt-2 block font-bold">Add Another Table</span>
          <span className="mt-1 block text-sm text-slate-500">Create multiple comparison tables</span>
        </button>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>Last saved: {lastSaved ? formatDateTime(lastSaved) : 'Not saved yet'}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${saveStatus === 'saved' ? 'bg-emerald-100 text-emerald-700' : saveStatus === 'saving' ? 'bg-blue-100 text-primary' : saveStatus === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'failed' ? 'Save failed' : saveStatus === 'saved' ? 'Saved' : 'Draft'}
            </span>
          </div>
          <button className="primary-button min-w-72 justify-center disabled:cursor-not-allowed disabled:bg-slate-300" disabled={!canComplete} onClick={completeStageClick}>
            <Check size={18} />
            Mark Benchmarking Complete
          </button>
        </div>
        {!canComplete ? <p className="mt-2 text-right text-sm text-slate-500">Create at least one table, enter data, and save changes before completing.</p> : null}
      </section>

      <AddTableModal open={showAddModal} onClose={() => setShowAddModal(false)} onCreate={createTable} />
      <DeleteTableDialog table={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteTable} />
    </div>
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
      <path d="M49 76h22" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" />
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
