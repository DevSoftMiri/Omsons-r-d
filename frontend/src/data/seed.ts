import type { Project, Stage } from '../types';

export const workflowStages: Stage['name'][] = [
  'Product Specifications',
  'Electrical Product Design',
  'Mechanical Product Design',
  'Programming',
  'Prototyping',
  'Testing & Validation',
  'PAT Test',
  'Electrical BOM',
  'Mechanical BOM',
  'Product Documents',
  'Research Data',
  'Benchmarking',
  'High Level BOM',
  'Final Stage'
];

export const initialProjects: Project[] = [];
