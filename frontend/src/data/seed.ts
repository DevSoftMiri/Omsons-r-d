import type { Project, Stage } from '../types';

export const workflowStages: Stage['name'][] = [
  'Prerequisites',
  'Benchmarking',
  'Attachments',
  'BOM',
  'Product Design',
  'Programming',
  'Reporting',
  'Testing & Validation',
  'Final Stage'
];

export const initialProjects: Project[] = [];
