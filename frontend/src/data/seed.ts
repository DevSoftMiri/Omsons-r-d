import type { Project, Stage, TeamMember } from '../types';

export const workflowStages: Stage['name'][] = [
  'Prerequisites',
  'Benchmarking',
  'Attachments',
  'BOM',
  'Product Design',
  'Programming',
  'Testing & Validation',
  'Final Stage'
];

export const teamMembers: TeamMember[] = [
  { id: 'u1', name: 'Ravi', role: 'Admin' },
  { id: 'u2', name: 'Ajay', role: 'Staff' },
  { id: 'u3', name: 'Rahul', role: 'Staff' },
  { id: 'u4', name: 'Shubham', role: 'Staff' }
];

export const initialProjects: Project[] = [];
