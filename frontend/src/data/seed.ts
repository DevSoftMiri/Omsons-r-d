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
  { id: 'u1', name: 'Aarav Mehta', role: 'Admin' },
  { id: 'u2', name: 'Riya Sharma', role: 'QA Engineer' },
  { id: 'u3', name: 'Kabir Singh', role: 'Design Engineer' },
  { id: 'u4', name: 'Meera Iyer', role: 'Programmer' }
];

const makeStages = (completeThrough: number, active: number): Stage[] =>
  workflowStages.map((name, index) => ({
    name,
    status: index < completeThrough ? 'Completed' : index === active ? 'In Progress' : index > active ? 'Locked' : 'Pending',
    progress: index < completeThrough ? 100 : index === active ? 65 : 0
  }));

export const initialProjects: Project[] = [
  {
    id: 'p1',
    name: 'Glass Beaker 250ml',
    productCode: 'GLW-250BK',
    category: 'Beaker',
    description: 'Borosilicate laboratory beaker with 250 ml capacity and durable graduation marking.',
    startDate: '2026-09-01',
    targetDate: '2026-10-15',
    reportTo: 'Aarav Mehta',
    teamMembers: [teamMembers[1], teamMembers[2], teamMembers[3]],
    priority: 'High',
    status: 'Running',
    currentStage: 'Product Design',
    progress: 45,
    stages: makeStages(4, 4),
    bom: [
      { id: 'b1', materialName: 'Borosilicate Tube', vendor: 'ABC Glass', quantity: 1, cost: 250, leadTimeDays: 7, procurementStage: 'Procured' },
      { id: 'b2', materialName: 'Graduation Ink', vendor: 'ChemMark', quantity: 2, cost: 90, leadTimeDays: 5, procurementStage: 'Ordered' }
    ],
    reports: [
      { id: 'r1', date: '2026-09-18', workDone: 'Completed calibration testing and updated graduation marking accuracy.', hours: 6, submittedBy: 'Riya Sharma', status: 'Approved' }
    ]
  },
  {
    id: 'p2',
    name: 'Volumetric Flask 500ml',
    productCode: 'GLW-500VF',
    category: 'Flask',
    description: 'Precision flask for volumetric analysis with narrow tolerance neck calibration.',
    startDate: '2026-08-20',
    targetDate: '2026-10-02',
    reportTo: 'Aarav Mehta',
    teamMembers: [teamMembers[1], teamMembers[2]],
    priority: 'Medium',
    status: 'On Hold',
    currentStage: 'BOM',
    progress: 30,
    stages: makeStages(3, 3),
    bom: [
      { id: 'b3', materialName: 'Glass Blank', vendor: 'BoroWorks', quantity: 1, cost: 340, leadTimeDays: 12, procurementStage: 'Quotation Received' }
    ],
    reports: []
  },
  {
    id: 'p3',
    name: 'Condenser Set',
    productCode: 'GLW-CND-12',
    category: 'Condenser',
    description: 'Interchangeable condenser assembly for teaching and process laboratories.',
    startDate: '2026-07-25',
    targetDate: '2026-09-28',
    reportTo: 'Aarav Mehta',
    teamMembers: [teamMembers[2], teamMembers[3]],
    priority: 'High',
    status: 'Running',
    currentStage: 'Programming',
    progress: 72,
    stages: makeStages(5, 5),
    bom: [
      { id: 'b4', materialName: 'Ground Joint', vendor: 'LabSeal', quantity: 4, cost: 125, leadTimeDays: 9, procurementStage: 'Approved' },
      { id: 'b5', materialName: 'Packaging Box', vendor: 'Packwell', quantity: 1, cost: 18, leadTimeDays: 3, procurementStage: 'Called' }
    ],
    reports: [
      { id: 'r2', date: '2026-09-19', workDone: 'Validated laser marking program on trial batch.', hours: 5, submittedBy: 'Meera Iyer', status: 'Submitted' }
    ]
  }
];
