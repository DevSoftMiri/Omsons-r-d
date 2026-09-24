import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { initialProjects, teamMembers, workflowStages } from './data/seed';
import type { Project, StageName } from './types';

interface ProjectsState {
  projects: Project[];
  selectedProjectId: string;
}

const initialState: ProjectsState = {
  projects: initialProjects,
  selectedProjectId: initialProjects[0].id
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    selectProject(state, action: PayloadAction<string>) {
      state.selectedProjectId = action.payload;
    },
    createProject(state, action: PayloadAction<Omit<Project, 'id' | 'productCode' | 'progress' | 'stages' | 'bom' | 'reports' | 'currentStage'>>) {
      const productCode = `GLW-${String(state.projects.length + 101).padStart(4, '0')}`;
      state.projects.unshift({
        ...action.payload,
        id: crypto.randomUUID(),
        productCode,
        reportTo: action.payload.reportTo || teamMembers[0].name,
        progress: 0,
        currentStage: 'Prerequisites',
        stages: workflowStages.map((name, index) => ({
          name,
          status: index === 0 ? 'Pending' : 'Locked',
          progress: 0
        })),
        bom: [],
        reports: []
      });
    },
    completeStage(state, action: PayloadAction<{ projectId: string; stage: StageName }>) {
      const project = state.projects.find((item) => item.id === action.payload.projectId);
      if (!project) return;
      const index = project.stages.findIndex((stage) => stage.name === action.payload.stage);
      project.stages[index].status = 'Completed';
      project.stages[index].progress = 100;
      const next = project.stages[index + 1];
      if (next && next.status === 'Locked') next.status = 'Pending';
      project.currentStage = project.stages.find((stage) => stage.status !== 'Completed')?.name ?? 'Final Stage';
      project.progress = Math.round(project.stages.reduce((sum, stage) => sum + stage.progress, 0) / project.stages.length);
      if (project.progress === 100) project.status = 'Completed';
    }
  }
});

export const { selectProject, createProject, completeStage } = projectsSlice.actions;

export const store = configureStore({
  reducer: {
    projects: projectsSlice.reducer
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
