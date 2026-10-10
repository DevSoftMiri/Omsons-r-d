import type { BenchmarkingTableData } from './benchmarkingService';

export type StageResponseBlock =
  | StageTextBlock
  | StageChecklistBlock
  | StageTableBlock
  | StageFileBlock;

export interface StageResponseBase {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StageTextBlock extends StageResponseBase {
  type: 'text';
  value: string;
}

export interface StageChecklistBlock extends StageResponseBase {
  type: 'checklist';
  items: { id: string; label: string; completed: boolean }[];
}

export interface StageTableBlock extends StageResponseBase {
  type: 'table';
  table: BenchmarkingTableData;
}

export interface StageFileBlock extends StageResponseBase {
  type: 'file';
}

export function stageResponseStorageKey(projectCode: string, stageName: string) {
  return `stage-responses:${projectCode}:${stageName}`;
}

export function stageSectionOrderStorageKey(projectCode: string, stageName: string) {
  return `stage-section-order:${projectCode}:${stageName}`;
}

export function readStageSectionOrder(projectCode: string, stageName: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(stageSectionOrderStorageKey(projectCode, stageName));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function saveStageSectionOrder(projectCode: string, stageName: string, order: string[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(stageSectionOrderStorageKey(projectCode, stageName), JSON.stringify(order));
  }
  return order;
}

export function readStageResponses(projectCode: string, stageName: string): StageResponseBlock[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = window.localStorage.getItem(stageResponseStorageKey(projectCode, stageName));
    return saved ? normalizeBlocks(JSON.parse(saved)) : [];
  } catch {
    return [];
  }
}

export function saveStageResponses(projectCode: string, stageName: string, blocks: StageResponseBlock[]) {
  if (typeof window === 'undefined') return blocks;
  const normalized = normalizeBlocks(blocks);
  window.localStorage.setItem(stageResponseStorageKey(projectCode, stageName), JSON.stringify(normalized));
  return normalized;
}

export function makeStageResponseId(prefix: string) {
  return `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`}`;
}

export function makeStageResponseTable(name = 'New Table', columns = 3, rows = 4): BenchmarkingTableData {
  const now = new Date().toISOString();
  const tableColumns = Array.from({ length: columns }, (_, index) => ({
    id: makeStageResponseId('col'),
    label: `Column ${index + 1}`
  }));
  return {
    _id: makeStageResponseId('table'),
    name,
    columns: tableColumns,
    rows: Array.from({ length: rows }, () => ({
      id: makeStageResponseId('row'),
      cells: tableColumns.reduce<Record<string, string>>((cells, column) => {
        cells[column.id] = '';
        return cells;
      }, {})
    })),
    createdAt: now,
    updatedAt: now
  };
}

function normalizeBlocks(value: unknown): StageResponseBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((block) => normalizeBlock(block))
    .filter((block): block is StageResponseBlock => Boolean(block));
}

function normalizeBlock(value: unknown): StageResponseBlock | null {
  const block = value as Partial<StageResponseBlock>;
  if (!block || !block.type || !block.id) return null;
  const now = new Date().toISOString();
  const base = {
    id: String(block.id),
    title: String(block.title || defaultTitle(block.type)),
    createdAt: String(block.createdAt || now),
    updatedAt: String(block.updatedAt || now)
  };
  if (block.type === 'text') return { ...base, type: 'text', value: String((block as Partial<StageTextBlock>).value || '') };
  if (block.type === 'checklist') {
    const items = Array.isArray((block as Partial<StageChecklistBlock>).items) ? (block as Partial<StageChecklistBlock>).items! : [];
    return {
      ...base,
      type: 'checklist',
      items: items.map((item, index) => ({
        id: item.id || `${base.id}-item-${index + 1}`,
        label: String(item.label || ''),
        completed: Boolean(item.completed)
      }))
    };
  }
  if (block.type === 'table') return { ...base, type: 'table', table: normalizeTable((block as Partial<StageTableBlock>).table, base.title) };
  if (block.type === 'file') return { ...base, type: 'file' };
  return null;
}

function normalizeTable(table: Partial<BenchmarkingTableData> | undefined, fallbackName: string): BenchmarkingTableData {
  if (!table?.columns?.length || !table.rows?.length) return makeStageResponseTable(fallbackName);
  return {
    _id: table._id || makeStageResponseId('table'),
    name: table.name || fallbackName,
    columns: table.columns.map((column, index) => ({
      id: column.id || makeStageResponseId('col'),
      label: column.label || `Column ${index + 1}`,
      width: column.width
    })),
    rows: table.rows.map((row) => ({
      id: row.id || makeStageResponseId('row'),
      cells: { ...(row.cells || {}) }
    })),
    createdAt: table.createdAt,
    updatedAt: table.updatedAt
  };
}

function defaultTitle(type: StageResponseBlock['type']) {
  if (type === 'text') return 'Text Area';
  if (type === 'checklist') return 'Checklist';
  if (type === 'table') return 'Table';
  return 'Files';
}
