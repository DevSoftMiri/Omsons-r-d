import type { Project, Stage, StageName } from '../types';
import { makeStage } from '../utils/stages';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

interface ProjectCreatePayload {
  name: string;
  category: string;
  description: string;
  startDate: string;
  targetDate: string;
  reportTo?: string;
  teamMemberIds: string[];
  priority: Project['priority'];
  status: Project['status'];
  selectedStages: StageName[];
  customStages: string[];
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return response.json() as Promise<T>;
}

function isPastTargetDate(targetDate: string) {
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

function effectiveProjectStatus(status: Project['status'], targetDate: string): Project['status'] {
  if (status === 'Completed' || status === 'On Hold') return status;
  return isPastTargetDate(targetDate) ? 'Delayed' : status;
}

function normalizeProject(raw: any): Project {
  const rawProject = raw?.project || raw;
  const stages = Array.isArray(rawProject.stages) ? rawProject.stages : [];
  const normalizedStages: Stage[] = stages.map((stage: any, index: number) => makeStage(stage.name, index, {
    id: stage._id || `${rawProject._id || rawProject.id}-${index}`,
    status: stage.status,
    progress: stage.progress,
    checklist: Array.isArray(stage.checklist)
      ? stage.checklist.map((item: any, itemIndex: number) => ({
        id: item._id || `${index}-${itemIndex}`,
        label: item.label || '',
        completed: Boolean(item.completed ?? item.done)
      }))
      : []
  }));
  if (normalizedStages.some((stage) => stage.name === 'BOM') && !normalizedStages.some((stage) => stage.name === 'Electrical BOM')) {
    const bomIndex = normalizedStages.findIndex((stage) => stage.name === 'BOM');
    const previousStagesComplete = normalizedStages.slice(0, bomIndex + 1).every((stage) => stage.status === 'Completed');
    normalizedStages.splice(bomIndex + 1, 0, makeStage('Electrical BOM', bomIndex + 1, {
      id: `${rawProject._id || rawProject.id}-electrical-bom`,
      status: previousStagesComplete ? 'Pending' : 'Locked',
      progress: 0
    }));
  }
  if (normalizedStages.some((stage) => stage.name === 'Electrical BOM') && !normalizedStages.some((stage) => stage.name === 'Mechanical BOM')) {
    const electricalIndex = normalizedStages.findIndex((stage) => stage.name === 'Electrical BOM');
    const previousStagesComplete = normalizedStages.slice(0, electricalIndex + 1).every((stage) => stage.status === 'Completed');
    normalizedStages.splice(electricalIndex + 1, 0, makeStage('Mechanical BOM', electricalIndex + 1, {
      id: `${rawProject._id || rawProject.id}-mechanical-bom`,
      status: previousStagesComplete ? 'Pending' : 'Locked',
      progress: 0
    }));
  }
  if (!normalizedStages.some((stage) => stage.name === 'Final Stage')) {
    normalizedStages.push(makeStage('Final Stage', normalizedStages.length, {
      id: `${rawProject._id || rawProject.id}-final-stage`,
      status: normalizedStages.every((stage) => stage.status === 'Completed') ? 'Pending' : 'Locked',
      progress: 0
    }));
  }

  const targetDate = rawProject.targetDate?.slice?.(0, 10) || rawProject.targetDate;

  return {
    id: rawProject._id || rawProject.id,
    name: rawProject.name,
    productCode: rawProject.productCode,
    category: rawProject.category,
    description: rawProject.description || '',
    startDate: rawProject.startDate?.slice?.(0, 10) || rawProject.startDate,
    targetDate,
    reportTo: rawProject.reportTo?.name || rawProject.reportTo || '',
    reportToId: rawProject.reportTo?._id || rawProject.reportTo?.id || '',
    reportToEmail: rawProject.reportTo?.email || '',
    reportToDesignation: rawProject.reportTo?.designation || rawProject.reportTo?.role || '',
    teamMembers: Array.isArray(rawProject.teamMembers)
      ? rawProject.teamMembers.map((member: any) => ({
        id: member._id || member.id || member.name,
        name: member.name,
        role: member.role || 'Staff',
        email: member.email || '',
        designation: member.designation || member.role || 'Staff',
        isActive: member.isActive ?? true
      }))
      : [],
    priority: rawProject.priority,
    status: effectiveProjectStatus(rawProject.status, targetDate),
    currentStage: rawProject.currentStage || normalizedStages.find((stage) => stage.status !== 'Completed')?.name || 'Final Stage',
    progress: rawProject.overallProgress ?? Math.round(normalizedStages.reduce((sum, stage) => sum + stage.progress, 0) / Math.max(normalizedStages.length, 1)),
    stages: normalizedStages,
    bom: Array.isArray(raw.bom) ? raw.bom : [],
    reports: Array.isArray(rawProject.reports) ? rawProject.reports : []
  };
}

export async function fetchProjects() {
  const response = await fetch(`${API_BASE}/projects`, {
    headers: authHeaders()
  });
  const projects = await parseResponse<any[]>(response);
  return projects.map(normalizeProject);
}

export async function fetchProject(projectId: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    headers: authHeaders()
  });
  const project = await parseResponse<any>(response);
  return normalizeProject(project);
}

export async function createProject(payload: ProjectCreatePayload) {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({
      ...payload,
      stageNames: payload.selectedStages
    })
  });
  const project = await parseResponse<any>(response);
  return normalizeProject(project);
}

export async function updateProjectStage(projectId: string, stage: StageName, status: Stage['status'] = 'Completed') {
  const token = localStorage.getItem('token');
  if (!token) return null;

  const response = await fetch(`${API_BASE}/projects/${projectId}/stages/${encodeURIComponent(stage)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({ status })
  });
  const project = await parseResponse<any>(response);
  return normalizeProject(project);
}

export async function updateProjectStatus(projectId: string, status: Project['status']) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders()
    },
    body: JSON.stringify({ status })
  });
  const project = await parseResponse<any>(response);
  return normalizeProject(project);
}

export async function deleteProject(projectId: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return parseResponse<{ message: string; id: string; productCode: string }>(response);
}

export async function fetchProjectTeamCandidates(projectId: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/team-candidates`, { headers: authHeaders() });
  return parseResponse<Array<{ _id: string; name: string; role: 'Staff' | 'Admin'; designation?: string; email: string; isActive?: boolean }>>(response);
}

export async function addProjectTeamMember(projectId: string, userId: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/team-members`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ userId })
  });
  return normalizeProject(await parseResponse<any>(response));
}

export async function removeProjectTeamMember(projectId: string, userId: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/team-members/${userId}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  return normalizeProject(await parseResponse<any>(response));
}

export async function updateProjectReportTo(projectId: string, userId: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/report-to`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ userId })
  });
  return normalizeProject(await parseResponse<any>(response));
}

export async function addProjectStage(projectId: string, name: string) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/stages`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ name })
  });
  return normalizeProject(await parseResponse<any>(response));
}

export async function reorderProjectStages(projectId: string, stages: StageName[]) {
  const response = await fetch(`${API_BASE}/projects/${projectId}/stages/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ stages })
  });
  return normalizeProject(await parseResponse<any>(response));
}
