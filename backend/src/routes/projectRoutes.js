import { Router } from 'express';
import {
  completeBenchmarking,
  createBenchmarkingTable,
  deleteBenchmarkingTable,
  exportBenchmarkingTable,
  getBenchmarking,
  importBenchmarkingTable,
  updateBenchmarkingTable
} from '../controllers/benchmarkingController.js';
import { createProject, getProject, listProjects, updateStage } from '../controllers/projectController.js';
import {
  deletePrerequisite,
  listPrerequisites,
  reviewPrerequisite,
  uploadPrerequisite
} from '../controllers/prerequisiteController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { prerequisiteUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

router.route('/').get(protect, listProjects).post(protect, authorize('Admin'), createProject);
router.get('/:id/benchmarking', protect, getBenchmarking);
router.post('/:id/benchmarking/tables', protect, createBenchmarkingTable);
router.patch('/:id/benchmarking/tables/:tableId', protect, updateBenchmarkingTable);
router.delete('/:id/benchmarking/tables/:tableId', protect, deleteBenchmarkingTable);
router.post('/:id/benchmarking/tables/:tableId/import', protect, importBenchmarkingTable);
router.get('/:id/benchmarking/tables/:tableId/export', protect, exportBenchmarkingTable);
router.patch('/:id/benchmarking/complete', protect, completeBenchmarking);
router.get('/:id/prerequisites', protect, listPrerequisites);
router.post('/:id/prerequisites/:type/upload', protect, prerequisiteUpload.single('file'), uploadPrerequisite);
router.patch('/:id/prerequisites/:certificateId/review', protect, authorize('Admin'), reviewPrerequisite);
router.delete('/:id/prerequisites/:certificateId', protect, authorize('Admin'), deletePrerequisite);
router.get('/:id', protect, getProject);
router.patch('/:id/stages/:stage', protect, updateStage);

export default router;
