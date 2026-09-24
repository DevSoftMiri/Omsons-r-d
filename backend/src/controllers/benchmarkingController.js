import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import { Benchmarking } from '../models/Benchmarking.js';
import { Project } from '../models/Project.js';
import { WORKFLOW_STAGES } from '../constants/workflow.js';

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
    table.rows.some((row) => [...row.cells.values()].some((value) => String(value || '').trim()))
  );
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

  const stageIndex = WORKFLOW_STAGES.indexOf('Benchmarking');
  project.stages[stageIndex] = {
    ...project.stages[stageIndex],
    name: 'Benchmarking',
    status: 'Completed',
    progress: 100,
    completedAt: new Date(),
    approvedBy: req.user?._id
  };
  project.currentStage = project.stages.find((stage) => stage.status !== 'Completed')?.name || 'Final Stage';

  await benchmarking.save();
  await project.save();
  res.json({ benchmarking, project });
});
