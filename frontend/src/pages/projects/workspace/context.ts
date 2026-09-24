import { createContext, useContext } from 'react';
import type { Project } from '../../../types';

export interface ProjectWorkspaceContextValue {
  project: Project;
}

export const ProjectWorkspaceContext = createContext<ProjectWorkspaceContextValue | null>(null);

export function useProjectWorkspace() {
  const context = useContext(ProjectWorkspaceContext);
  if (!context) throw new Error('Project workspace context is missing');
  return context;
}
