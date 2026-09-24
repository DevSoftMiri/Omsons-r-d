import type { CoreStageName, Project, Stage, StageName } from '../types';

export const coreStageRoutes: Record<CoreStageName, string> = {
  Prerequisites: 'prerequisites',
  Benchmarking: 'benchmarking',
  Attachments: 'attachments',
  BOM: 'bom',
  'Product Design': 'product-design',
  Programming: 'programming',
  'Testing & Validation': 'testing-validation',
  'Final Stage': 'final-stage'
};

export function slugifyStageName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-stage';
}

export function makeStage(name: StageName, index: number, options: Partial<Stage> = {}): Stage {
  const isCore = Object.prototype.hasOwnProperty.call(coreStageRoutes, name);
  const slug = options.slug || (isCore ? coreStageRoutes[name as CoreStageName] : slugifyStageName(name));
  return {
    id: options.id || `${slug}-${index + 1}`,
    name,
    slug,
    isCustom: options.isCustom ?? !isCore,
    notes: options.notes || '',
    checklist: options.checklist || [],
    status: options.status || (index === 0 ? 'Pending' : 'Locked'),
    progress: options.progress || 0
  };
}

export function getStageRoute(stage: Stage | StageName, project?: Project) {
  const name = typeof stage === 'string' ? stage : stage.name;
  const knownRoute = coreStageRoutes[name as CoreStageName];
  if (knownRoute) return knownRoute;
  const match = typeof stage === 'string' ? project?.stages.find((item) => item.name === stage) : stage;
  return `custom-stage/${match?.slug || slugifyStageName(name)}`;
}

export function canCompleteStage(project: Project, stageName: StageName) {
  const index = project.stages.findIndex((stage) => stage.name === stageName);
  if (index < 0) return { ok: false, blockedBy: 'Unknown stage' };
  const blocker = project.stages.slice(0, index).find((stage) => stage.status !== 'Completed');
  return blocker ? { ok: false, blockedBy: blocker.name } : { ok: true, blockedBy: '' };
}
