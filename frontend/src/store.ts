import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { initialProjects, teamMembers, workflowStages } from './data/seed';
import type { Project, StageName } from './types';
import { canCompleteStage, makeStage, slugifyStageName } from './utils/stages';

export type UserRole = 'admin' | 'staff';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

interface ProjectsState {
  projects: Project[];
  selectedProjectId: string | null;
}

const authStorageKey = 'omsons-rnd-auth-session';

interface StoredAuthSession {
  user: AuthUser;
  token: string;
}

function loadStoredSession(): StoredAuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const storedSession = window.localStorage.getItem(authStorageKey);
    if (!storedSession) return null;
    const parsedSession = JSON.parse(storedSession) as StoredAuthSession;
    if (!parsedSession.token || !parsedSession.user?.name || !parsedSession.user.email || !['admin', 'staff'].includes(parsedSession.user.role)) return null;
    return parsedSession;
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredAuthSession | null) {
  if (typeof window === 'undefined') return;
  if (session) {
    window.localStorage.setItem(authStorageKey, JSON.stringify(session));
    window.localStorage.setItem('token', session.token);
    return;
  }
  window.localStorage.removeItem(authStorageKey);
  window.localStorage.removeItem('omsons-rnd-auth-user');
  window.localStorage.removeItem('token');
}

const storedSession = loadStoredSession();

const initialState: ProjectsState = {
  projects: initialProjects,
  selectedProjectId: initialProjects[0]?.id ?? null
};

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: storedSession?.user ?? null, token: storedSession?.token ?? null } satisfies AuthState,
  reducers: {
    login(state, action: PayloadAction<StoredAuthSession>) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      saveStoredSession(action.payload);
    },
    logout(state) {
      state.user = null;
      state.token = null;
      saveStoredSession(null);
    }
  }
});

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    selectProject(state, action: PayloadAction<string>) {
      state.selectedProjectId = action.payload;
    },
    createProject(state, action: PayloadAction<Omit<Project, 'id' | 'productCode' | 'progress' | 'stages' | 'bom' | 'reports' | 'currentStage'> & { selectedStages?: StageName[]; customStages?: string[] }>) {
      const productCode = `GLW-${String(state.projects.length + 101).padStart(4, '0')}`;
      const { selectedStages: requestedStages, customStages: requestedCustomStages, ...projectValues } = action.payload;
      const defaultStages = workflowStages.filter((stage) => stage !== 'Final Stage');
      const baseStages = (requestedStages?.length ? requestedStages : defaultStages)
        .filter((stage, index, stages) => stage !== 'Final Stage' && stages.indexOf(stage) === index);
      const customStages = (requestedCustomStages || []).map((name) => name.trim()).filter(Boolean);
      const stageNames = [...baseStages, ...customStages, 'Final Stage'];
      const projectId = crypto.randomUUID();
      state.projects.unshift({
        ...projectValues,
        id: projectId,
        productCode,
        reportTo: projectValues.reportTo || teamMembers[0].name,
        progress: 0,
        currentStage: stageNames[0],
        stages: stageNames.map((name, index) => makeStage(name, index, { isCustom: customStages.includes(name) })),
        bom: [],
        reports: []
      });
      state.selectedProjectId = projectId;
    },
    completeStage(state, action: PayloadAction<{ projectId: string; stage: StageName }>) {
      const project = state.projects.find((item) => item.id === action.payload.projectId);
      if (!project) return;
      const index = project.stages.findIndex((stage) => stage.name === action.payload.stage);
      if (index < 0) return;
      if (!canCompleteStage(project, action.payload.stage).ok) return;
      project.stages[index].status = 'Completed';
      project.stages[index].progress = 100;
      const next = project.stages[index + 1];
      if (next && next.status === 'Locked') next.status = 'Pending';
      project.currentStage = project.stages.find((stage) => stage.status !== 'Completed')?.name ?? 'Final Stage';
      project.progress = Math.round(project.stages.reduce((sum, stage) => sum + stage.progress, 0) / project.stages.length);
      if (project.progress === 100) project.status = 'Completed';
    },
    addCustomStage(state, action: PayloadAction<{ projectId: string; name: string }>) {
      const project = state.projects.find((item) => item.id === action.payload.projectId);
      const name = action.payload.name.trim();
      if (!project || !name || project.stages.some((stage) => stage.name.toLowerCase() === name.toLowerCase())) return;
      const finalIndex = Math.max(project.stages.findIndex((stage) => stage.name === 'Final Stage'), project.stages.length);
      project.stages.splice(finalIndex, 0, makeStage(name, finalIndex, { id: crypto.randomUUID(), isCustom: true, status: 'Locked' }));
      refreshProjectWorkflow(project);
    },
    updateCustomStage(state, action: PayloadAction<{ projectId: string; stageId: string; name: string; notes?: string; checklist?: { id: string; label: string; completed: boolean }[] }>) {
      const project = state.projects.find((item) => item.id === action.payload.projectId);
      const stage = project?.stages.find((item) => item.id === action.payload.stageId && item.isCustom);
      const name = action.payload.name.trim();
      if (!project || !stage || !name) return;
      if (project.stages.some((item) => item.id !== stage.id && item.name.toLowerCase() === name.toLowerCase())) return;
      stage.name = name;
      stage.slug = slugifyStageName(name);
      stage.notes = action.payload.notes ?? stage.notes;
      stage.checklist = action.payload.checklist ?? stage.checklist;
      refreshProjectWorkflow(project);
    },
    deleteCustomStage(state, action: PayloadAction<{ projectId: string; stageId: string }>) {
      const project = state.projects.find((item) => item.id === action.payload.projectId);
      if (!project) return;
      project.stages = project.stages.filter((stage) => stage.id !== action.payload.stageId || !stage.isCustom);
      refreshProjectWorkflow(project);
    },
    moveCustomStage(state, action: PayloadAction<{ projectId: string; stageId: string; direction: 'up' | 'down' }>) {
      const project = state.projects.find((item) => item.id === action.payload.projectId);
      if (!project) return;
      const index = project.stages.findIndex((stage) => stage.id === action.payload.stageId && stage.isCustom);
      if (index < 0) return;
      const target = action.payload.direction === 'up' ? index - 1 : index + 1;
      if (target <= 0 || target >= project.stages.length - 1) return;
      const [stage] = project.stages.splice(index, 1);
      project.stages.splice(target, 0, stage);
      refreshProjectWorkflow(project);
    }
  }
});

function refreshProjectWorkflow(project: Project) {
  project.stages.forEach((stage, index) => {
    if (stage.status === 'Completed') {
      stage.progress = 100;
      return;
    }
    const previousComplete = index === 0 || project.stages.slice(0, index).every((candidate) => candidate.status === 'Completed');
    stage.status = previousComplete ? 'Pending' : 'Locked';
    stage.progress = 0;
  });
  project.currentStage = project.stages.find((stage) => stage.status !== 'Completed')?.name ?? 'Final Stage';
  project.progress = Math.round(project.stages.reduce((sum, stage) => sum + stage.progress, 0) / project.stages.length);
  if (project.progress < 100 && project.status === 'Completed') project.status = 'Running';
}

export const { login, logout } = authSlice.actions;
export const { selectProject, createProject, completeStage, addCustomStage, updateCustomStage, deleteCustomStage, moveCustomStage } = projectsSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    projects: projectsSlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
