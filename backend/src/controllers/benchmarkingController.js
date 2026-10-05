import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Benchmarking } from '../models/Benchmarking.js';
import { Project } from '../models/Project.js';

function makeId(prefix) {
  return `${prefix}_${new mongoose.Types.ObjectId().toString()}`;
}

function makeColumns(count) {
  return Array.from({ length: count }, () => ({ id: makeId('col') }));
}

function makeRows(count, columns) {
  return Array.from({ length: count }, () => ({
    id: makeId('row'),
    cells: columns.reduce((cells, column) => {
      cells[column.id] = '';
      return cells;
    }, {})
  }));
}

async function findProject(identifier) {
  const query = mongoose.isValidObjectId(identifier) ? { _id: identifier } : { productCode: identifier };
  const project = await Project.findOne(query);
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  return project;
}

async function getOrCreateBenchmarking(projectId) {
  return Benchmarking.findOneAndUpdate(
    { project: projectId },
    { $setOnInsert: { project: projectId, tables: [], reviewStatus: 'draft' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

function hasMeaningfulData(benchmarking) {
  return benchmarking.tables.some((table) =>
    table.rows.some((row) => Object.values(row.cells instanceof Map ? Object.fromEntries(row.cells) : row.cells || {}).some((value) => String(value || '').trim()))
  );
}

function refreshStageLocks(project) {
  project.stages.forEach((stage, index) => {
    if (stage.status === 'Completed') {
      stage.progress = 100;
      return;
    }
    const previousComplete = index === 0 || project.stages.slice(0, index).every((candidate) => candidate.status === 'Completed');
    stage.status = previousComplete ? 'Pending' : 'Locked';
    stage.progress = 0;
  });
  project.currentStage = project.stages.find((stage) => stage.status !== 'Completed')?.name || 'Final Stage';
  if (project.stages.every((stage) => stage.status === 'Completed')) project.status = 'Completed';
}

function serializeCsv(table) {
  return table.rows
    .map((row) =>
      table.columns
        .map((column) => {
          const value = row.cells.get(column.id) || '';
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(',')
    )
    .join('\n');
}

function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.replace(/^"|"$/g, '').replace(/""/g, '"')));
}

export const getBenchmarking = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  res.json(await getOrCreateBenchmarking(project._id));
});

export const createBenchmarkingTable = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const benchmarking = await getOrCreateBenchmarking(project._id);
  const columnCount = Math.max(1, Math.min(Number(req.body.initialColumns) || 5, 50));
  const rowCount = Math.max(1, Math.min(Number(req.body.initialRows) || 5, 200));
  const columns = makeColumns(columnCount);

  benchmarking.tables.push({
    name: req.body.name || `Table ${benchmarking.tables.length + 1}`,
    columns,
    rows: makeRows(rowCount, columns)
  });

  await benchmarking.save();
  res.status(201).json(benchmarking);
});

export const updateBenchmarkingTable = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const benchmarking = await getOrCreateBenchmarking(project._id);
  const table = benchmarking.tables.id(req.params.tableId);

  if (!table) {
    res.status(404);
    throw new Error('Benchmarking table not found');
  }

  if (req.body.name !== undefined) table.name = req.body.name;
  if (req.body.columns !== undefined) table.columns = req.body.columns;
  if (req.body.rows !== undefined) table.rows = req.body.rows;
  table.updatedAt = new Date();
  benchmarking.reviewStatus = 'draft';
  benchmarking.completedAt = undefined;
  await benchmarking.save();
  res.json(benchmarking);
});

export const deleteBenchmarkingTable = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const benchmarking = await getOrCreateBenchmarking(project._id);
  const table = benchmarking.tables.id(req.params.tableId);

  if (!table) {
    res.status(404);
    throw new Error('Benchmarking table not found');
  }

  table.deleteOne();
  await benchmarking.save();
  res.status(204).end();
});

export const importBenchmarkingTable = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const benchmarking = await getOrCreateBenchmarking(project._id);
  const table = benchmarking.tables.id(req.params.tableId);

  if (!table) {
    res.status(404);
    throw new Error('Benchmarking table not found');
  }

  const matrix = parseCsv(req.body.csv || '');
  const columnCount = Math.max(...matrix.map((row) => row.length), 1);
  const columns = makeColumns(columnCount);
  table.columns = columns;
  table.rows = matrix.map((row) => ({
    id: makeId('row'),
    cells: columns.reduce((cells, column, index) => {
      cells[column.id] = row[index] || '';
      return cells;
    }, {})
  }));
  await benchmarking.save();
  res.json(benchmarking);
});

export const exportBenchmarkingTable = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const benchmarking = await getOrCreateBenchmarking(project._id);
  const table = benchmarking.tables.id(req.params.tableId);

  if (!table) {
    res.status(404);
    throw new Error('Benchmarking table not found');
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${project.productCode}-${table.name.replace(/\s+/g, '-')}.csv"`);
  res.send(serializeCsv(table));
});

export const completeBenchmarking = asyncHandler(async (req, res) => {
  const project = await findProject(req.params.id);
  const benchmarking = await getOrCreateBenchmarking(project._id);

  if (!benchmarking.tables.length || !hasMeaningfulData(benchmarking)) {
    res.status(409);
    throw new Error('At least one saved benchmarking table with data is required');
  }

  benchmarking.reviewStatus = 'completed';
  benchmarking.completedAt = new Date();

  const stageIndex = project.stages.findIndex((stage) => stage.name.toLowerCase() === 'benchmarking');
  if (stageIndex < 0) {
    res.status(404);
    throw new Error('Benchmarking stage is not configured for this project');
  }

  const previousComplete = stageIndex === 0 || project.stages.slice(0, stageIndex).every((stage) => stage.status === 'Completed');
  const canOverride = req.user?.role === 'Admin' && req.body?.adminOverride;
  if (!previousComplete && !canOverride) {
    res.status(409);
    throw new Error('Previous stage must be completed first');
  }

  project.stages[stageIndex].status = 'Completed';
  project.stages[stageIndex].progress = 100;
  project.stages[stageIndex].completedAt = new Date();
  project.stages[stageIndex].approvedBy = req.user?._id;
  refreshStageLocks(project);

  await benchmarking.save();
  await project.save();
  res.json({ benchmarking, project });
});
