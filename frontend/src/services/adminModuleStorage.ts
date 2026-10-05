import { workflowStages } from '../data/seed';
import type { StageName } from '../types';

export type CertificateStatus = 'Valid' | 'Expiring Soon' | 'Expired' | 'Pending';

export interface CertificateRecord {
  id: string;
  name: string;
  number: string;
  type: string;
  projectId: string;
  product: string;
  vendor: string;
  authority: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
  documentName: string;
  documentUrl?: string;
  fileUrl?: string;
  publicUrl?: string;
  createdAt: string;
}

export interface WorkflowSetting {
  id: string;
  name: StageName;
  description: string;
  active: boolean;
  required: boolean;
}

export interface AppSettings {
  general: {
    companyName: string;
    companyEmail: string;
    phone: string;
    country: string;
    timezone: string;
    dateFormat: string;
  };
  workflow: WorkflowSetting[];
  defaults: {
    status: string;
    priority: string;
    codeFormat: string;
    autoCode: boolean;
  };
  notifications: {
    projectAssignment: boolean;
    stageCompleted: boolean;
    stageChanged: boolean;
    projectDeadlineApproaching: boolean;
    projectOverdue: boolean;
    certificateExpiring: boolean;
    certificateExpired: boolean;
    deadlineReminderDays: number;
    certificateReminderDays: number;
  };
  documents: {
    maxUploadSize: number;
    allowedTypes: string[];
    allowDeletion: boolean;
    allowDownload: boolean;
    requireDescription: boolean;
  };
}

export interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  projectId: string;
  generatedBy: string;
  generatedAt: string;
  rows: Array<Record<string, string | number>>;
}

const certificatesKey = 'omsons-certificates';
const settingsKey = 'omsons-settings';
const reportsKey = 'omsons-generated-reports';

export const certificateTypes = [
  'Product Certificate',
  'Material Certificate',
  'Test Certificate',
  'Compliance Certificate',
  'Quality Certificate',
  'Vendor Certificate',
  'Other'
];

export function certificateStatus(expiryDate: string): CertificateStatus {
  if (!expiryDate) return 'Pending';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  if (Number.isNaN(expiry.getTime())) return 'Pending';
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring Soon';
  return 'Valid';
}

export function readCertificates(): CertificateRecord[] {
  return readJson<CertificateRecord[]>(certificatesKey, []);
}

export function saveCertificates(items: CertificateRecord[]) {
  writeJson(certificatesKey, items);
}

export function readReports(): GeneratedReport[] {
  return readJson<GeneratedReport[]>(reportsKey, []);
}

export function saveReports(items: GeneratedReport[]) {
  writeJson(reportsKey, items);
}

export function readSettings(): AppSettings {
  return readJson<AppSettings>(settingsKey, defaultSettings());
}

export function saveSettings(settings: AppSettings) {
  writeJson(settingsKey, settings);
}

export function readActiveWorkflowStages(): StageName[] {
  return readSettings().workflow
    .filter((stage) => stage.active && stage.name !== 'Overview' && stage.name !== 'Final Stage')
    .map((stage) => stage.name);
}

function defaultSettings(): AppSettings {
  return {
    general: {
      companyName: 'Omsons Germany',
      companyEmail: '',
      phone: '',
      country: 'India',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD MMM YYYY'
    },
    workflow: [
      { id: 'overview', name: 'Overview', description: 'Project summary and live status.', active: true, required: true },
      ...workflowStages.map((stage) => ({
        id: String(stage).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name: stage,
        description: `${stage} stage tasks and approvals.`,
        active: true,
        required: stage === 'Final Stage'
      }))
    ],
    defaults: {
      status: 'Running',
      priority: 'Medium',
      codeFormat: 'GLW-{NUMBER}',
      autoCode: true
    },
    notifications: {
      projectAssignment: true,
      stageCompleted: true,
      stageChanged: true,
      projectDeadlineApproaching: true,
      projectOverdue: true,
      certificateExpiring: true,
      certificateExpired: true,
      deadlineReminderDays: 7,
      certificateReminderDays: 30
    },
    documents: {
      maxUploadSize: 10,
      allowedTypes: ['PDF', 'DOC/DOCX', 'XLS/XLSX', 'JPG/JPEG', 'PNG'],
      allowDeletion: true,
      allowDownload: true,
      requireDescription: false
    }
  };
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}
