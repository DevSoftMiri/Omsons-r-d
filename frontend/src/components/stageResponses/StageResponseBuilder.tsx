import { AddTableModal } from '../benchmarking/AddTableModal';
import type { WorkBook } from 'xlsx';
import { readSpreadsheet, importWorksheet } from '../benchmarking/spreadsheetImport';
import type { ChangeEvent, DragEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, FileUp, GripVertical, Plus, Table2, Trash2, Type } from 'lucide-react';
import { BenchmarkingTable } from '../benchmarking/BenchmarkingTable';
import type { BenchmarkingTableData, SelectedCell } from '../benchmarking/types';
import { deleteProjectAttachment, fetchProjectAttachments, uploadProjectAttachment, type ProjectAttachment } from '../../services/attachmentService';
import {
  makeStageResponseId,
  makeStageResponseTable,
  readStageResponses,
  saveStageResponses,
  type StageChecklistBlock,
  type StageResponseBlock,
  type StageTableBlock
} from '../../services/stageResponseService';
import { resolveFileUrl } from '../../utils/fileActions';
import { useToast } from '../ToastProvider';

const acceptedFileTypes = 'application/pdf,image/jpeg,image/png,image/webp,.csv,.xlsx,.xls,.doc,.docx';

export function StageResponseBuilder({
  projectCode,
  stageName,
  mode = 'all'
}: {
  projectCode: string;
  stageName: string;
  mode?: 'all' | 'controls' | 'blocks';
}) {
  const [showAddTable, setShowAddTable] = useState(false);
  const uploadBusy = useRef(false);
  const { showToast } = useToast();
  const [blocks, setBlocks] = useState<StageResponseBlock[]>(() => readStageResponses(projectCode, stageName));
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [sheetPicker, setSheetPicker] = useState<{ source: WorkBook; block: StageTableBlock; table: BenchmarkingTableData } | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [newBlockId, setNewBlockId] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);

  useEffect(() => {
    setBlocks(readStageResponses(projectCode, stageName));
    let active = true;
    fetchProjectAttachments(projectCode, stageName)
      .then((items) => {
        if (active) setAttachments(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [projectCode, stageName]);

  useEffect(() => {
    function handleResponseUpdate(event: Event) {
      const detail = (event as CustomEvent<{ projectCode: string; stageName: string; newBlockId?: string }>).detail;
      if (detail?.projectCode !== projectCode || detail.stageName !== stageName) return;
      setBlocks(readStageResponses(projectCode, stageName));
      if (detail.newBlockId) setNewBlockId(detail.newBlockId);
    }
    window.addEventListener('stage-response-updated', handleResponseUpdate);
    return () => window.removeEventListener('stage-response-updated', handleResponseUpdate);
  }, [projectCode, stageName]);

  function persist(nextBlocks: StageResponseBlock[], newBlockId?: string) {
    const saved = saveStageResponses(projectCode, stageName, nextBlocks);
    setBlocks(saved);
    window.dispatchEvent(new CustomEvent('stage-response-updated', {
      detail: { projectCode, stageName, newBlockId }
    }));
  }

  function addBlock(type: StageResponseBlock['type']) {
    const now = new Date().toISOString();
    const base = { id: makeStageResponseId(type), createdAt: now, updatedAt: now };
    if (type === 'table') persist([...blocks, { ...base, type, title: 'Table', table: makeStageResponseTable('Table') }], base.id);
    if (type === 'text') persist([...blocks, { ...base, type, title: 'Text Area', value: '' }], base.id);
    if (type === 'checklist') persist([...blocks, { ...base, type, title: 'Checklist', items: [] }], base.id);
    if (type === 'file') persist([...blocks, { ...base, type, title: 'Files' }], base.id);
    showToast({ tone: 'success', title: `${type[0].toUpperCase()}${type.slice(1)} added`, message: 'You can edit it below.' });
  }

  useEffect(() => {
    if (!newBlockId) return;
    document.getElementById(`stage-response-${newBlockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setNewBlockId(null);
  }, [blocks, newBlockId]);

  function updateBlock(updated: StageResponseBlock) {
    persist(blocks.map((block) => block.id === updated.id ? { ...updated, updatedAt: new Date().toISOString() } : block));
  }

  function deleteBlock(blockId: string) {
    const block = blocks.find((candidate) => candidate.id === blockId);
    if (!window.confirm(`Are you sure you want to delete ${block?.title || 'this section'}?`)) return;
    persist(blocks.filter((block) => block.id !== blockId));
    showToast({ tone: 'success', title: 'Section deleted', message: 'The section was removed from this stage.' });
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetBlockId: string) {
    event.preventDefault();
    if (!draggedBlockId || draggedBlockId === targetBlockId) {
      setDraggedBlockId(null);
      return;
    }
    const sourceIndex = blocks.findIndex((block) => block.id === draggedBlockId);
    const targetIndex = blocks.findIndex((block) => block.id === targetBlockId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedBlockId(null);
      return;
    }
    const reordered = [...blocks];
    const [movedBlock] = reordered.splice(sourceIndex, 1);
    const insertionIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
    reordered.splice(insertionIndex, 0, movedBlock);
    persist(reordered);
    setDraggedBlockId(null);
  }

  function updateTable(block: StageTableBlock, table: BenchmarkingTableData) {
    updateBlock({ ...block, title: table.name, table });
  }

  function exportCsv(table: BenchmarkingTableData) {
    const csv = table.rows
      .map((row) => table.columns.map((column) => `"${(row.cells[column.id] || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${stageName}-${table.name.replace(/\s+/g, '-')}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(block: StageTableBlock, table: BenchmarkingTableData, file: File) {
    try {
      const source = await readSpreadsheet(file);
      if (!source.SheetNames.length) throw new Error('This workbook contains no worksheets.');
      if (source.SheetNames.length > 1) {
        setSheetName(source.SheetNames[0]);
        setSheetPicker({ source, block, table });
      } else {
        updateTable(block, importWorksheet(source, source.SheetNames[0], table));
        setSelectedCell(null);
      }
    } catch (error) {
      showToast({ tone: 'error', title: 'Import failed', message: error instanceof Error ? error.message : 'Unable to import spreadsheet.' });
    }
  }

  async function uploadFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || uploadBusy.current) return;
    if (files.some(file => file.size > 10 * 1024 * 1024)) {
      showToast({ tone: 'error', title: 'Upload failed', message: 'Each attachment must be smaller than 10 MB.' });
      return;
    }
    uploadBusy.current = true;
    let count = 0;
    try {
      for (const file of files) {
        const uploaded = await uploadProjectAttachment(projectCode, stageName, file);
        setAttachments(current => [uploaded, ...current]);
        count++;
      }
      showToast({ tone: 'success', title: 'Files uploaded', message: `${count} file(s) added.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Upload failed', message: `${count} file(s) uploaded. ${error instanceof Error ? error.message : 'Could not upload file.'}` });
    } finally { uploadBusy.current = false; }
  }

  async function removeAttachment(id: string) {
    try {
      await deleteProjectAttachment(projectCode, stageName, id);
      setAttachments((current) => current.filter((item) => item._id !== id));
    } catch (error) {
      showToast({ tone: 'error', title: 'Delete failed', message: error instanceof Error ? error.message : 'Could not delete file.' });
    }
  }

  const hasFileBlock = useMemo(() => blocks.some((block) => block.type === 'file'), [blocks]);

  const addTableView = <AddTableModal open={showAddTable} onClose={() => setShowAddTable(false)} title="Add Table" examples="Create a blank table or fill it from an Excel file." onCreate={values => {
    const now = new Date().toISOString();
    const id = makeStageResponseId('table');
    const table = values.importedTable || makeStageResponseTable(values.name, values.initialColumns, values.initialRows);
    persist([...blocks, { id, type: 'table', title: values.name, createdAt: now, updatedAt: now, table: { ...table, _id: makeStageResponseId('table'), name: values.name } }], id);
    setShowAddTable(false);
  }} />;

  const sheetPickerView = sheetPicker && (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="stage-sheet-picker" className="w-full max-w-md space-y-4 rounded-xl bg-white p-5">
        <h2 id="stage-sheet-picker" className="text-lg font-bold">Choose worksheet</h2>
        <select autoFocus aria-label="Worksheet" className="field" value={sheetName} onChange={event => setSheetName(event.target.value)}>
          {sheetPicker.source.SheetNames.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" className="secondary-button" onClick={() => setSheetPicker(null)}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => {
            try {
              updateTable(sheetPicker.block, importWorksheet(sheetPicker.source, sheetName, sheetPicker.table));
              setSelectedCell(null);
              setSheetPicker(null);
            } catch (error) {
              showToast({ tone: 'error', title: 'Import failed', message: error instanceof Error ? error.message : 'Unable to import worksheet.' });
            }
          }}>Import</button>
        </div>
      </div>
    </div>
  );

  if (mode === 'blocks') {
    return (
      <>
        {sheetPickerView}
      {addTableView}
        {blocks.length ? blocks.map((block, index) => (
              <section
                data-stage-section={`response-${block.id}`}
                id={`stage-response-${block.id}`}
                key={block.id}
                className={`mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-soft transition-opacity ${draggedBlockId === block.id ? 'opacity-50' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, block.id)}
              >
                <BlockHeader block={block} index={index} onChange={updateBlock} onDelete={() => deleteBlock(block.id)} onDragStart={() => setDraggedBlockId(block.id)} onDragEnd={() => setDraggedBlockId(null)} />
                {block.type === 'text' ? <textarea className="field mt-3 min-h-32 resize-y bg-white" value={block.value} onChange={(event) => updateBlock({ ...block, value: event.target.value })} /> : null}
                {block.type === 'checklist' ? <ChecklistBlock block={block} onChange={updateBlock} /> : null}
                {block.type === 'table' ? <div className="mt-3"><BenchmarkingTable index={index} table={block.table} selectedCell={selectedCell} onSelectCell={setSelectedCell} onChangeTable={(table) => updateTable(block, table)} onImportCsv={(table, file) => importCsv(block, table, file)} onExportCsv={exportCsv} onDeleteTable={() => deleteBlock(block.id)} editableColumnLabels /></div> : null}
                {block.type === 'file' ? <FileBlock attachments={attachments} onDelete={removeAttachment} onUpload={uploadFiles} /> : null}
              </section>
            )) : null}
        {!hasFileBlock ? <input data-stage-section-ignore="true" className="sr-only" type="file" accept={acceptedFileTypes} multiple onChange={uploadFiles} /> : null}
      </>
    );
  }

  return (
    <div data-stage-section-ignore={mode === 'controls' ? 'true' : undefined}>
      {sheetPickerView}
      {addTableView}
        {
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="secondary-button h-10 text-primary" onClick={() => setShowAddTable(true)}><Table2 size={16} />Add Table</button>
          <button type="button" className="secondary-button h-10 text-primary" onClick={() => addBlock('text')}><Type size={16} />Add Text Area</button>
          <button type="button" className="secondary-button h-10 text-primary" onClick={() => addBlock('checklist')}><CheckSquare size={16} />Add Checklist</button>
          <button type="button" className="secondary-button h-10 text-primary" onClick={() => addBlock('file')}><FileUp size={16} />Upload File</button>
        </div>
        }

          {mode !== 'controls' && blocks.length ? (
          <div className="mt-4 space-y-4">
            {blocks.map((block, index) => (
              <section
                id={`stage-response-${block.id}`}
                key={block.id}
                className={`rounded-lg border border-slate-200 bg-white p-4 shadow-soft transition-opacity ${draggedBlockId === block.id ? 'opacity-50' : ''}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, block.id)}
              >
                <BlockHeader
                  block={block}
                  index={index}
                  onChange={updateBlock}
                  onDelete={() => deleteBlock(block.id)}
                  onDragStart={() => setDraggedBlockId(block.id)}
                  onDragEnd={() => setDraggedBlockId(null)}
                />
                {block.type === 'text' ? (
                  <textarea className="field mt-3 min-h-32 resize-y bg-white" value={block.value} onChange={(event) => updateBlock({ ...block, value: event.target.value })} />
              ) : null}
              {block.type === 'checklist' ? <ChecklistBlock block={block} onChange={updateBlock} /> : null}
              {block.type === 'table' ? (
                <div className="mt-3">
                  <BenchmarkingTable
                    index={index}
                    table={block.table}
                    selectedCell={selectedCell}
                    onSelectCell={setSelectedCell}
                    onChangeTable={(table) => updateTable(block, table)}
                    onImportCsv={(table, file) => importCsv(block, table, file)}
                    onExportCsv={exportCsv}
                    onDeleteTable={() => deleteBlock(block.id)}
                    editableColumnLabels
                  />
                </div>
              ) : null}
              {block.type === 'file' ? (
                <FileBlock attachments={attachments} onDelete={removeAttachment} onUpload={uploadFiles} />
              ) : null}
            </section>
          ))}
        </div>
      ) : null}

      {!hasFileBlock ? (
        <input className="sr-only" type="file" accept={acceptedFileTypes} multiple onChange={uploadFiles} />
      ) : null}
    </div>
  );
}

function BlockHeader({
  block,
  index,
  onChange,
  onDelete,
  onDragStart,
  onDragEnd
}: {
  block: StageResponseBlock;
  index: number;
  onChange: (block: StageResponseBlock) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        draggable
        className="grid h-9 w-7 cursor-grab place-items-center rounded text-slate-400 hover:bg-slate-100 hover:text-primary active:cursor-grabbing"
        title="Drag to reorder"
        aria-label={`Drag ${block.title} to reorder`}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <GripVertical size={18} />
      </button>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-bold text-slate-500">{index + 1}</span>
      <input className="field h-9 max-w-sm bg-white font-bold" value={block.title} onChange={(event) => onChange({ ...block, title: event.target.value })} />
      <button type="button" className="ml-auto grid h-9 w-9 place-items-center rounded-md text-rose-600 hover:bg-rose-50" onClick={onDelete} title="Delete block">
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function ChecklistBlock({ block, onChange }: { block: StageChecklistBlock; onChange: (block: StageChecklistBlock) => void }) {
  const [draft, setDraft] = useState('');
  function addItem() {
    const label = draft.trim();
    if (!label) return;
    onChange({ ...block, items: [...block.items, { id: makeStageResponseId('item'), label, completed: false }] });
    setDraft('');
  }
  return (
    <div className="mt-3 space-y-2">
      {block.items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <input type="checkbox" checked={item.completed} onChange={() => onChange({ ...block, items: block.items.map((candidate) => candidate.id === item.id ? { ...candidate, completed: !candidate.completed } : candidate) })} />
          <input className="min-w-0 flex-1 bg-transparent font-semibold outline-none" value={item.label} onChange={(event) => onChange({ ...block, items: block.items.map((candidate) => candidate.id === item.id ? { ...candidate, label: event.target.value } : candidate) })} />
          <button type="button" className="text-rose-600" title="Remove checklist item" onClick={() => onChange({ ...block, items: block.items.filter((candidate) => candidate.id !== item.id) })}><Trash2 size={15} /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <input className="field bg-white" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            addItem();
          }
        }} />
        <button type="button" className="secondary-button h-11 shrink-0" onClick={addItem}><Plus size={16} />Add</button>
      </div>
    </div>
  );
}

function FileBlock({ attachments, onUpload, onDelete }: { attachments: ProjectAttachment[]; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onDelete: (id: string) => void }) {
  return (
    <div className="mt-3">
      <label className="secondary-button h-10 cursor-pointer text-primary">
        <FileUp size={16} />
        Upload File
        <input className="hidden" type="file" accept={acceptedFileTypes} multiple onChange={onUpload} />
      </label>
      <div className="mt-3 grid gap-2">
        {attachments.map((attachment) => (
          <div key={attachment._id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <a className="min-w-0 flex-1 truncate font-semibold text-primary" href={resolveFileUrl(attachment) || undefined} target="_blank" rel="noreferrer">
              {attachment.name}
            </a>
            <button className="text-rose-600" onClick={() => onDelete(attachment._id)}><Trash2 size={15} /></button>
          </div>
        ))}
        {!attachments.length ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">No files uploaded for this stage.</p> : null}
      </div>
    </div>
  );
}
