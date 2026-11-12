export interface ProductSpecificationRow {
  id: string;
  parameter: string;
  specification: string;
}

export interface ProductSpecificationsData {
  summary: string;
  rows: ProductSpecificationRow[];
  lastSaved: string;
}

export const defaultProductSpecificationRows: ProductSpecificationRow[] = [
  { id: 'capacity', parameter: 'Capacity', specification: '' },
  { id: 'power-consumption', parameter: 'Power Consumption', specification: '' },
  { id: 'temperature-range', parameter: 'Temperature Range', specification: '' },
  { id: 'temperature-accuracy', parameter: 'Temperature Accuracy', specification: '' },
  { id: 'temperature-uniformity', parameter: 'Temperature Uniformity', specification: '' },
  { id: 'control-type', parameter: 'Control Type', specification: '' },
  { id: 'display-type', parameter: 'Display Type', specification: '' },
  { id: 'setpoint-control-resolution', parameter: 'Setpoint / Control Resolution', specification: '' },
  { id: 'timer-range', parameter: 'Timer Range', specification: '' },
  { id: 'timer-resolution', parameter: 'Timer Resolution', specification: '' },
  { id: 'heating-element', parameter: 'Heating Element', specification: '' },
  { id: 'temperature-sensor', parameter: 'Temperature Sensor', specification: '' },
  { id: 'keypad-type', parameter: 'Keypad Type', specification: '' },
  { id: 'indicator-leds', parameter: 'Indicator LEDs', specification: '' },
  { id: 'alarm-system', parameter: 'Alarm System', specification: '' },
  { id: 'power-supply', parameter: 'Power Supply', specification: '' },
  { id: 'chamber-material', parameter: 'Chamber Material', specification: '' },
  { id: 'outer-body', parameter: 'Outer Body', specification: '' },
  { id: 'construction', parameter: 'Construction', specification: '' },
  { id: 'lid-type', parameter: 'Lid Type', specification: '' },
  { id: 'drain', parameter: 'Drain', specification: '' }
];

export function productSpecificationsStorageKey(projectCode: string) {
  return `product-specifications:${projectCode}`;
}

export function readProductSpecifications(projectCode: string): ProductSpecificationsData {
  return {
    summary: '',
    rows: defaultProductSpecificationRows,
    lastSaved: new Date().toISOString()
  };
}

export async function fetchProductSpecifications(projectCode: string) {
  const { fetchProjectModule } = await import('./projectModuleService');
  const result = await fetchProjectModule<ProductSpecificationsData>(projectCode, 'product-specifications');
  const fallback = readProductSpecifications(projectCode);
  return result.data ? {
    summary: result.data.summary || '',
    rows: normalizeRows(result.data.rows),
    lastSaved: result.updatedAt || fallback.lastSaved
  } : fallback;
}

export async function saveProductSpecifications(projectCode: string, data: Pick<ProductSpecificationsData, 'summary' | 'rows'>) {
  const payload: ProductSpecificationsData = {
    summary: data.summary,
    rows: normalizeRows(data.rows),
    lastSaved: new Date().toISOString()
  };
  const { updateProjectModule } = await import('./projectModuleService');
  const result = await updateProjectModule(projectCode, 'product-specifications', payload);
  return { ...payload, lastSaved: result.updatedAt };
}

function normalizeRows(rows: unknown): ProductSpecificationRow[] {
  if (!Array.isArray(rows) || !rows.length) return defaultProductSpecificationRows;
  const normalized = rows
    .map((row, index) => {
      const item = row as Partial<ProductSpecificationRow>;
      return {
        id: item.id || `spec-${index + 1}`,
        parameter: String(item.parameter || '').trim(),
        specification: String(item.specification || '').trim()
      };
    })
    .filter((row) => row.parameter || row.specification);
  return normalized.length ? normalized : defaultProductSpecificationRows;
}
