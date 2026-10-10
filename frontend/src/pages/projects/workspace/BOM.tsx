import type { ChangeEvent, FormEvent, KeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Box, CalendarDays, Check, ChevronRight, CircuitBoard, Coins, Columns3, Download, Edit2, FileText, Grid2X2, Maximize2, Minimize2, PackagePlus, Paperclip, PenLine, Plus, ReceiptText, RotateCcw, Search, ShoppingCart, Truck, Trash2, Upload, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AddTableModal } from '../../../components/benchmarking/AddTableModal';
import { BenchmarkingTable } from '../../../components/benchmarking/BenchmarkingTable';
import { DeleteTableDialog } from '../../../components/benchmarking/DeleteTableDialog';
import type { BenchmarkingTableData, SelectedCell } from '../../../components/benchmarking/types';
import { ProjectStageHeader } from '../../../components/ProjectStageHeader';
import { StageResponseBuilder } from '../../../components/stageResponses/StageResponseBuilder';
import { useToast } from '../../../components/ToastProvider';
import { useStageCompletion } from '../../../hooks/useStageCompletion';
import { deleteProjectAttachment, fetchProjectAttachments, uploadProjectAttachment, type ProjectAttachment } from '../../../services/attachmentService';
import { NO_FILE_AVAILABLE, openFile, resolveFileUrl } from '../../../utils/fileActions';
import { showMissingFieldsToast } from '../../../utils/requiredFields';
import { useProjectWorkspace } from './context';

type BomStatus = 'Pending' | 'Ordered' | 'Procured';

type BomRow = {
  id: string;
  itemName: string;
  category: string;
  specification: string;
  supplier: string;
  unit: string;
  quantityPerUnit: number;
  unitCost: number | null;
  referenceDocument: string;
  status: BomStatus;
};

type ElectricalBomRow = {
  id: string;
  item: string;
  specification: string;
  qty: string;
  unit: string;
  pricePerUnit: string;
  totalCost: string;
  referenceDesignator: string;
  supplierSource: string;
  pad: string;
  totalPad: string;
  solderingCost: string;
  totalSolderCost: string;
  finalCost: string;
  remarks: string;
  customCells?: Record<string, string>;
};

type MechanicalBomRow = {
  id: string;
  srNo: string;
  partNumber: string;
  item: string;
  specification: string;
  material: string;
  qty: string;
  unit: string;
  drawing: string;
  unitCost: string;
  totalCost: string;
  supplier: string;
  remarks: string;
  customCells?: Record<string, string>;
};

type BomCustomColumn = {
  id: string;
  label: string;
  formula?: string;
  width?: number;
};

type BomColumnSetting<Key extends string> = {
  key: Key;
  label: string;
  className?: string;
  formula?: string;
  width?: number;
};

type FormulaResult = {
  value: string;
  error: boolean;
};

type EditingBomCell = {
  stage: 'electrical' | 'mechanical';
  rowId: string;
  columnKey: string;
} | null;

type FormulaBuilderDraft = {
  target: string;
  formula: string;
};

type ElectricalBomColumnKey = Exclude<keyof ElectricalBomRow, 'customCells'>;
type MechanicalBomColumnKey = Exclude<keyof MechanicalBomRow, 'customCells'>;

const units = ['kg', 'g', 'mg', 'L', 'ml', 'pcs', 'm', 'cm', 'mm', 'roll', 'sheet', 'box'];
const defaultNotes = '';
const minColumnWidth = 40;
const maxColumnWidth = 520;
const defaultSpreadsheetColumnWidth = 176;
const defaultBaseBomColumnWidths = {
  select: 48,
  index: 48,
  itemName: 180,
  category: 150,
  specification: 220,
  supplier: 190,
  unit: 90,
  quantityPerUnit: 110,
  unitCost: 120,
  totalCost: 130,
  referenceDocument: 220,
  status: 130,
  actions: 100
};
type BaseBomColumnKey = keyof typeof defaultBaseBomColumnWidths;
const electricalBomStage = 'Electrical BOM';
const mechanicalBomStage = 'Mechanical BOM';
const defaultElectricalColumnSettings: Array<BomColumnSetting<ElectricalBomColumnKey>> = [
  { key: 'item', label: 'Item', className: 'min-w-44' },
  { key: 'specification', label: 'Specification', className: 'min-w-56' },
  { key: 'qty', label: 'Qty', className: 'min-w-16 text-center' },
  { key: 'unit', label: 'Unit', className: 'min-w-20 text-center' },
  { key: 'pricePerUnit', label: 'Price per Unit', className: 'min-w-28 text-center' },
  { key: 'totalCost', label: 'Total Cost', className: 'min-w-28 text-center', formula: '=Qty*Price per Unit' },
  { key: 'referenceDesignator', label: 'Reference Designator', className: 'min-w-56' },
  { key: 'supplierSource', label: 'Supplier / Source', className: 'min-w-44' },
  { key: 'pad', label: 'Pad', className: 'min-w-20 text-center' },
  { key: 'totalPad', label: 'Total Pad', className: 'min-w-24 text-center', formula: '=Pad*Qty' },
  { key: 'solderingCost', label: 'Soldering Cost', className: 'min-w-28 text-center' },
  { key: 'totalSolderCost', label: 'Total Solder Cost', className: 'min-w-32 text-center', formula: '=Total Pad*Soldering Cost' },
  { key: 'finalCost', label: 'Final Cost', className: 'min-w-28 text-center', formula: '=Total Cost+Total Solder Cost' },
  { key: 'remarks', label: 'Remarks', className: 'min-w-36' }
];

const defaultElectricalRows: ElectricalBomRow[] = [];
const defaultElectricalFormulaTarget = 'builtin:finalCost';

const defaultMechanicalColumnSettings: Array<BomColumnSetting<MechanicalBomColumnKey>> = [
  { key: 'srNo', label: 'Sr. No.', className: 'w-14 text-center' },
  { key: 'partNumber', label: 'Part number', className: 'w-28' },
  { key: 'item', label: 'Item', className: 'w-40' },
  { key: 'specification', label: 'Specification', className: 'w-44' },
  { key: 'material', label: 'Material', className: 'w-28' },
  { key: 'qty', label: 'Qty', className: 'w-16 text-center' },
  { key: 'unit', label: 'Unit', className: 'w-20 text-center' },
  { key: 'drawing', label: 'Drawing', className: 'w-28' },
  { key: 'unitCost', label: 'Unit Cost', className: 'w-20 text-center' },
  { key: 'totalCost', label: 'Total Cost', className: 'w-20 text-center', formula: '=Qty*Unit Cost' },
  { key: 'supplier', label: 'Supplier', className: 'w-24' },
  { key: 'remarks', label: 'Remarks', className: 'w-24' }
];
const defaultMechanicalFormulaTarget = 'builtin:totalCost';

const defaultMechanicalRows: MechanicalBomRow[] = [];

