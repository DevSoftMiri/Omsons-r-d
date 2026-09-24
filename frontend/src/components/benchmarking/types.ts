export type { BenchmarkingColumn, BenchmarkingRow, BenchmarkingTableData, BenchmarkingWorkbook } from '../../services/benchmarkingService';

export interface SelectedCell {
  tableId: string;
  rowId: string;
  columnId: string;
}
