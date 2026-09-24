export type CoreStageName =
  | 'Prerequisites'
  | 'Benchmarking'
  | 'Attachments'
  | 'BOM'
  | 'Product Design'
  | 'Programming'
  | 'Testing & Validation'
  | 'Final Stage';

export type StageName = CoreStageName | string;
export type ProjectStatus = 'Running' | 'On Hold' | 'Completed' | 'Delayed';
export type Priority = 'Low' | 'Medium' | 'High';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface Stage {
  id: string;
  name: StageName;
  slug: string;
  isCustom?: boolean;
  notes?: string;
  checklist?: { id: string; label: string; completed: boolean }[];
  status: 'Locked' | 'Pending' | 'In Progress' | 'Submitted' | 'Completed';
  progress: number;
}

export interface BomItem {
  id: string;
  materialName: string;
  vendor: string;
  quantity: number;
  cost: number;
  leadTimeDays: number;
  procurementStage: 'Called' | 'Quotation Received' | 'Approved' | 'Ordered' | 'Procured';
}

export interface DailyReport {
  id: string;
  date: string;
  workDone: string;
  hours: number;
  submittedBy: string;
  status: 'Submitted' | 'Approved' | 'Rejected';
}

export interface Project {
  id: string;
  name: string;
  productCode: string;
  category: string;
  description: string;
  startDate: string;
  targetDate: string;
  reportTo: string;
  teamMembers: TeamMember[];
  priority: Priority;
  status: ProjectStatus;
  currentStage: StageName;
  progress: number;
  stages: Stage[];
  bom: BomItem[];
  reports: DailyReport[];
}
