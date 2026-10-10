import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import {
  readProductSpecifications,
  saveProductSpecifications,
  type ProductSpecificationRow
} from '../../../services/productSpecificationsService';
import { showMissingFieldsToast } from '../../../utils/requiredFields';
import { useProjectWorkspace } from './context';

export function ProductSpecifications() {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const initial = readProductSpecifications(project.productCode);
  const [summary, setSummary] = useState(initial.summary);
  const [rows, setRows] = useState(initial.rows);
  const [lastSaved, setLastSaved] = useState(initial.lastSaved);
  const [saveState, setSaveState] = useState<'Saving...' | 'Saved'>('Saved');
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }

    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      const saved = saveProductSpecifications(project.productCode, { summary, rows });
      setLastSaved(saved.lastSaved);
      setSaveState('Saved');
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [project.productCode, rows, summary]);

  const hasSpecifications = useMemo(
    () => rows.some((row) => row.parameter.trim() && row.specification.trim()),
    [rows]
  );
  const canComplete = hasSpecifications && saveState === 'Saved';

  function updateRow(id: string, key: 'parameter' | 'specification', value: string) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
  }

  function addRow() {
    setRows((current) => [...current, { id: `spec-${crypto.randomUUID()}`, parameter: '', specification: '' }]);
  }

  function deleteRow(id: string) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : current);
  }

  function handleCompleteStage() {
    const missing = [
      !hasSpecifications ? 'Technical specifications' : '',
      saveState !== 'Saved' ? 'Saved changes' : ''
    ].filter(Boolean);
    if (showMissingFieldsToast(showToast, missing)) return;
    completeStage('Product Specifications');
  }

  return (
    <div className="mx-auto min-w-0 max-w-full space-y-4 overflow-hidden text-sm 2xl:max-w-[1500px]">
      <TopCrumbs title={project.name} code={project.productCode} />
      <ProjectStageHeader project={project} currentStage="Product Specifications" />
      <StageResponseBuilder projectCode={project.productCode} stageName="Product Specifications" mode="controls" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Product Specifications</h1>
            <p className="mt-1.5 text-sm text-slate-600">Enter product-level requirements before validation.</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">{saveState}</span>
        </div>
        <textarea
          className="field mt-4 min-h-24 resize-y"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Add a short product summary or notes..."
        />
      </section>
      <StageResponseBuilder projectCode={project.productCode} stageName="Product Specifications" mode="blocks" />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Technical Specifications</h2>
            <p className="mt-1 text-sm text-slate-500">Manual entries here feed the Testing & Validation required parameters.</p>
          </div>
          <button className="secondary-button h-10" onClick={addRow}><Plus size={16} />Add Row</button>
        </div>

        <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[760px] w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs font-bold uppercase text-slate-500">
                <th className="w-[38%] border border-slate-200 px-3 py-2">Parameter</th>
                <th className="border border-slate-200 px-3 py-2">Specification</th>
                <th className="w-14 border border-slate-200 px-2 py-2 text-center"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <SpecificationRow
                  key={row.id}
                  row={row}
                  canDelete={rows.length > 1}
                  onDelete={() => deleteRow(row.id)}
                  onUpdate={(key, value) => updateRow(row.id, key, value)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>Last saved: {formatDateTime(lastSaved)}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            {saveState}
          </span>
        </div>
        <div className="text-right">
          {!canComplete ? <p className="mb-2 text-sm font-semibold text-amber-700">Add technical specifications and save changes before completing this stage.</p> : null}
          <button className={`primary-button h-10 min-w-72 justify-center ${!canComplete ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`} aria-disabled={!canComplete} onClick={handleCompleteStage}>
            <Check size={18} />
            Mark Product Specifications Complete
          </button>
        </div>
      </section>
    </div>
  );
}

function SpecificationRow({
  row,
  canDelete,
  onDelete,
  onUpdate
}: {
  row: ProductSpecificationRow;
  canDelete: boolean;
  onDelete: () => void;
  onUpdate: (key: 'parameter' | 'specification', value: string) => void;
}) {
  return (
    <tr>
      <td className="border border-slate-200 p-0">
        <textarea
          className="block min-h-10 w-full resize-none bg-transparent px-3 py-2 font-semibold outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
          rows={1}
          value={row.parameter}
          onChange={(event) => onUpdate('parameter', event.target.value)}
        />
      </td>
      <td className="border border-slate-200 p-0">
        <textarea
          className="block min-h-10 w-full resize-none bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
          rows={1}
          value={row.specification}
          onChange={(event) => onUpdate('specification', event.target.value)}
        />
      </td>
      <td className="border border-slate-200 p-0 text-center">
        <button
          className="grid h-10 w-full place-items-center text-slate-400 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30"
          disabled={!canDelete}
          onClick={onDelete}
          title="Delete row"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
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
        <span className="font-bold text-ink">Product Specifications</span>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