export function BOM({ currentStage = 'BOM' }: { currentStage?: 'BOM' | 'Electrical BOM' | 'Mechanical BOM' }) {
  const { project } = useProjectWorkspace();
  const { completeStage } = useStageCompletion(project);
  const { showToast } = useToast();
  const isBaseBomStage = currentStage === 'BOM';
  const isElectricalStage = currentStage === 'Electrical BOM';
  const isMechanicalStage = currentStage === 'Mechanical BOM';
  const storageKey = `bom:${project.productCode}`;
  const storedBom = useMemo(() => readStoredBom(storageKey, project.bom), [storageKey, project.bom]);
  const [rows, setRows] = useState<BomRow[]>(() => storedBom.rows);
  const [activeCategory, setActiveCategory] = useState('All Items');
  const [statusFilter, setStatusFilter] = useState<'All' | BomStatus>('All');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [editingRow, setEditingRow] = useState<BomRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteRow, setDeleteRow] = useState<BomRow | null>(null);
  const [notes, setNotes] = useState(() => storedBom.notes);
  const [lastSaved, setLastSaved] = useState(() => storedBom.lastSaved);
  const [baseColumnWidths, setBaseColumnWidths] = useState<Record<BaseBomColumnKey, number>>(() => storedBom.baseColumnWidths);
  const [saveState, setSaveState] = useState<'Saved' | 'Saving...'>('Saved');
  const [referenceFiles, setReferenceFiles] = useState<ProjectAttachment[]>([]);
  const [electricalRows, setElectricalRows] = useState<ElectricalBomRow[]>(() => storedBom.electricalRows);
  const [electricalColumnSettings, setElectricalColumnSettings] = useState<Array<BomColumnSetting<ElectricalBomColumnKey>>>(() => storedBom.electricalColumnSettings);
  const [electricalCustomColumns, setElectricalCustomColumns] = useState<BomCustomColumn[]>(() => storedBom.electricalCustomColumns);
  const [electricalFiles, setElectricalFiles] = useState<ProjectAttachment[]>([]);
  const [uploadingElectrical, setUploadingElectrical] = useState(false);
  const [mechanicalRows, setMechanicalRows] = useState<MechanicalBomRow[]>(() => storedBom.mechanicalRows);
  const [mechanicalColumnSettings, setMechanicalColumnSettings] = useState<Array<BomColumnSetting<MechanicalBomColumnKey>>>(() => storedBom.mechanicalColumnSettings);
  const [mechanicalCustomColumns, setMechanicalCustomColumns] = useState<BomCustomColumn[]>(() => storedBom.mechanicalCustomColumns);
  const [mechanicalFiles, setMechanicalFiles] = useState<ProjectAttachment[]>([]);
  const [uploadingMechanical, setUploadingMechanical] = useState(false);
  const [electricalTables, setElectricalTables] = useState<BenchmarkingTableData[]>(() => storedBom.electricalTables);
  const [selectedElectricalCell, setSelectedElectricalCell] = useState<SelectedCell | null>(null);
  const [showElectricalTableModal, setShowElectricalTableModal] = useState(false);
  const [deleteElectricalTable, setDeleteElectricalTable] = useState<BenchmarkingTableData | null>(null);
  const [mechanicalTables, setMechanicalTables] = useState<BenchmarkingTableData[]>(() => storedBom.mechanicalTables);
  const [selectedMechanicalCell, setSelectedMechanicalCell] = useState<SelectedCell | null>(null);
  const [showMechanicalTableModal, setShowMechanicalTableModal] = useState(false);
  const [deleteMechanicalTable, setDeleteMechanicalTable] = useState<BenchmarkingTableData | null>(null);
  const [editingBomCell, setEditingBomCell] = useState<EditingBomCell>(null);
  const [fullscreenBomTable, setFullscreenBomTable] = useState<null | 'base' | 'electrical' | 'mechanical'>(null);
  const [electricalFormulaDraft, setElectricalFormulaDraft] = useState<FormulaBuilderDraft>(() => ({
    target: defaultElectricalFormulaTarget,
    formula: getElectricalFormulaDraft(defaultElectricalColumnSettings, [], defaultElectricalFormulaTarget)
  }));
  const [mechanicalFormulaDraft, setMechanicalFormulaDraft] = useState<FormulaBuilderDraft>(() => ({
    target: defaultMechanicalFormulaTarget,
    formula: getMechanicalFormulaDraft(defaultMechanicalColumnSettings, [], defaultMechanicalFormulaTarget)
  }));

  useEffect(() => {
    setSaveState('Saving...');
    const timeout = window.setTimeout(() => {
      const timestamp = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify({ rows, baseColumnWidths, electricalRows, electricalColumnSettings, electricalCustomColumns, mechanicalRows, mechanicalColumnSettings, mechanicalCustomColumns, electricalTables, mechanicalTables, notes, lastSaved: timestamp }));
      setLastSaved(timestamp);
      setSaveState('Saved');
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [baseColumnWidths, electricalColumnSettings, electricalCustomColumns, electricalRows, electricalTables, mechanicalColumnSettings, mechanicalCustomColumns, mechanicalRows, mechanicalTables, notes, rows, storageKey]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchProjectAttachments(project.productCode, 'BOM'),
      fetchProjectAttachments(project.productCode, electricalBomStage),
      fetchProjectAttachments(project.productCode, mechanicalBomStage)
    ])
      .then(([bomAttachments, electricalAttachments, mechanicalAttachments]) => {
        if (!active) return;
        setReferenceFiles(bomAttachments);
        setElectricalFiles(electricalAttachments);
        setMechanicalFiles(mechanicalAttachments);
      })
      .catch(() => {
        if (!active) return;
        setReferenceFiles([]);
        setElectricalFiles([]);
        setMechanicalFiles([]);
      });
    return () => {
      active = false;
    };
  }, [project.productCode]);

  const categories = useMemo(() => {
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.category] = (acc[row.category] || 0) + 1;
      return acc;
    }, {});
    return ['All Items', ...Object.keys(counts)].map((category) => ({
      category,
      count: category === 'All Items' ? rows.length : counts[category]
    }));
  }, [rows]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const categoryMatch = activeCategory === 'All Items' || row.category === activeCategory;
      const statusMatch = statusFilter === 'All' || row.status === statusFilter;
      const searchMatch = !normalized || [row.itemName, row.specification, row.supplier, row.referenceDocument].some((value) => value.toLowerCase().includes(normalized));
      return categoryMatch && statusMatch && searchMatch;
    });
  }, [activeCategory, query, rows, statusFilter]);

  const pricedRows = rows.filter((row) => row.unitCost !== null);
  const estimatedCost = pricedRows.reduce((sum, row) => sum + row.quantityPerUnit * (row.unitCost || 0), 0);
  const withReference = rows.filter((row) => row.supplier || row.referenceDocument || row.specification).length;
  const statusCounts = {
    Procured: rows.filter((row) => row.status === 'Procured').length,
    Ordered: rows.filter((row) => row.status === 'Ordered').length,
    Pending: rows.filter((row) => row.status === 'Pending').length
  };
  const electricalSummary = getElectricalSummary(electricalRows, electricalColumnSettings, electricalCustomColumns, electricalFiles.length);
  const mechanicalSummary = getMechanicalSummary(mechanicalRows, mechanicalColumnSettings, mechanicalCustomColumns, mechanicalFiles.length);
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id));
  const hasElectricalData = electricalRows.some((row) => bomRowHasData(row)) || electricalTables.some(tableHasData);
  const hasMechanicalData = mechanicalRows.some((row) => bomRowHasData(row)) || mechanicalTables.some(tableHasData);
  const canComplete = isElectricalStage
    ? hasElectricalData
    : isMechanicalStage
      ? hasMechanicalData
    : rows.length > 0 && rows.every((row) => row.itemName && row.category && row.unit && row.quantityPerUnit > 0);

  function upsertRow(row: BomRow) {
    setRows((current) => current.some((item) => item.id === row.id)
      ? current.map((item) => item.id === row.id ? row : item)
      : [...current, row]);
    setShowForm(false);
    setEditingRow(null);
  }

  async function removeRow(rowToRemove: BomRow) {
    setRows((current) => current.filter((row) => row.id !== rowToRemove.id));
    setSelected((current) => current.filter((id) => id !== rowToRemove.id));
    setDeleteRow(null);
    const matchingAttachment = referenceFiles.find((file) => file.name === rowToRemove.referenceDocument);
    if (!matchingAttachment) return;
    try {
      await deleteProjectAttachment(project.productCode, 'BOM', matchingAttachment._id);
      setReferenceFiles((current) => current.filter((file) => file._id !== matchingAttachment._id));
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Reference file not deleted',
        message: error instanceof Error ? error.message : 'The BOM item was removed, but its reference file could not be deleted.'
      });
    }
  }

  async function deleteReferenceDocument(file: ProjectAttachment) {
    try {
      await deleteProjectAttachment(project.productCode, 'BOM', file._id);
      setReferenceFiles((current) => current.filter((attachment) => attachment._id !== file._id));
      setRows((current) => current.map((row) => row.referenceDocument === file.name ? { ...row, referenceDocument: '' } : row));
      showToast({ tone: 'success', title: 'Reference deleted', message: `${file.name} was removed from this BOM.` });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Delete failed',
        message: error instanceof Error ? error.message : 'Reference document could not be deleted.'
      });
    }
  }

  async function uploadElectricalDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];
    const validExtension = /\.(pdf|csv|xls|xlsx|jpg|jpeg|png|webp)$/i.test(file.name);
    if (!validTypes.includes(file.type) && !validExtension) {
      showToast({ tone: 'error', title: 'Invalid document', message: 'Upload a PDF, Excel/CSV, JPG, PNG, or WebP file for Electrical BOM.' });
      event.target.value = '';
      return;
    }
    setUploadingElectrical(true);
    try {
      const attachment = await uploadProjectAttachment(project.productCode, electricalBomStage, file);
      setElectricalFiles((current) => [attachment, ...current]);
      showToast({ tone: 'success', title: 'Electrical BOM document uploaded', message: `${attachment.name} was added.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Upload failed', message: error instanceof Error ? error.message : 'Electrical BOM document could not be uploaded.' });
    } finally {
      setUploadingElectrical(false);
      event.target.value = '';
    }
  }

  async function deleteElectricalDocument(file: ProjectAttachment) {
    try {
      await deleteProjectAttachment(project.productCode, electricalBomStage, file._id);
      setElectricalFiles((current) => current.filter((attachment) => attachment._id !== file._id));
      showToast({ tone: 'success', title: 'Electrical document deleted', message: `${file.name} was removed.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Delete failed', message: error instanceof Error ? error.message : 'Electrical BOM document could not be deleted.' });
    }
  }

  async function uploadMechanicalDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validTypes = [
      'application/pdf',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];
    const validExtension = /\.(pdf|csv|xls|xlsx|jpg|jpeg|png|webp)$/i.test(file.name);
    if (!validTypes.includes(file.type) && !validExtension) {
      showToast({ tone: 'error', title: 'Invalid document', message: 'Upload a PDF, Excel/CSV, JPG, PNG, or WebP file for Mechanical BOM.' });
      event.target.value = '';
      return;
    }
    setUploadingMechanical(true);
    try {
      const attachment = await uploadProjectAttachment(project.productCode, mechanicalBomStage, file);
      setMechanicalFiles((current) => [attachment, ...current]);
      showToast({ tone: 'success', title: 'Mechanical BOM document uploaded', message: `${attachment.name} was added.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Upload failed', message: error instanceof Error ? error.message : 'Mechanical BOM document could not be uploaded.' });
    } finally {
      setUploadingMechanical(false);
      event.target.value = '';
    }
  }

  async function deleteMechanicalDocument(file: ProjectAttachment) {
    try {
      await deleteProjectAttachment(project.productCode, mechanicalBomStage, file._id);
      setMechanicalFiles((current) => current.filter((attachment) => attachment._id !== file._id));
      showToast({ tone: 'success', title: 'Mechanical document deleted', message: `${file.name} was removed.` });
    } catch (error) {
      showToast({ tone: 'error', title: 'Delete failed', message: error instanceof Error ? error.message : 'Mechanical BOM document could not be deleted.' });
    }
  }

  function updateElectricalRow(rowId: string, key: ElectricalBomColumnKey, value: string) {
    setElectricalRows((current) => current.map((row) => row.id === rowId ? { ...row, [key]: value } : row));
  }

  function renameElectricalBuiltInColumn(key: ElectricalBomColumnKey, label: string) {
    setElectricalColumnSettings((current) => current.map((column) => column.key === key ? { ...column, label } : column));
  }

  function deleteElectricalBuiltInColumn(key: ElectricalBomColumnKey) {
    if (electricalColumnSettings.length + electricalCustomColumns.length <= 1) return;
    if (!window.confirm('Delete this column?')) return;
    setElectricalColumnSettings((current) => current.filter((column) => column.key !== key));
    if (electricalFormulaDraft.target === `builtin:${key}`) {
      const nextColumn = [...electricalColumnSettings.filter((column) => column.key !== key), ...electricalCustomColumns][0];
      if (nextColumn) {
        const target = 'key' in nextColumn ? `builtin:${nextColumn.key}` : `custom:${nextColumn.id}`;
        setElectricalFormulaDraft({ target, formula: nextColumn.formula || '' });
      }
    }
  }

  function applyElectricalFormula() {
    const formula = normalizeFormulaInput(electricalFormulaDraft.formula);
    setElectricalColumnFormula(electricalFormulaDraft.target, formula || undefined);
  }

  function clearElectricalFormula() {
    setElectricalFormulaDraft((current) => ({ ...current, formula: '' }));
    setElectricalColumnFormula(electricalFormulaDraft.target, undefined);
  }

  function setElectricalColumnFormula(target: string, formula: string | undefined) {
    if (target.startsWith('builtin:')) {
      const key = target.slice('builtin:'.length) as ElectricalBomColumnKey;
      setElectricalColumnSettings((current) => current.map((column) => column.key === key ? { ...column, formula } : column));
      return;
    }
    if (target.startsWith('custom:')) {
      const id = target.slice('custom:'.length);
      setElectricalCustomColumns((current) => current.map((column) => column.id === id ? { ...column, formula } : column));
    }
  }

  function updateElectricalCustomCell(rowId: string, columnId: string, value: string) {
    setElectricalRows((current) => current.map((row) => row.id === rowId ? { ...row, customCells: { ...(row.customCells || {}), [columnId]: value } } : row));
  }

  function addElectricalRow() {
    setElectricalRows((current) => [...current, withCustomCells(makeElectricalRow('', '', '1', 'Pc', '', '', '', '', '', '', '', '', ''), electricalCustomColumns)]);
  }

  function addElectricalColumn() {
    const label = window.prompt('Column name');
    const name = label?.trim();
    if (!name) return;
    const column = { id: makeId('electrical_col'), label: name };
    setElectricalCustomColumns((current) => [...current, column]);
    setElectricalRows((current) => current.map((row) => ({ ...row, customCells: { ...(row.customCells || {}), [column.id]: '' } })));
  }

  function renameElectricalColumn(columnId: string, label: string) {
    setElectricalCustomColumns((current) => current.map((column) => column.id === columnId ? { ...column, label } : column));
  }

  function deleteElectricalColumn(columnId: string) {
    if (!window.confirm('Delete this custom column?')) return;
    setElectricalCustomColumns((current) => current.filter((column) => column.id !== columnId));
    setElectricalRows((current) => current.map((row) => {
      const customCells = { ...(row.customCells || {}) };
      delete customCells[columnId];
      return { ...row, customCells };
    }));
  }

  function resetElectricalBom() {
    setElectricalRows(defaultElectricalRows);
    setElectricalColumnSettings(defaultElectricalColumnSettings);
    setElectricalCustomColumns([]);
    setElectricalFormulaDraft({
      target: defaultElectricalFormulaTarget,
      formula: getElectricalFormulaDraft(defaultElectricalColumnSettings, [], defaultElectricalFormulaTarget)
    });
  }

  function updateElectricalTable(table: BenchmarkingTableData) {
    setElectricalTables((current) => current.map((candidate) => candidate._id === table._id ? table : candidate));
  }

  function createElectricalTable(values: { name: string; initialColumns: number; initialRows: number }) {
    const columns = Array.from({ length: values.initialColumns }, () => ({ id: makeId('col') }));
    const rows = Array.from({ length: values.initialRows }, () => ({
      id: makeId('row'),
      cells: columns.reduce<Record<string, string>>((cells, column) => {
        cells[column.id] = '';
        return cells;
      }, {})
    }));
    setElectricalTables((current) => [...current, { _id: makeId('table'), name: values.name, columns, rows }]);
    setShowElectricalTableModal(false);
  }

  function confirmDeleteElectricalTable() {
    if (!deleteElectricalTable) return;
    setElectricalTables((current) => current.filter((table) => table._id !== deleteElectricalTable._id));
    setDeleteElectricalTable(null);
  }

  async function importElectricalTableCsv(table: BenchmarkingTableData, file: File) {
    const imported = makeSpreadsheetTable(table.name, parseCsvRows(await file.text()));
    setElectricalTables((current) => current.map((candidate) => candidate._id === table._id ? { ...imported, _id: table._id } : candidate));
  }

  function exportElectricalTableCsv(table: BenchmarkingTableData) {
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

  function updateMechanicalTable(table: BenchmarkingTableData) {
    setMechanicalTables((current) => current.map((candidate) => candidate._id === table._id ? table : candidate));
  }

  function createMechanicalTable(values: { name: string; initialColumns: number; initialRows: number }) {
    const columns = Array.from({ length: values.initialColumns }, () => ({ id: makeId('col') }));
    const rows = Array.from({ length: values.initialRows }, () => ({
      id: makeId('row'),
      cells: columns.reduce<Record<string, string>>((cells, column) => {
        cells[column.id] = '';
        return cells;
      }, {})
    }));
    setMechanicalTables((current) => [...current, { _id: makeId('table'), name: values.name, columns, rows }]);
    setShowMechanicalTableModal(false);
  }

  function confirmDeleteMechanicalTable() {
    if (!deleteMechanicalTable) return;
    setMechanicalTables((current) => current.filter((table) => table._id !== deleteMechanicalTable._id));
    setDeleteMechanicalTable(null);
  }

  async function importMechanicalTableCsv(table: BenchmarkingTableData, file: File) {
    const imported = makeSpreadsheetTable(table.name, parseCsvRows(await file.text()));
    setMechanicalTables((current) => current.map((candidate) => candidate._id === table._id ? { ...imported, _id: table._id } : candidate));
  }

  function exportMechanicalTableCsv(table: BenchmarkingTableData) {
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

  function updateMechanicalRow(rowId: string, key: MechanicalBomColumnKey, value: string) {
    setMechanicalRows((current) => current.map((row) => row.id === rowId ? { ...row, [key]: value } : row));
  }

  function renameMechanicalBuiltInColumn(key: MechanicalBomColumnKey, label: string) {
    setMechanicalColumnSettings((current) => current.map((column) => column.key === key ? { ...column, label } : column));
  }

  function deleteMechanicalBuiltInColumn(key: MechanicalBomColumnKey) {
    if (mechanicalColumnSettings.length + mechanicalCustomColumns.length <= 1) return;
    if (!window.confirm('Delete this column?')) return;
    setMechanicalColumnSettings((current) => current.filter((column) => column.key !== key));
    if (mechanicalFormulaDraft.target === `builtin:${key}`) {
      const nextColumn = [...mechanicalColumnSettings.filter((column) => column.key !== key), ...mechanicalCustomColumns][0];
      if (nextColumn) {
        const target = 'key' in nextColumn ? `builtin:${nextColumn.key}` : `custom:${nextColumn.id}`;
        setMechanicalFormulaDraft({ target, formula: nextColumn.formula || '' });
      }
    }
  }

  function applyMechanicalFormula() {
    const formula = normalizeFormulaInput(mechanicalFormulaDraft.formula);
    setMechanicalColumnFormula(mechanicalFormulaDraft.target, formula || undefined);
  }

  function clearMechanicalFormula() {
    setMechanicalFormulaDraft((current) => ({ ...current, formula: '' }));
    setMechanicalColumnFormula(mechanicalFormulaDraft.target, undefined);
  }

  function setMechanicalColumnFormula(target: string, formula: string | undefined) {
    if (target.startsWith('builtin:')) {
      const key = target.slice('builtin:'.length) as MechanicalBomColumnKey;
      setMechanicalColumnSettings((current) => current.map((column) => column.key === key ? { ...column, formula } : column));
      return;
    }
    if (target.startsWith('custom:')) {
      const id = target.slice('custom:'.length);
      setMechanicalCustomColumns((current) => current.map((column) => column.id === id ? { ...column, formula } : column));
    }
  }

  function updateMechanicalCustomCell(rowId: string, columnId: string, value: string) {
    setMechanicalRows((current) => current.map((row) => row.id === rowId ? { ...row, customCells: { ...(row.customCells || {}), [columnId]: value } } : row));
  }

  function addMechanicalRow() {
    setMechanicalRows((current) => [...current, withCustomCells(makeMechanicalRow(String(current.length + 1), '', '', '', '', '1', 'Pcs'), mechanicalCustomColumns)]);
  }

  function addMechanicalColumn() {
    const label = window.prompt('Column name');
    const name = label?.trim();
    if (!name) return;
    const column = { id: makeId('mechanical_col'), label: name };
    setMechanicalCustomColumns((current) => [...current, column]);
    setMechanicalRows((current) => current.map((row) => ({ ...row, customCells: { ...(row.customCells || {}), [column.id]: '' } })));
  }

  function renameMechanicalColumn(columnId: string, label: string) {
    setMechanicalCustomColumns((current) => current.map((column) => column.id === columnId ? { ...column, label } : column));
  }

  function deleteMechanicalColumn(columnId: string) {
    if (!window.confirm('Delete this custom column?')) return;
    setMechanicalCustomColumns((current) => current.filter((column) => column.id !== columnId));
    setMechanicalRows((current) => current.map((row) => {
      const customCells = { ...(row.customCells || {}) };
      delete customCells[columnId];
      return { ...row, customCells };
    }));
  }

  function resetMechanicalBom() {
    setMechanicalRows(defaultMechanicalRows);
    setMechanicalColumnSettings(defaultMechanicalColumnSettings);
    setMechanicalCustomColumns([]);
    setMechanicalFormulaDraft({
      target: defaultMechanicalFormulaTarget,
      formula: getMechanicalFormulaDraft(defaultMechanicalColumnSettings, [], defaultMechanicalFormulaTarget)
    });
  }

  function removeSelected() {
    setRows((current) => current.filter((row) => !selected.includes(row.id)));
    setSelected([]);
  }

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelected((current) => current.filter((id) => !visibleRows.some((row) => row.id === id)));
      return;
    }
    setSelected((current) => Array.from(new Set([...current, ...visibleRows.map((row) => row.id)])));
  }

  function exportCsv() {
    const header = ['Sr No', 'Item Name', 'Category', 'Specification', 'Supplier / Reference', 'Unit', 'Quantity Per Unit', 'Unit Cost', 'Total Cost', 'Reference', 'Status'];
    const csv = [
      header.join(','),
      ...visibleRows.map((row, index) => [
        index + 1,
        row.itemName,
        row.category,
        row.specification,
        row.supplier,
        row.unit,
        row.quantityPerUnit,
        row.unitCost ?? '',
        row.unitCost === null ? '' : row.quantityPerUnit * row.unitCost,
        row.referenceDocument,
        row.status
      ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.productCode}-BOM.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const imported = parseCsv(text);
    setRows((current) => {
      const existingNames = new Set(current.map((row) => row.itemName.trim().toLowerCase()));
      const freshRows = imported.filter((row) => !existingNames.has(row.itemName.trim().toLowerCase()));
      return [...current, ...freshRows];
    });
    event.target.value = '';
  }

  function resetBom() {
    const seeded = seedBomRows(project.bom);
    setRows(seeded);
    setElectricalRows(defaultElectricalRows);
    setElectricalColumnSettings(defaultElectricalColumnSettings);
    setElectricalCustomColumns([]);
    setElectricalFormulaDraft({
      target: defaultElectricalFormulaTarget,
      formula: getElectricalFormulaDraft(defaultElectricalColumnSettings, [], defaultElectricalFormulaTarget)
    });
    setElectricalTables([]);
    setMechanicalRows(defaultMechanicalRows);
    setMechanicalColumnSettings(defaultMechanicalColumnSettings);
    setMechanicalCustomColumns([]);
    setMechanicalFormulaDraft({
      target: defaultMechanicalFormulaTarget,
      formula: getMechanicalFormulaDraft(defaultMechanicalColumnSettings, [], defaultMechanicalFormulaTarget)
    });
    setMechanicalTables([]);
    setNotes(defaultNotes);
    setSelected([]);
    setActiveCategory('All Items');
    setStatusFilter('All');
    setQuery('');
  }

  function handleCompleteStage() {
    const missing = isElectricalStage
      ? [
        !hasElectricalData ? 'Electrical BOM item or custom table data' : ''
      ].filter(Boolean)
      : isMechanicalStage
        ? [
          !hasMechanicalData ? 'Mechanical BOM item or custom table data' : ''
        ].filter(Boolean)
      : [
        !rows.length ? 'At least one BOM item' : '',
        rows.some((row) => !row.itemName.trim()) ? 'Item Name' : '',
        rows.some((row) => !row.category.trim()) ? 'Category' : '',
        rows.some((row) => !row.unit.trim()) ? 'Unit' : '',
        rows.some((row) => !Number.isFinite(row.quantityPerUnit) || row.quantityPerUnit <= 0) ? 'Quantity per Unit' : ''
      ].filter(Boolean);
    if (showMissingFieldsToast(showToast, missing)) return;
    completeStage(currentStage);
  }

  function moveBomCellFocus(tableId: string, rowIndex: number, columnIndex: number, rowDelta: number, columnDelta: number) {
    const targetRow = rowIndex + rowDelta;
    const targetColumn = columnIndex + columnDelta;
    if (targetRow < 0 || targetColumn < 0) return;
    const input = document.querySelector<HTMLInputElement>(
      `[data-bom-table="${tableId}"][data-row-index="${targetRow}"][data-column-index="${targetColumn}"]`
    );
    input?.focus();
    input?.select();
  }

  function handleBomCellKeyDown(event: KeyboardEvent<HTMLInputElement>, tableId: string, rowIndex: number, columnIndex: number) {
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    const direction = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1]
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    moveBomCellFocus(tableId, rowIndex, columnIndex, direction[0], direction[1]);
  }

  function clampColumnWidth(width?: number, fallback = defaultSpreadsheetColumnWidth) {
    const nextWidth = Number.isFinite(width) ? Number(width) : fallback;
    return Math.min(maxColumnWidth, Math.max(minColumnWidth, Math.round(nextWidth)));
  }

  function startColumnResize(event: ReactMouseEvent, width: number | undefined, onResize: (width: number) => void, fallback?: number) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = clampColumnWidth(width, fallback);

    function handleMouseMove(moveEvent: MouseEvent) {
      onResize(clampColumnWidth(startWidth + moveEvent.clientX - startX, fallback));
    }

    function handleMouseUp() {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  function resizeBaseColumn(key: BaseBomColumnKey, width: number) {
    setBaseColumnWidths((current) => ({ ...current, [key]: width }));
  }

  function resizeElectricalColumn(key: ElectricalBomColumnKey, width: number) {
    setElectricalColumnSettings((current) => current.map((column) => column.key === key ? { ...column, width } : column));
  }

  function resizeElectricalCustomColumn(columnId: string, width: number) {
    setElectricalCustomColumns((current) => current.map((column) => column.id === columnId ? { ...column, width } : column));
  }

  function resizeMechanicalColumn(key: MechanicalBomColumnKey, width: number) {
    setMechanicalColumnSettings((current) => current.map((column) => column.key === key ? { ...column, width } : column));
  }

  function resizeMechanicalCustomColumn(columnId: string, width: number) {
    setMechanicalCustomColumns((current) => current.map((column) => column.id === columnId ? { ...column, width } : column));
  }

  function ResizeHandle({ label, width, fallback, onResize }: { label: string; width?: number; fallback?: number; onResize: (width: number) => void }) {
    return (
      <button
        type="button"
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none bg-transparent hover:bg-primary/20"
        aria-label={`Resize ${label}`}
        onMouseDown={(event) => startColumnResize(event, width, onResize, fallback)}
      />
    );
  }

  const baseBomColumnKeys = Object.keys(defaultBaseBomColumnWidths) as BaseBomColumnKey[];
  const baseBomTableWidth = baseBomColumnKeys.reduce((sum, key) => sum + clampColumnWidth(baseColumnWidths[key], defaultBaseBomColumnWidths[key]), 0);
  const electricalTableWidth = electricalColumnSettings.reduce((sum, column) => sum + clampColumnWidth(column.width, defaultSpreadsheetColumnWidth), 0)
    + electricalCustomColumns.reduce((sum, column) => sum + clampColumnWidth(column.width, 144), 0)
    + 92;
  const mechanicalTableWidth = mechanicalColumnSettings.reduce((sum, column) => sum + clampColumnWidth(column.width, defaultSpreadsheetColumnWidth), 0)
    + mechanicalCustomColumns.reduce((sum, column) => sum + clampColumnWidth(column.width, 128), 0)
    + 72;

  return (
    <div className="mx-auto max-w-[1500px] space-y-3 text-sm">
      <TopCrumbs title={project.name} code={project.productCode} currentStage={currentStage} />
      <ProjectStageHeader project={project} currentStage={currentStage} />
      <StageResponseBuilder projectCode={project.productCode} stageName={currentStage} mode="controls" />

      {isBaseBomStage ? (
        <>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Bill of Materials (BOM)</h2>
          <p className="mt-1.5 max-w-4xl text-sm text-slate-600">Manage all raw materials, components, packaging, costs, suppliers, and references required to manufacture this product.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input id="bom-csv-import" className="sr-only" type="file" accept=".csv,text/csv" onChange={importCsv} />
          <label className="secondary-button h-10 cursor-pointer gap-2" htmlFor="bom-csv-import"><Upload size={16} />Import CSV</label>
          <button className="secondary-button h-10 gap-2" onClick={exportCsv}><Download size={16} />Export to Excel</button>
          <button className="secondary-button h-10 gap-2" onClick={resetBom}>Reset</button>
          <button className="primary-button" onClick={() => { setEditingRow(null); setShowForm(true); }}><Plus size={18} />Add Item</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Box size={28} />} tone="blue" label="Total Items" value={rows.length.toString()} note="Active items" />
        <SummaryCard icon={<ReceiptText size={28} />} tone="green" label="Total Estimated Cost" value={formatCurrency(estimatedCost)} note={`${pricedRows.length} of ${rows.length} items priced`} />
        <SummaryCard icon={<FileText size={28} />} tone="blue" label="Items with Reference" value={`${withReference} / ${rows.length}`} note="Have supplier/reference" />
        <ProcurementStatusCard counts={statusCounts} />
      </section>

      <section className={`${fullscreenBomTable === 'base' ? 'fixed inset-0 z-[70] flex flex-col overflow-hidden rounded-none bg-white p-4' : 'rounded-lg'} border border-slate-200 bg-white shadow-soft`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3">
          <div className="flex flex-wrap gap-5">
            {categories.map((item) => (
              <button key={item.category} className={`border-b-2 px-1 pb-2.5 text-sm font-bold ${activeCategory === item.category ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-ink'}`} onClick={() => setActiveCategory(item.category)}>
                {item.category} ({item.count})
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="secondary-button h-10 gap-2 text-primary"
              onClick={() => setFullscreenBomTable((current) => current === 'base' ? null : 'base')}
            >
              {fullscreenBomTable === 'base' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {fullscreenBomTable === 'base' ? 'Exit Full Screen' : 'Full Screen'}
            </button>
            <label className="relative block w-80 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input className="field pl-10" placeholder="Search items, supplier, or reference..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select className="field h-10 w-32" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'All' | BomStatus)}>
              <option>All</option>
              <option>Pending</option>
              <option>Ordered</option>
              <option>Procured</option>
            </select>
          </div>
        </div>

        {selected.length ? (
          <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50 px-4 py-3 text-sm">
            <span className="font-bold text-primary">{selected.length} selected</span>
            <button className="secondary-button h-9 gap-2 text-rose-600" onClick={removeSelected}><Trash2 size={16} />Delete Selected</button>
          </div>
        ) : null}

        {rows.length ? (
          <div className={`${fullscreenBomTable === 'base' ? 'min-h-0 flex-1' : ''} overflow-x-auto`}>
            <table className="table-fixed text-left" style={{ width: baseBomTableWidth, minWidth: baseBomTableWidth, maxWidth: baseBomTableWidth }}>
              <colgroup>
                {baseBomColumnKeys.map((key) => (
                  <col key={key} style={{ width: clampColumnWidth(baseColumnWidths[key], defaultBaseBomColumnWidths[key]), minWidth: clampColumnWidth(baseColumnWidths[key], defaultBaseBomColumnWidths[key]), maxWidth: clampColumnWidth(baseColumnWidths[key], defaultBaseBomColumnWidths[key]) }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="relative px-2.5 py-2.5"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} /><ResizeHandle label="selection column" width={baseColumnWidths.select} fallback={defaultBaseBomColumnWidths.select} onResize={(width) => resizeBaseColumn('select', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">#<ResizeHandle label="number column" width={baseColumnWidths.index} fallback={defaultBaseBomColumnWidths.index} onResize={(width) => resizeBaseColumn('index', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Item Name<ResizeHandle label="Item Name column" width={baseColumnWidths.itemName} fallback={defaultBaseBomColumnWidths.itemName} onResize={(width) => resizeBaseColumn('itemName', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Category<ResizeHandle label="Category column" width={baseColumnWidths.category} fallback={defaultBaseBomColumnWidths.category} onResize={(width) => resizeBaseColumn('category', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Specification<ResizeHandle label="Specification column" width={baseColumnWidths.specification} fallback={defaultBaseBomColumnWidths.specification} onResize={(width) => resizeBaseColumn('specification', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Supplier / Reference<ResizeHandle label="Supplier column" width={baseColumnWidths.supplier} fallback={defaultBaseBomColumnWidths.supplier} onResize={(width) => resizeBaseColumn('supplier', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Unit<ResizeHandle label="Unit column" width={baseColumnWidths.unit} fallback={defaultBaseBomColumnWidths.unit} onResize={(width) => resizeBaseColumn('unit', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Qty / Unit<ResizeHandle label="Qty per Unit column" width={baseColumnWidths.quantityPerUnit} fallback={defaultBaseBomColumnWidths.quantityPerUnit} onResize={(width) => resizeBaseColumn('quantityPerUnit', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Unit Cost<ResizeHandle label="Unit Cost column" width={baseColumnWidths.unitCost} fallback={defaultBaseBomColumnWidths.unitCost} onResize={(width) => resizeBaseColumn('unitCost', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Total Cost<ResizeHandle label="Total Cost column" width={baseColumnWidths.totalCost} fallback={defaultBaseBomColumnWidths.totalCost} onResize={(width) => resizeBaseColumn('totalCost', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Reference Document<ResizeHandle label="Reference Document column" width={baseColumnWidths.referenceDocument} fallback={defaultBaseBomColumnWidths.referenceDocument} onResize={(width) => resizeBaseColumn('referenceDocument', width)} /></th>
                  <th className="relative px-2.5 py-2.5 font-bold">Status<ResizeHandle label="Status column" width={baseColumnWidths.status} fallback={defaultBaseBomColumnWidths.status} onResize={(width) => resizeBaseColumn('status', width)} /></th>
                  <th className="relative px-2.5 py-2.5 text-center font-bold">Actions<ResizeHandle label="Actions column" width={baseColumnWidths.actions} fallback={defaultBaseBomColumnWidths.actions} onResize={(width) => resizeBaseColumn('actions', width)} /></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-slate-200 text-xs">
                    <td className="px-2.5 py-2.5"><input type="checkbox" checked={selected.includes(row.id)} onChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} /></td>
                    <td className="px-2.5 py-2.5">{index + 1}</td>
                    <td className="break-words px-2.5 py-2.5 font-bold">{row.itemName}</td>
                    <td className="px-2.5 py-2.5"><CategoryBadge category={row.category} /></td>
                    <td className="break-words px-2.5 py-2.5">{row.specification || '-'}</td>
                    <td className="break-words px-2.5 py-2.5">{row.supplier || '-'}</td>
                    <td className="px-2.5 py-2.5">{row.unit}</td>
                    <td className="px-2.5 py-2.5">{row.quantityPerUnit}</td>
                    <td className="px-2.5 py-2.5">{row.unitCost === null ? '-' : formatCurrency(row.unitCost)}</td>
                    <td className="px-2.5 py-2.5 font-bold">{row.unitCost === null ? '-' : formatCurrency(row.quantityPerUnit * row.unitCost)}</td>
                    <td className="break-words px-2.5 py-2.5">{row.referenceDocument ? <button className="inline-flex min-w-0 items-center gap-1 break-words text-left font-semibold text-primary disabled:cursor-not-allowed disabled:text-slate-400" disabled={!resolveFileUrl(referenceFiles.find((file) => file.name === row.referenceDocument))} title={resolveFileUrl(referenceFiles.find((file) => file.name === row.referenceDocument)) ? 'Open reference' : NO_FILE_AVAILABLE} onClick={() => openFile(referenceFiles.find((file) => file.name === row.referenceDocument))}><Paperclip className="shrink-0" size={14} /><span className="min-w-0 break-words">{row.referenceDocument}</span></button> : '-'}</td>
                    <td className="px-2.5 py-2.5">
                      <select className={`rounded-full px-2.5 py-1 text-xs font-bold outline-none ${statusClass(row.status)}`} value={row.status} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: event.target.value as BomStatus } : item))}>
                        <option>Pending</option><option>Ordered</option><option>Procured</option>
                      </select>
                    </td>
                    <td className="px-2.5 py-2.5">
                      <div className="flex justify-center gap-2">
                        <button className="icon-button h-8 w-8 text-primary" title="Edit item" onClick={() => { setEditingRow(row); setShowForm(true); }}><Edit2 size={14} /></button>
                        <button className="icon-button h-8 w-8 text-rose-600" title="Delete item" onClick={() => setDeleteRow(row)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState onAdd={() => setShowForm(true)} />}
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.8fr)]">
        <ReferenceDocuments files={referenceFiles} rows={rows} onDelete={deleteReferenceDocument} />
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><FileText className="text-primary" size={22} /><h3 className="font-bold">BOM Notes <span className="font-normal text-slate-500">(Optional)</span></h3></div>
            <span className="text-xs font-semibold text-slate-400">Auto-saved</span>
          </div>
          <textarea className="field min-h-24 resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </div>
      </section>
        </>
      ) : null}

      {isElectricalStage ? <section className={`${fullscreenBomTable === 'electrical' ? 'fixed inset-0 z-[70] flex flex-col rounded-none p-4' : 'rounded-lg'} overflow-hidden border border-slate-200 bg-white shadow-soft`}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-cyan-50/60 p-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Electrical BOM</h3>
            <p className="mt-1 text-sm text-slate-500">Manage PCB components, costing, sourcing, pads, soldering and related BOM documents.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="secondary-button h-10 gap-2 border-cyan-800/30 text-cyan-900"
              onClick={() => setFullscreenBomTable((current) => current === 'electrical' ? null : 'electrical')}
            >
              {fullscreenBomTable === 'electrical' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {fullscreenBomTable === 'electrical' ? 'Exit Full Screen' : 'Full Screen'}
            </button>
            <button className="primary-button h-10 gap-2 shadow-md shadow-cyan-950/10" onClick={addElectricalRow}><Plus size={16} />Add Electrical Item</button>
            <button className="secondary-button h-10 gap-2 border-cyan-800/30 text-cyan-900" onClick={addElectricalColumn}><Plus size={16} />Add Column</button>
            <button className="secondary-button h-10 gap-2 border-cyan-800/30 text-cyan-900" onClick={() => setShowElectricalTableModal(true)}><Grid2X2 size={16} />Create New Table</button>
            <button className="secondary-button h-10 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={resetElectricalBom}><RotateCcw size={16} />Reset</button>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
          <BomMetricCard icon={<CircuitBoard size={24} />} label="Total Items" value={String(electricalSummary.totalItems)} />
          <BomMetricCard icon={<Coins size={24} />} label="Total Cost" value={formatCompactRupees(electricalSummary.totalCost)} />
          <BomMetricCard icon={<CircuitBoard size={24} />} label="Pad Cost" value={formatCompactRupees(electricalSummary.padCost)} />
          <BomMetricCard icon={<PenLine size={24} />} label="Soldering" value={formatCompactRupees(electricalSummary.solderingCost)} />
          <BomMetricCard icon={<Truck size={24} />} label="Pending Suppliers" value={String(electricalSummary.pendingSuppliers)} />
          <BomMetricCard icon={<FileText size={24} />} label="Documents" value={String(electricalSummary.documents)} />
        </div>
        <div className="px-4 pb-3">
          <FormulaBuilder
            columns={makeFormulaBuilderOptions(electricalColumnSettings, electricalCustomColumns)}
            draft={electricalFormulaDraft}
            onApply={applyElectricalFormula}
            onChange={(draft) => setElectricalFormulaDraft(draft)}
            onClear={clearElectricalFormula}
          />
        </div>
        <div className={`mx-4 mb-4 overflow-hidden rounded-lg border border-slate-200 ${fullscreenBomTable === 'electrical' ? 'min-h-0 flex-1' : ''}`}>
          <div className={`${fullscreenBomTable === 'electrical' ? 'h-full' : ''} overflow-auto`}>
          <table className="table-fixed border-collapse text-left text-xs" style={{ width: electricalTableWidth, minWidth: electricalTableWidth, maxWidth: electricalTableWidth }}>
            <colgroup>
              {electricalColumnSettings.map((column) => (
                <col key={column.key} style={{ width: clampColumnWidth(column.width, defaultSpreadsheetColumnWidth), minWidth: clampColumnWidth(column.width, defaultSpreadsheetColumnWidth), maxWidth: clampColumnWidth(column.width, defaultSpreadsheetColumnWidth) }} />
              ))}
              {electricalCustomColumns.map((column) => (
                <col key={column.id} style={{ width: clampColumnWidth(column.width, 144), minWidth: clampColumnWidth(column.width, 144), maxWidth: clampColumnWidth(column.width, 144) }} />
              ))}
              <col style={{ width: 92, minWidth: 92, maxWidth: 92 }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-slate-600 shadow-sm">
                {electricalColumnSettings.map((column) => (
                  <th key={column.key} className={`relative overflow-hidden border border-slate-200 px-2 py-2.5 font-extrabold ${column.className?.includes('text-center') ? 'text-center' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      <input
                        className={`h-7 min-w-0 flex-1 bg-transparent text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${column.className?.includes('text-center') ? 'text-center' : ''}`}
                        value={column.label}
                        onChange={(event) => renameElectricalBuiltInColumn(column.key, event.target.value)}
                      />
                      <button className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete column" onClick={() => deleteElectricalBuiltInColumn(column.key)}>
                        <X size={14} />
                      </button>
                    </div>
                    <ResizeHandle label={`${column.label} column`} width={column.width} fallback={defaultSpreadsheetColumnWidth} onResize={(width) => resizeElectricalColumn(column.key, width)} />
                  </th>
                ))}
                {electricalCustomColumns.map((column) => (
                  <th key={column.id} className="relative overflow-hidden border border-slate-200 px-2 py-2.5 font-extrabold">
                    <div className="flex items-center gap-1.5">
                      <input
                        className="h-7 min-w-0 flex-1 bg-transparent text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                        value={column.label}
                        onChange={(event) => renameElectricalColumn(column.id, event.target.value)}
                      />
                      <button className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete custom column" onClick={() => deleteElectricalColumn(column.id)}>
                        <X size={14} />
                      </button>
                    </div>
                    <ResizeHandle label={`${column.label} column`} width={column.width} fallback={144} onResize={(width) => resizeElectricalCustomColumn(column.id, width)} />
                  </th>
                ))}
                <th className="border border-slate-200 px-2 py-2.5 text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {electricalRows.map((row, rowIndex) => (
                <tr key={row.id} className="odd:bg-white even:bg-slate-50/40 hover:bg-cyan-50/40">
                  {electricalColumnSettings.map((column, columnIndex) => {
                    const rawValue = row[column.key] || column.formula || '';
                    const result = resolveBomFormula(rawValue, makeElectricalFormulaContext(row, electricalColumnSettings, electricalCustomColumns, rowIndex));
                    const editing = editingBomCell?.stage === 'electrical' && editingBomCell.rowId === row.id && editingBomCell.columnKey === String(column.key);
                    return (
                      <td key={column.key} className={`border border-slate-200 p-0 ${column.formula && !row[column.key] ? 'bg-cyan-100/80' : result.error ? 'bg-rose-50' : ''}`}>
                        <input
                          className={`h-9 w-full bg-transparent px-2 outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${column.className?.includes('text-center') ? 'text-center' : ''} ${column.formula && !row[column.key] ? 'font-bold text-slate-900' : result.error ? 'text-rose-700' : ''}`}
                          data-bom-table="electrical"
                          data-column-index={columnIndex}
                          data-row-index={rowIndex}
                          title={result.error ? 'Invalid formula' : rawValue.startsWith('=') ? rawValue : undefined}
                          value={editing || !rawValue.startsWith('=') ? rawValue : result.value}
                          onBlur={() => setEditingBomCell(null)}
                          onChange={(event) => updateElectricalRow(row.id, column.key, event.target.value)}
                          onFocus={() => setEditingBomCell({ stage: 'electrical', rowId: row.id, columnKey: String(column.key) })}
                          onKeyDown={(event) => handleBomCellKeyDown(event, 'electrical', rowIndex, columnIndex)}
                        />
                      </td>
                    );
                  })}
                  {electricalCustomColumns.map((column, customColumnIndex) => {
                    const rawValue = row.customCells?.[column.id] || column.formula || '';
                    const result = resolveBomFormula(rawValue, makeElectricalFormulaContext(row, electricalColumnSettings, electricalCustomColumns, rowIndex));
                    const editing = editingBomCell?.stage === 'electrical' && editingBomCell.rowId === row.id && editingBomCell.columnKey === column.id;
                    const columnIndex = electricalColumnSettings.length + customColumnIndex;
                    return (
                      <td key={column.id} className={`border border-slate-200 p-0 ${column.formula && !row.customCells?.[column.id] ? 'bg-cyan-100/80' : result.error ? 'bg-rose-50' : ''}`}>
                        <input
                          className={`h-9 w-full bg-transparent px-2 outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${column.formula && !row.customCells?.[column.id] ? 'font-bold text-slate-900' : result.error ? 'text-rose-700' : ''}`}
                          data-bom-table="electrical"
                          data-column-index={columnIndex}
                          data-row-index={rowIndex}
                          title={result.error ? 'Invalid formula' : rawValue.startsWith('=') ? rawValue : undefined}
                          value={editing || !rawValue.startsWith('=') ? rawValue : result.value}
                          onBlur={() => setEditingBomCell(null)}
                          onChange={(event) => updateElectricalCustomCell(row.id, column.id, event.target.value)}
                          onFocus={() => setEditingBomCell({ stage: 'electrical', rowId: row.id, columnKey: column.id })}
                          onKeyDown={(event) => handleBomCellKeyDown(event, 'electrical', rowIndex, columnIndex)}
                        />
                      </td>
                    );
                  })}
                  <td className="border border-slate-200 px-2 py-1 text-center">
                    <button className="icon-button h-8 w-8 text-rose-600" title="Delete electrical item" onClick={() => setElectricalRows((current) => current.filter((item) => item.id !== row.id))}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Paperclip className="text-primary" size={21} />
              <h4 className="font-bold">Electrical BOM Documents</h4>
              <span className="text-sm text-slate-500">{electricalFiles.length} files</span>
            </div>
            <label className={`secondary-button h-10 cursor-pointer gap-2 text-primary ${uploadingElectrical ? 'pointer-events-none opacity-60' : ''}`} htmlFor="electrical-bom-upload">
              <Upload size={16} />
              {uploadingElectrical ? 'Uploading...' : 'Upload Valid Document'}
            </label>
            <input id="electrical-bom-upload" className="sr-only" type="file" accept=".pdf,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.webp,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,image/webp" onChange={uploadElectricalDocument} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {electricalFiles.map((file) => (
              <div key={file._id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-100 text-primary"><FileText size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(file.fileSize || 0)}</p>
                </div>
                <button className="text-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={!resolveFileUrl(file)} title={resolveFileUrl(file) ? 'Open document' : NO_FILE_AVAILABLE} onClick={() => openFile(file)}>
                  <Download size={17} />
                </button>
                <button className="text-rose-600" title="Delete document" onClick={() => deleteElectricalDocument(file)}>
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            {!electricalFiles.length ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                Upload electrical BOM files such as PDF, Excel, CSV, or component reference images.
              </div>
            ) : null}
          </div>
        </div>
      </section> : null}

      {isElectricalStage ? electricalTables.map((table, index) => (
        <BenchmarkingTable
          key={table._id}
          index={index}
          selectedCell={selectedElectricalCell}
          table={table}
          onChangeTable={updateElectricalTable}
          onDeleteTable={setDeleteElectricalTable}
          onExportCsv={exportElectricalTableCsv}
          onImportCsv={importElectricalTableCsv}
          onSelectCell={setSelectedElectricalCell}
        />
      )) : null}

      {isMechanicalStage ? <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-white via-slate-50 to-cyan-50/60 p-4">
          <div>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">Mechanical BOM</h3>
            <p className="mt-1 text-sm text-slate-500">Manage mechanical parts, drawings, costing, sourcing and related BOM documents.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="primary-button h-10 gap-2 shadow-md shadow-cyan-950/10" onClick={addMechanicalRow}><Plus size={16} />Add Mechanical Item</button>
            <button className="secondary-button h-10 gap-2 border-cyan-800/30 text-cyan-900" onClick={addMechanicalColumn}><Plus size={16} />Add Column</button>
            <button className="secondary-button h-10 gap-2 border-cyan-800/30 text-cyan-900" onClick={() => setShowMechanicalTableModal(true)}><Grid2X2 size={16} />Create New Table</button>
            <button className="secondary-button h-10 gap-2 border-rose-200 text-rose-600 hover:bg-rose-50" onClick={resetMechanicalBom}><RotateCcw size={16} />Reset</button>
          </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
          <BomMetricCard icon={<Box size={24} />} label="Total Items" value={String(mechanicalSummary.totalItems)} />
          <BomMetricCard icon={<Coins size={24} />} label="Total Cost" value={formatCompactRupees(mechanicalSummary.totalCost)} />
          <BomMetricCard icon={<FileText size={24} />} label="Drawings" value={String(mechanicalSummary.drawings)} />
          <BomMetricCard icon={<Truck size={24} />} label="Suppliers" value={String(mechanicalSummary.suppliers)} />
          <BomMetricCard icon={<Columns3 size={24} />} label="Custom Columns" value={String(mechanicalSummary.customColumns)} />
          <BomMetricCard icon={<FileText size={24} />} label="Documents" value={String(mechanicalSummary.documents)} />
        </div>
        <div className="px-4 pb-3">
          <FormulaBuilder
            columns={makeFormulaBuilderOptions(mechanicalColumnSettings, mechanicalCustomColumns)}
            draft={mechanicalFormulaDraft}
            onApply={applyMechanicalFormula}
            onChange={(draft) => setMechanicalFormulaDraft(draft)}
            onClear={clearMechanicalFormula}
          />
        </div>
        <div className="mx-4 mb-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="overflow-x-auto">
          <table className="table-fixed border-collapse text-left text-xs" style={{ width: mechanicalTableWidth, minWidth: mechanicalTableWidth, maxWidth: mechanicalTableWidth }}>
            <colgroup>
              {mechanicalColumnSettings.map((column) => (
                <col key={column.key} style={{ width: clampColumnWidth(column.width, defaultSpreadsheetColumnWidth), minWidth: clampColumnWidth(column.width, defaultSpreadsheetColumnWidth), maxWidth: clampColumnWidth(column.width, defaultSpreadsheetColumnWidth) }} />
              ))}
              {mechanicalCustomColumns.map((column) => (
                <col key={column.id} style={{ width: clampColumnWidth(column.width, 128), minWidth: clampColumnWidth(column.width, 128), maxWidth: clampColumnWidth(column.width, 128) }} />
              ))}
              <col style={{ width: 72, minWidth: 72, maxWidth: 72 }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-slate-600 shadow-sm">
                {mechanicalColumnSettings.map((column) => (
                  <th key={column.key} className={`relative overflow-hidden border border-slate-200 px-1.5 py-2.5 text-center font-extrabold leading-tight ${column.className?.includes('text-center') ? 'text-center' : ''}`}>
                    <div className="flex items-center gap-1">
                      <input
                        className="h-7 min-w-0 flex-1 bg-transparent text-center text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                        value={column.label}
                        onChange={(event) => renameMechanicalBuiltInColumn(column.key, event.target.value)}
                      />
                      <button className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete column" onClick={() => deleteMechanicalBuiltInColumn(column.key)}>
                        <X size={14} />
                      </button>
                    </div>
                    <ResizeHandle label={`${column.label} column`} width={column.width} fallback={defaultSpreadsheetColumnWidth} onResize={(width) => resizeMechanicalColumn(column.key, width)} />
                  </th>
                ))}
                {mechanicalCustomColumns.map((column) => (
                  <th key={column.id} className="relative overflow-hidden border border-slate-200 px-1.5 py-2.5 text-center font-extrabold leading-tight">
                    <div className="flex items-center gap-1">
                      <input
                        className="h-7 min-w-0 flex-1 bg-transparent text-center text-xs font-extrabold text-slate-700 outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                        value={column.label}
                        onChange={(event) => renameMechanicalColumn(column.id, event.target.value)}
                      />
                      <button className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete custom column" onClick={() => deleteMechanicalColumn(column.id)}>
                        <X size={14} />
                      </button>
                    </div>
                    <ResizeHandle label={`${column.label} column`} width={column.width} fallback={128} onResize={(width) => resizeMechanicalCustomColumn(column.id, width)} />
                  </th>
                ))}
                <th className="w-16 border border-slate-200 px-1.5 py-2.5 text-center font-extrabold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mechanicalRows.map((row, rowIndex) => (
                <tr key={row.id} className="odd:bg-white even:bg-slate-50/40 hover:bg-cyan-50/40">
                  {mechanicalColumnSettings.map((column, columnIndex) => {
                    const rawValue = row[column.key] || column.formula || '';
                    const result = resolveBomFormula(rawValue, makeMechanicalFormulaContext(row, mechanicalColumnSettings, mechanicalCustomColumns, rowIndex));
                    const editing = editingBomCell?.stage === 'mechanical' && editingBomCell.rowId === row.id && editingBomCell.columnKey === String(column.key);
                    return (
                      <td key={column.key} className={`border border-slate-200 p-0 ${column.formula && !row[column.key] ? 'bg-cyan-100/80' : result.error ? 'bg-rose-50' : ''}`}>
                        <input
                          className={`h-8 w-full bg-transparent px-1.5 text-xs outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${column.className?.includes('text-center') ? 'text-center' : ''} ${column.formula && !row[column.key] ? 'font-bold text-slate-900' : result.error ? 'text-rose-700' : ''}`}
                          data-bom-table="mechanical"
                          data-column-index={columnIndex}
                          data-row-index={rowIndex}
                          title={result.error ? 'Invalid formula' : rawValue.startsWith('=') ? rawValue : undefined}
                          value={editing || !rawValue.startsWith('=') ? rawValue : result.value}
                          onBlur={() => setEditingBomCell(null)}
                          onChange={(event) => updateMechanicalRow(row.id, column.key, event.target.value)}
                          onFocus={() => setEditingBomCell({ stage: 'mechanical', rowId: row.id, columnKey: String(column.key) })}
                          onKeyDown={(event) => handleBomCellKeyDown(event, 'mechanical', rowIndex, columnIndex)}
                        />
                      </td>
                    );
                  })}
                  {mechanicalCustomColumns.map((column, customColumnIndex) => {
                    const rawValue = row.customCells?.[column.id] || column.formula || '';
                    const result = resolveBomFormula(rawValue, makeMechanicalFormulaContext(row, mechanicalColumnSettings, mechanicalCustomColumns, rowIndex));
                    const editing = editingBomCell?.stage === 'mechanical' && editingBomCell.rowId === row.id && editingBomCell.columnKey === column.id;
                    const columnIndex = mechanicalColumnSettings.length + customColumnIndex;
                    return (
                      <td key={column.id} className={`border border-slate-200 p-0 ${column.formula && !row.customCells?.[column.id] ? 'bg-cyan-100/80' : result.error ? 'bg-rose-50' : ''}`}>
                        <input
                          className={`h-8 w-full bg-transparent px-1.5 text-xs outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${column.formula && !row.customCells?.[column.id] ? 'font-bold text-slate-900' : result.error ? 'text-rose-700' : ''}`}
                          data-bom-table="mechanical"
                          data-column-index={columnIndex}
                          data-row-index={rowIndex}
                          title={result.error ? 'Invalid formula' : rawValue.startsWith('=') ? rawValue : undefined}
                          value={editing || !rawValue.startsWith('=') ? rawValue : result.value}
                          onBlur={() => setEditingBomCell(null)}
                          onChange={(event) => updateMechanicalCustomCell(row.id, column.id, event.target.value)}
                          onFocus={() => setEditingBomCell({ stage: 'mechanical', rowId: row.id, columnKey: column.id })}
                          onKeyDown={(event) => handleBomCellKeyDown(event, 'mechanical', rowIndex, columnIndex)}
                        />
                      </td>
                    );
                  })}
                  <td className="border border-slate-200 px-1.5 py-1 text-center">
                    <button className="icon-button h-7 w-7 text-rose-600" title="Delete mechanical item" onClick={() => setMechanicalRows((current) => current.filter((item) => item.id !== row.id))}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        <div className="border-t border-slate-200 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Paperclip className="text-primary" size={21} />
              <h4 className="font-bold">Mechanical BOM Documents</h4>
              <span className="text-sm text-slate-500">{mechanicalFiles.length} files</span>
            </div>
            <label className={`secondary-button h-10 cursor-pointer gap-2 text-primary ${uploadingMechanical ? 'pointer-events-none opacity-60' : ''}`} htmlFor="mechanical-bom-upload">
              <Upload size={16} />
              {uploadingMechanical ? 'Uploading...' : 'Upload Valid Document'}
            </label>
            <input id="mechanical-bom-upload" className="sr-only" type="file" accept=".pdf,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.webp,application/pdf,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,image/webp" onChange={uploadMechanicalDocument} />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {mechanicalFiles.map((file) => (
              <div key={file._id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-100 text-primary"><FileText size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(file.fileSize || 0)}</p>
                </div>
                <button className="text-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={!resolveFileUrl(file)} title={resolveFileUrl(file) ? 'Open document' : NO_FILE_AVAILABLE} onClick={() => openFile(file)}>
                  <Download size={17} />
                </button>
                <button className="text-rose-600" title="Delete document" onClick={() => deleteMechanicalDocument(file)}>
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
            {!mechanicalFiles.length ? (
              <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                Upload mechanical BOM files such as PDF, Excel, CSV, drawings, or part reference images.
              </div>
            ) : null}
          </div>
        </div>
      </section> : null}

      {isMechanicalStage ? mechanicalTables.map((table, index) => (
        <BenchmarkingTable
          key={table._id}
          index={index}
          selectedCell={selectedMechanicalCell}
          table={table}
          onChangeTable={updateMechanicalTable}
          onDeleteTable={setDeleteMechanicalTable}
          onExportCsv={exportMechanicalTableCsv}
          onImportCsv={importMechanicalTableCsv}
          onSelectCell={setSelectedMechanicalCell}
        />
      )) : null}

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
          <span>Last saved: {formatDateTime(lastSaved)}</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{saveState}</span>
        </div>
        <div className="text-right">
          {!canComplete ? <p className="mb-2 text-sm font-semibold text-amber-700">Add at least one valid {isElectricalStage ? 'electrical BOM' : isMechanicalStage ? 'mechanical BOM' : 'BOM'} item to complete this stage.</p> : null}
          <button className={`primary-button h-10 min-w-60 justify-center ${!canComplete ? 'cursor-not-allowed bg-slate-300 hover:bg-slate-300' : ''}`} aria-disabled={!canComplete} onClick={handleCompleteStage}><Check size={18} />Mark {currentStage} Complete</button>
        </div>
      </section>

      {showForm ? (
        <BomItemForm
          projectId={project.productCode}
          row={editingRow}
          onClose={() => setShowForm(false)}
          onReferenceUploaded={(attachment) => setReferenceFiles((current) => [attachment, ...current])}
          onSave={upsertRow}
          showToast={showToast}
        />
      ) : null}
      {deleteRow ? <DeleteDialog row={deleteRow} onCancel={() => setDeleteRow(null)} onDelete={() => removeRow(deleteRow)} /> : null}
      <AddTableModal
        examples="Examples: PCB Costing, Component Alternatives, Vendor Comparison"
        open={showElectricalTableModal}
        title="Create Electrical BOM Table"
        onClose={() => setShowElectricalTableModal(false)}
        onCreate={createElectricalTable}
      />
      <DeleteTableDialog table={deleteElectricalTable} onCancel={() => setDeleteElectricalTable(null)} onConfirm={confirmDeleteElectricalTable} />
      <AddTableModal
        examples="Examples: Fabrication Parts, Drawing Checklist, Supplier Comparison"
        open={showMechanicalTableModal}
        title="Create Mechanical BOM Table"
        onClose={() => setShowMechanicalTableModal(false)}
        onCreate={createMechanicalTable}
      />
      <DeleteTableDialog table={deleteMechanicalTable} onCancel={() => setDeleteMechanicalTable(null)} onConfirm={confirmDeleteMechanicalTable} />
      <StageResponseBuilder projectCode={project.productCode} stageName={currentStage} mode="blocks" />
    </div>
  );
}

function TopCrumbs({ title, code, currentStage }: { title: string; code: string; currentStage: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Link to="../overview" relative="path" className="icon-button h-10 w-10" title="Back to overview"><ChevronRight className="rotate-180" size={18} /></Link><h1 className="text-xl font-bold">{title}</h1></div>
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm text-slate-500"><Link to="/projects" className="hover:text-primary">Projects</Link><ChevronRight size={15} /><Link to="../overview" relative="path" className="hover:text-primary">{code}</Link><ChevronRight size={15} /><span className="font-bold text-ink">{currentStage}</span></div>
    </div>
  );
}

function ProjectSummary({ currentStage }: { currentStage: string }) {
  const { project } = useProjectWorkspace();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <div className="flex flex-wrap items-center gap-4">
        <div className="grid h-24 w-32 shrink-0 place-items-center rounded-lg bg-slate-100"><BeakerVisual /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">{project.name}</h2><span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-600" />{project.status}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Meta label="Product Code" value={project.productCode} />
            <Meta label="Category" value="Laboratory Glassware" />
            <Meta label="Current Stage" value={currentStage} />
            <Meta label="Priority" value={project.priority} pill />
            <Meta label="Target Date" value={formatDate(project.targetDate)} icon={<CalendarDays size={20} className="text-primary" />} />
          </div>
        </div>
      </div>
    </section>
  );
}

function BomItemForm({
  projectId,
  row,
  onClose,
  onReferenceUploaded,
  onSave,
  showToast
}: {
  projectId: string;
  row: BomRow | null;
  onClose: () => void;
  onReferenceUploaded: (attachment: ProjectAttachment) => void;
  onSave: (row: BomRow) => void;
  showToast: (toast: { tone: 'success' | 'error'; title: string; message?: string }) => void;
}) {
  const [form, setForm] = useState<BomRow>(row || { id: `bom_${Date.now()}`, itemName: '', category: 'Raw Material', specification: '', supplier: '', unit: 'pcs', quantityPerUnit: 1, unitCost: null, referenceDocument: '', status: 'Pending' });
  const [uploadingReference, setUploadingReference] = useState(false);
  const calculated = form.unitCost === null ? null : form.quantityPerUnit * form.unitCost;
  const uploadInputId = `bom-reference-upload-${form.id}`;

  async function uploadReferenceDocument(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingReference(true);
    try {
      const attachment = await uploadProjectAttachment(projectId, 'BOM', file);
      setForm((current) => ({ ...current, referenceDocument: attachment.name }));
      onReferenceUploaded(attachment);
      showToast({ tone: 'success', title: 'Reference uploaded', message: `${attachment.name} was stored in Supabase.` });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Upload failed',
        message: error instanceof Error ? error.message : 'Reference document could not be uploaded.'
      });
    } finally {
      setUploadingReference(false);
      event.target.value = '';
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const missingFields = [
      !form.itemName.trim() ? 'Item Name' : '',
      !form.category.trim() ? 'Category' : '',
      !form.unit.trim() ? 'Unit' : '',
      !Number.isFinite(form.quantityPerUnit) || form.quantityPerUnit <= 0 ? 'Quantity per Unit' : ''
    ].filter(Boolean);

    if (missingFields.length) {
      showToast({
        tone: 'error',
        title: 'Add required BOM value',
        message: `Please add ${missingFields.join(', ')} before saving this item.`
      });
      return;
    }

    onSave({
      ...form,
      itemName: form.itemName.trim(),
      category: form.category.trim(),
      unit: form.unit.trim(),
      specification: form.specification.trim(),
      supplier: form.supplier.trim(),
      referenceDocument: form.referenceDocument.trim()
    });
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <form className="w-full max-w-3xl rounded-lg bg-white p-5 shadow-2xl" onSubmit={submit}>
        <div className="mb-5 flex items-center justify-between gap-4"><h3 className="text-xl font-bold">{row ? 'Edit BOM Item' : 'Add BOM Item'}</h3><button type="button" className="text-sm font-bold text-slate-500" onClick={onClose}>Cancel</button></div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Item Name *"><input className="field" value={form.itemName} onChange={(event) => setForm({ ...form, itemName: event.target.value })} /></Field>
          <Field label="Category *"><input className="field" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></Field>
          <Field label="Specification"><input className="field" value={form.specification} onChange={(event) => setForm({ ...form, specification: event.target.value })} /></Field>
          <Field label="Supplier / Reference"><input className="field" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} /></Field>
          <Field label="Unit *"><select className="field" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
          <Field label="Quantity per Unit *"><input className="field" type="number" min="0" step="0.001" value={form.quantityPerUnit} onChange={(event) => setForm({ ...form, quantityPerUnit: Number(event.target.value) })} /></Field>
          <Field label="Unit Cost"><input className="field" type="number" min="0" step="0.01" value={form.unitCost ?? ''} onChange={(event) => setForm({ ...form, unitCost: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
          <Field label="Calculated Cost"><input className="field bg-slate-50 font-bold" readOnly value={calculated === null ? '-' : formatCurrency(calculated)} /></Field>
          <Field label="Reference Document">
            <div className="flex items-center gap-3">
              <label className={`secondary-button h-9 shrink-0 cursor-pointer gap-2 text-primary ${uploadingReference ? 'pointer-events-none opacity-60' : ''}`} htmlFor={uploadInputId}>
                <Upload size={15} />
                {uploadingReference ? 'Uploading...' : 'Upload'}
              </label>
              <input id={uploadInputId} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={uploadReferenceDocument} />
              {form.referenceDocument ? <span className="min-w-0 truncate text-sm font-semibold text-slate-600">{form.referenceDocument}</span> : null}
            </div>
          </Field>
          <Field label="Status"><select className="field" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BomStatus })}><option>Pending</option><option>Ordered</option><option>Procured</option></select></Field>
        </div>
        <div className="mt-5 flex justify-end gap-3"><button type="button" className="secondary-button h-11" onClick={onClose}>Cancel</button><button className="primary-button">{row ? 'Save Item' : 'Add Item'}</button></div>
      </form>
    </div>
  );
}

function DeleteDialog({ row, onCancel, onDelete }: { row: BomRow; onCancel: () => void; onDelete: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <h3 className="text-xl font-bold">Delete BOM Item?</h3>
        <p className="mt-2 text-slate-600">"{row.itemName}" will be removed from this BOM.</p>
        <div className="mt-5 flex justify-end gap-3"><button className="secondary-button h-11" onClick={onCancel}>Cancel</button><button className="primary-button bg-rose-600 hover:bg-rose-700" onClick={onDelete}>Delete</button></div>
      </section>
    </div>
  );
}

function FormulaBuilder({
  columns,
  draft,
  onApply,
  onChange,
  onClear
}: {
  columns: Array<{ value: string; label: string; formula?: string }>;
  draft: FormulaBuilderDraft;
  onApply: () => void;
  onChange: (draft: FormulaBuilderDraft) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex min-h-12 min-w-0 flex-wrap items-center gap-2 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2">
      <span className="mr-2 whitespace-nowrap text-sm font-extrabold text-slate-800">Formula Calculation</span>
      <select
        className="h-9 w-44 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary"
        value={draft.target}
        onChange={(event) => {
          const selected = columns.find((column) => column.value === event.target.value);
          onChange({ target: event.target.value, formula: selected?.formula || '' });
        }}
      >
        {columns.map((column) => (
          <option key={column.value} value={column.value}>{column.label}</option>
        ))}
      </select>
      <span className="text-sm font-black text-slate-500">=</span>
      <input
        className="h-9 min-w-56 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        placeholder="=Qty*Unit Cost"
        value={draft.formula}
        onChange={(event) => onChange({ ...draft, formula: event.target.value })}
      />
      <button className="h-9 rounded-md bg-primary px-5 text-sm font-bold text-white shadow-sm shadow-cyan-950/10" onClick={onApply}>Apply</button>
      <button className="h-9 rounded-md border border-cyan-800/30 bg-white px-5 text-sm font-bold text-cyan-900 hover:bg-cyan-50" onClick={onClear}>Clear</button>
    </div>
  );
}

function BomMetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-h-16 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-50 text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-black text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="grid min-h-80 place-items-center p-6 text-center"><div><PackagePlus className="mx-auto text-slate-400" size={58} /><h3 className="mt-4 text-xl font-bold">No BOM items added yet.</h3><p className="mt-2 max-w-xl text-slate-500">Start building the list of raw materials, components and packaging required to manufacture this product.</p><button className="primary-button mt-5" onClick={onAdd}><Plus size={18} />Add First Item</button></div></div>;
}

function ReferenceDocuments({
  rows,
  files,
  onDelete
}: {
  rows: BomRow[];
  files: ProjectAttachment[];
  onDelete: (file: ProjectAttachment) => void;
}) {
  const rowDocuments = referenceDocuments(rows);
  const rowDocumentNames = new Set(rowDocuments);
  const visibleFiles = files.filter((file, index, list) =>
    rowDocumentNames.has(file.name) && list.findIndex((candidate) => candidate.name === file.name) === index
  );
  const uploadedNames = new Set(visibleFiles.map((file) => file.name));
  const placeholderDocuments = rowDocuments.filter((document) => !uploadedNames.has(document));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Paperclip className="text-primary" size={22} />
          <h3 className="font-bold">Reference Documents</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{visibleFiles.length + placeholderDocuments.length} files</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {visibleFiles.map((file) => (
          <div key={file._id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-left transition hover:bg-slate-50">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-100 text-rose-600"><FileText size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{file.name}</p>
              <p className="text-xs text-slate-500">{formatBytes(file.fileSize || 0)} stored in Supabase</p>
            </div>
            <button className="text-primary disabled:cursor-not-allowed disabled:opacity-40" disabled={!resolveFileUrl(file)} title={resolveFileUrl(file) ? 'Open reference' : NO_FILE_AVAILABLE} onClick={() => openFile(file)}>
              <Download size={17} />
            </button>
            <button className="text-rose-600" title="Delete reference" onClick={() => onDelete(file)}>
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        {placeholderDocuments.map((document) => (
          <button key={document} className="flex cursor-not-allowed items-center gap-3 rounded-lg border border-dashed border-slate-200 p-3 text-left opacity-70" disabled title={NO_FILE_AVAILABLE}>
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-500"><FileText size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{document}</p>
              <p className="text-xs text-slate-500">No file available</p>
            </div>
            <Download className="text-primary" size={17} />
          </button>
        ))}
        {!visibleFiles.length && !placeholderDocuments.length ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
            No reference documents uploaded yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-bold text-slate-600">{label}</span>{children}</label>;
}

function SummaryCard({ icon, tone, label, value, note }: { icon: ReactNode; tone: 'blue' | 'green' | 'orange'; label: string; value: string; note: string }) {
  const toneClass = tone === 'green' ? 'bg-emerald-100 text-emerald-600' : tone === 'orange' ? 'bg-orange-100 text-orange-500' : 'bg-blue-100 text-primary';
  return <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-soft"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${toneClass}`}>{icon}</span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-0.5 whitespace-pre text-xl font-bold">{value}</p><p className="text-xs text-slate-500">{note}</p></div></div>;
}

function ProcurementStatusCard({ counts }: { counts: Record<BomStatus, number> }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-soft">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-orange-100 text-orange-500">
        <ShoppingCart size={28} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500">Procurement Status</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {(['Procured', 'Ordered', 'Pending'] as BomStatus[]).map((status) => (
            <div key={status} className="min-w-0">
              <p className="text-base font-bold leading-5 text-ink">{counts[status]}</p>
              <p className="truncate text-xs text-slate-500">{status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value, pill, icon }: { label: string; value: string; pill?: boolean; icon?: ReactNode }) {
  return <div className="border-slate-200 xl:border-l xl:pl-6 first:xl:border-l-0 first:xl:pl-0"><p className="text-xs text-slate-500">{label}</p><div className="mt-1.5 flex items-center gap-2 font-bold">{icon}{pill ? <span className="rounded-full bg-rose-100 px-4 py-1.5 text-rose-600">{value}</span> : <span>{value}</span>}</div></div>;
}

function CategoryBadge({ category }: { category: string }) {
  const className = category === 'Raw Material' ? 'bg-blue-100 text-primary' : category === 'Packaging' ? 'bg-orange-100 text-orange-600' : 'bg-violet-100 text-violet-600';
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${className}`}>{category}</span>;
}

function statusClass(status: BomStatus) {
  if (status === 'Procured') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Ordered') return 'bg-blue-100 text-primary';
  return 'bg-slate-100 text-slate-600';
}

function makeElectricalRow(
  item: string,
  specification: string,
  qty: string,
  unit: string,
  pricePerUnit: string,
  totalCost: string,
  referenceDesignator: string,
  supplierSource: string,
  pad: string,
  totalPad: string,
  solderingCost: string,
  totalSolderCost: string,
  finalCost: string,
  remarks = ''
): ElectricalBomRow {
  return {
    id: `electrical_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    item,
    specification,
    qty,
    unit,
    pricePerUnit,
    totalCost,
    referenceDesignator,
    supplierSource,
    pad,
    totalPad,
    solderingCost,
    totalSolderCost,
    finalCost,
    remarks,
    customCells: {}
  };
}

function makeMechanicalRow(
  srNo: string,
  partNumber: string,
  item: string,
  specification: string,
  material: string,
  qty: string,
  unit: string,
  drawing = '',
  unitCost = '',
  totalCost = '',
  supplier = '',
  remarks = ''
): MechanicalBomRow {
  return {
    id: `mechanical_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    srNo,
    partNumber,
    item,
    specification,
    material,
    qty,
    unit,
    drawing,
    unitCost,
    totalCost,
    supplier,
    remarks,
    customCells: {}
  };
}

function getElectricalSummary(
  rows: ElectricalBomRow[],
  columns: Array<BomColumnSetting<ElectricalBomColumnKey>>,
  customColumns: BomCustomColumn[],
  documentCount: number
) {
  return rows.reduce((summary, row, rowIndex) => {
    const context = makeElectricalFormulaContext(row, columns, customColumns, rowIndex);
    summary.totalCost += context.totalCost || context[normalizeFormulaName('Total Cost')] || 0;
    summary.padCost += context.totalPad || context[normalizeFormulaName('Total Pad')] || 0;
    summary.solderingCost += context.totalSolderCost || context[normalizeFormulaName('Total Solder Cost')] || 0;
    if (!row.supplierSource.trim()) summary.pendingSuppliers += 1;
    return summary;
  }, {
    totalItems: rows.length,
    totalCost: 0,
    padCost: 0,
    solderingCost: 0,
    pendingSuppliers: 0,
    documents: documentCount
  });
}

function getMechanicalSummary(
  rows: MechanicalBomRow[],
  columns: Array<BomColumnSetting<MechanicalBomColumnKey>>,
  customColumns: BomCustomColumn[],
  documentCount: number
) {
  const suppliers = new Set(rows.map((row) => row.supplier.trim()).filter(Boolean));
  return rows.reduce((summary, row, rowIndex) => {
    const context = makeMechanicalFormulaContext(row, columns, customColumns, rowIndex);
    summary.totalCost += context.totalCost || context[normalizeFormulaName('Total Cost')] || 0;
    if (row.drawing.trim()) summary.drawings += 1;
    return summary;
  }, {
    totalItems: rows.length,
    totalCost: 0,
    drawings: 0,
    suppliers: suppliers.size,
    customColumns: customColumns.length,
    documents: documentCount
  });
}

function withCustomCells<T extends { customCells?: Record<string, string> }>(row: T, columns: BomCustomColumn[]): T {
  return {
    ...row,
    customCells: columns.reduce<Record<string, string>>((cells, column) => {
      cells[column.id] = row.customCells?.[column.id] || '';
      return cells;
    }, { ...(row.customCells || {}) })
  };
}

function bomRowHasData(row: ElectricalBomRow | MechanicalBomRow) {
  return Object.entries(row).some(([key, value]) => {
    if (key === 'id') return false;
    if (key === 'customCells') return Object.values(value as Record<string, string>).some((cell) => cell.trim());
    return typeof value === 'string' && value.trim();
  });
}

function resolveBomFormula(rawValue: string, context: Record<string, number>): FormulaResult {
  if (!rawValue.startsWith('=')) return { value: rawValue, error: false };
  try {
    let expression = rawValue.slice(1);
    const entries = Object.entries(context).sort(([left], [right]) => right.length - left.length);
    entries.forEach(([label, value]) => {
      expression = expression.replace(new RegExp(escapeRegExp(label), 'gi'), String(value));
    });
    expression = expression.replace(/\b([A-Z]+)(\d+)\b/gi, (match) => String(context[match.toUpperCase()] ?? 0));
    if (!/^[\d+\-*/().\s]+$/.test(expression)) return { value: rawValue, error: true };
    const value = Function(`"use strict"; return (${expression});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) return { value: rawValue, error: true };
    return { value: formatBomNumber(value), error: false };
  } catch {
    return { value: rawValue, error: true };
  }
}

function makeElectricalFormulaContext(
  row: ElectricalBomRow,
  columns: Array<BomColumnSetting<ElectricalBomColumnKey>>,
  customColumns: BomCustomColumn[],
  rowIndex: number
) {
  const context: Record<string, number> = {};
  seedFormulaContext(context, row, columns, customColumns, rowIndex);
  columns.forEach((column, columnIndex) => {
    const rawValue = row[column.key] || column.formula || '';
    const numeric = getFormulaNumber(rawValue, context);
    addFormulaAliases(context, column.label, column.key, `${columnLetter(columnIndex)}${rowIndex + 1}`, numeric);
  });
  customColumns.forEach((column, customIndex) => {
    const value = row.customCells?.[column.id] || column.formula || '';
    const numeric = getFormulaNumber(value, context);
    addFormulaAliases(context, column.label, column.id, `${columnLetter(columns.length + customIndex)}${rowIndex + 1}`, numeric);
  });
  return context;
}

function makeMechanicalFormulaContext(
  row: MechanicalBomRow,
  columns: Array<BomColumnSetting<MechanicalBomColumnKey>>,
  customColumns: BomCustomColumn[],
  rowIndex: number
) {
  const context: Record<string, number> = {};
  seedFormulaContext(context, row, columns, customColumns, rowIndex);
  columns.forEach((column, columnIndex) => {
    const rawValue = row[column.key] || column.formula || '';
    const numeric = getFormulaNumber(rawValue, context);
    addFormulaAliases(context, column.label, column.key, `${columnLetter(columnIndex)}${rowIndex + 1}`, numeric);
  });
  customColumns.forEach((column, customIndex) => {
    const value = row.customCells?.[column.id] || column.formula || '';
    const numeric = getFormulaNumber(value, context);
    addFormulaAliases(context, column.label, column.id, `${columnLetter(columns.length + customIndex)}${rowIndex + 1}`, numeric);
  });
  return context;
}

function seedFormulaContext<Key extends ElectricalBomColumnKey | MechanicalBomColumnKey>(
  context: Record<string, number>,
  row: ElectricalBomRow | MechanicalBomRow,
  columns: Array<BomColumnSetting<Key>>,
  customColumns: BomCustomColumn[],
  rowIndex: number
) {
  columns.forEach((column, columnIndex) => {
    const rawValue = row[column.key as keyof typeof row];
    const numeric = typeof rawValue === 'string' && !rawValue.startsWith('=') ? parseBomNumber(rawValue) : 0;
    addFormulaAliases(context, column.label, column.key, `${columnLetter(columnIndex)}${rowIndex + 1}`, numeric);
  });
  customColumns.forEach((column, customIndex) => {
    const rawValue = row.customCells?.[column.id] || column.formula || '';
    const numeric = rawValue && !rawValue.startsWith('=') ? parseBomNumber(rawValue) : 0;
    addFormulaAliases(context, column.label, column.id, `${columnLetter(columns.length + customIndex)}${rowIndex + 1}`, numeric);
  });
}

function addFormulaAliases(context: Record<string, number>, label: string, key: string, cellReference: string, value: number) {
  context[label] = value;
  context[normalizeFormulaName(label)] = value;
  context[key] = value;
  context[normalizeFormulaName(key)] = value;
  context[cellReference] = value;
}

function makeFormulaBuilderOptions<Key extends string>(builtInColumns: Array<BomColumnSetting<Key>>, customColumns: BomCustomColumn[]) {
  return [
    ...builtInColumns.map((column) => ({ value: `builtin:${column.key}`, label: column.label, formula: column.formula })),
    ...customColumns.map((column) => ({ value: `custom:${column.id}`, label: column.label, formula: column.formula }))
  ];
}

function getElectricalFormulaDraft(
  columns: Array<BomColumnSetting<ElectricalBomColumnKey>>,
  customColumns: BomCustomColumn[],
  target: string
) {
  return getFormulaDraft(columns, customColumns, target);
}

function getMechanicalFormulaDraft(
  columns: Array<BomColumnSetting<MechanicalBomColumnKey>>,
  customColumns: BomCustomColumn[],
  target: string
) {
  return getFormulaDraft(columns, customColumns, target);
}

function getFormulaDraft<Key extends string>(
  columns: Array<BomColumnSetting<Key>>,
  customColumns: BomCustomColumn[],
  target: string
) {
  if (target.startsWith('builtin:')) {
    const key = target.slice('builtin:'.length);
    return columns.find((column) => column.key === key)?.formula || '';
  }
  if (target.startsWith('custom:')) {
    const id = target.slice('custom:'.length);
    return customColumns.find((column) => column.id === id)?.formula || '';
  }
  return '';
}

function normalizeFormulaInput(value: string) {
  const formula = value.trim();
  if (!formula) return '';
  return formula.startsWith('=') ? formula : `=${formula}`;
}

function getFormulaNumber(value: string, context: Record<string, number>) {
  if (!value.startsWith('=')) return parseBomNumber(value);
  const result = resolveBomFormula(value, context);
  return result.error ? 0 : parseBomNumber(result.value);
}

function parseBomNumber(value: string) {
  if (value.startsWith('=')) return 0;
  const parsed = Number(value.replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBomNumber(value: number) {
  if (!value) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}

function normalizeFormulaName(value: string) {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function columnLetter(index: number) {
  let letter = '';
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    current = Math.floor((current - 1) / 26);
  }
  return letter;
}

function seedBomRows(items: Array<{ id: string; materialName: string; vendor: string; quantity: number; cost: number; procurementStage: string }>): BomRow[] {
  const fallback: BomRow[] = [];
  if (!items.length) return fallback;
  return items.map((item, index) => ({ id: item.id, itemName: item.materialName, category: index % 3 === 0 ? 'Raw Material' : index % 3 === 1 ? 'Component' : 'Packaging', specification: index % 2 === 0 ? 'R&D specification' : 'Supplier specification', supplier: item.vendor, unit: 'pcs', quantityPerUnit: item.quantity, unitCost: item.cost, referenceDocument: index % 2 === 0 ? `${item.materialName.replace(/\s+/g, '_')}.pdf` : '', status: mapStatus(item.procurementStage) }));
}

function mapStatus(status: string): BomStatus {
  if (status === 'Procured' || status === 'Approved') return 'Procured';
  if (status === 'Ordered' || status === 'Quotation Received') return 'Ordered';
  return 'Pending';
}

function referenceDocuments(rows: BomRow[]) {
  return Array.from(new Set(rows.map((row) => row.referenceDocument).filter(Boolean)));
}

function tableHasData(table: BenchmarkingTableData) {
  return table.rows.some((row) => Object.values(row.cells).some((value) => value.trim()));
}

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

function makeSpreadsheetTable(name: string, values: string[][]): BenchmarkingTableData {
  const columnCount = Math.max(1, ...values.map((row) => row.length));
  const columns = Array.from({ length: columnCount }, () => ({ id: makeId('col') }));
  return {
    _id: makeId('table'),
    name,
    columns,
    rows: (values.length ? values : [['']]).map((row) => ({
      id: makeId('row'),
      cells: columns.reduce<Record<string, string>>((cells, column, columnIndex) => {
        cells[column.id] = row[columnIndex] || '';
        return cells;
      }, {})
    }))
  };
}

function isLegacyElectricalSample(rows: ElectricalBomRow[]) {
  const sampleItems = ['Buzzer', 'Connector 2Pin', 'Connector 3Pin', 'Connector 5Pin', 'Connector 6Pin', 'Connector 8Pin'];
  return rows.length === sampleItems.length && rows.every((row, index) => row.item === sampleItems[index]);
}

function isLegacyMechanicalSample(rows: MechanicalBomRow[]) {
  const sampleItems = ['AC PowerCord', 'Power Socket with Fuse', 'Earth Wire', 'PCB', 'Thermocouple', 'External Temperature', 'Probe Connector', 'Fiberglass Sleeve'];
  return rows.length === sampleItems.length && rows.every((row, index) => row.item === sampleItems[index]);
}

function mergeColumnSettings<Key extends string>(
  defaults: Array<BomColumnSetting<Key>>,
  saved: unknown
): Array<BomColumnSetting<Key>> {
  if (!Array.isArray(saved)) return defaults;
  return defaults.map((column) => {
    const matching = saved.find((candidate) => candidate && typeof candidate === 'object' && 'key' in candidate && candidate.key === column.key) as Partial<BomColumnSetting<Key>> | undefined;
    return {
      ...column,
      label: typeof matching?.label === 'string' && matching.label.trim() ? matching.label : column.label,
      formula: typeof matching?.formula === 'string' ? matching.formula : column.formula,
      width: typeof matching?.width === 'number' ? matching.width : column.width
    };
  });
}

function readBaseColumnWidths(saved: unknown): Record<BaseBomColumnKey, number> {
  const widths = { ...defaultBaseBomColumnWidths };
  if (!saved || typeof saved !== 'object') return widths;
  (Object.keys(widths) as BaseBomColumnKey[]).forEach((key) => {
    const value = (saved as Partial<Record<BaseBomColumnKey, unknown>>)[key];
    if (typeof value === 'number' && Number.isFinite(value)) widths[key] = Math.min(maxColumnWidth, Math.max(minColumnWidth, Math.round(value)));
  });
  return widths;
}

function readStoredBom(key: string, seedItems: Parameters<typeof seedBomRows>[0]) {
  const fallback = {
    rows: seedBomRows(seedItems),
    baseColumnWidths: defaultBaseBomColumnWidths,
    electricalRows: defaultElectricalRows,
    electricalColumnSettings: defaultElectricalColumnSettings,
    electricalCustomColumns: [] as BomCustomColumn[],
    mechanicalRows: defaultMechanicalRows,
    mechanicalColumnSettings: defaultMechanicalColumnSettings,
    mechanicalCustomColumns: [] as BomCustomColumn[],
    electricalTables: [] as BenchmarkingTableData[],
    mechanicalTables: [] as BenchmarkingTableData[],
    notes: defaultNotes,
    lastSaved: new Date().toISOString()
  };
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    const parsed = JSON.parse(saved) as Partial<typeof fallback>;
    const electricalRows = Array.isArray(parsed.electricalRows) ? parsed.electricalRows : fallback.electricalRows;
    const electricalColumnSettings = mergeColumnSettings(defaultElectricalColumnSettings, parsed.electricalColumnSettings);
    const electricalCustomColumns = Array.isArray(parsed.electricalCustomColumns) ? parsed.electricalCustomColumns : fallback.electricalCustomColumns;
    const mechanicalColumnSettings = mergeColumnSettings(defaultMechanicalColumnSettings, parsed.mechanicalColumnSettings);
    const mechanicalCustomColumns = Array.isArray(parsed.mechanicalCustomColumns) ? parsed.mechanicalCustomColumns : fallback.mechanicalCustomColumns;
    return {
      rows: Array.isArray(parsed.rows) ? parsed.rows : fallback.rows,
      baseColumnWidths: readBaseColumnWidths(parsed.baseColumnWidths),
      electricalRows: isLegacyElectricalSample(electricalRows) ? fallback.electricalRows : electricalRows.map((row) => withCustomCells(row, electricalCustomColumns)),
      electricalColumnSettings,
      electricalCustomColumns,
      mechanicalRows: Array.isArray(parsed.mechanicalRows) && !isLegacyMechanicalSample(parsed.mechanicalRows) ? parsed.mechanicalRows.map((row) => withCustomCells(row, mechanicalCustomColumns)) : fallback.mechanicalRows,
      mechanicalColumnSettings,
      mechanicalCustomColumns,
      electricalTables: Array.isArray(parsed.electricalTables) ? parsed.electricalTables : fallback.electricalTables,
      mechanicalTables: Array.isArray(parsed.mechanicalTables) ? parsed.mechanicalTables : fallback.mechanicalTables,
      notes: typeof parsed.notes === 'string' ? parsed.notes : fallback.notes,
      lastSaved: typeof parsed.lastSaved === 'string' ? parsed.lastSaved : fallback.lastSaved
    };
  } catch {
    return fallback;
  }
}

function parseCsv(csv: string): BomRow[] {
  const rows = parseCsvRows(csv);
  const [header = [], ...body] = rows;
  const normalizedHeader = header.map((cell) => cell.trim().toLowerCase());
  const value = (row: string[], names: string[]) => {
    const index = normalizedHeader.findIndex((candidate) => names.includes(candidate));
    return index >= 0 ? row[index]?.trim() || '' : '';
  };
  return body
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row, index) => {
      const quantity = Number(value(row, ['quantity per unit', 'quantity', 'qty', 'qty / unit'])) || 1;
      const unitCostRaw = value(row, ['unit cost', 'cost']);
      const status = normalizeStatus(value(row, ['status']));
      return {
        id: `import_${Date.now()}_${index}`,
        itemName: value(row, ['item name', 'item', 'name']) || `Imported Item ${index + 1}`,
        category: value(row, ['category']) || 'Raw Material',
        specification: value(row, ['specification', 'spec']),
        supplier: value(row, ['supplier / reference', 'supplier', 'reference']),
        unit: value(row, ['unit']) || 'pcs',
        quantityPerUnit: quantity,
        unitCost: unitCostRaw ? Number(unitCostRaw.replace(/[^0-9.]/g, '')) || null : null,
        referenceDocument: value(row, ['reference document', 'reference', 'document']),
        status
      };
    });
}

function parseCsvRows(csv: string) {
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
  return rows;
}

function normalizeStatus(value: string): BomStatus {
  const normalized = value.toLowerCase();
  if (normalized === 'procured' || normalized === 'approved') return 'Procured';
  if (normalized === 'ordered') return 'Ordered';
  return 'Pending';
}

function formatCurrency(value: number) {
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactRupees(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function formatBytes(value: number) {
  if (!value) return '0 KB';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function BeakerVisual() {
  return <svg aria-hidden="true" className="h-16 w-16" viewBox="0 0 120 120" fill="none"><path d="M32 21h56" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" fill="#f8fafc" /><path d="M39 24l6 72c.7 7 6.6 12 13.6 12h2.8c7 0 12.9-5 13.6-12l6-72" stroke="#334155" strokeWidth="2.5" strokeLinejoin="round" /><path d="M49 76h22M51 52h20M52 40h18" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" /><rect x="48" y="68" width="25" height="9" rx="2" fill="#dbeafe" /></svg>;
}
