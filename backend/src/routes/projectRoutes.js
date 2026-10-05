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
import { deleteAttachment, listAttachments, uploadAttachment } from '../controllers/attachmentController.js';
import { addProjectStage, addProjectTeamMember, createProject, getProject, listProjectTeamCandidates, listProjects, removeProjectTeamMember, reorderProjectStages, updateProjectReportTo, updateProjectStatus, updateStage } from '../controllers/projectController.js';
import {
  addPrerequisiteDocument,
  deletePrerequisiteDocument,
  deletePrerequisite,
  listPrerequisites,
  reviewPrerequisite,
  updatePrerequisiteDocument,
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
router.get('/:id/team-candidates', protect, listProjectTeamCandidates);
router.patch('/:id/team-members', protect, authorize('Admin'), addProjectTeamMember);
router.delete('/:id/team-members/:userId', protect, authorize('Admin'), removeProjectTeamMember);
router.patch('/:id/report-to', protect, authorize('Admin'), updateProjectReportTo);
router.post('/:id/stages', protect, authorize('Admin'), addProjectStage);
router.patch('/:id/stages/reorder', protect, authorize('Admin'), reorderProjectStages);
router.patch('/:id/status', protect, authorize('Admin'), updateProjectStatus);
router.get('/:id/attachments', protect, listAttachments);
router.post('/:id/attachments/upload', protect, prerequisiteUpload.single('file'), uploadAttachment);
router.delete('/:id/attachments/:attachmentId', protect, deleteAttachment);
router.get('/:id/prerequisites', protect, listPrerequisites);
router.post('/:id/prerequisites/documents', protect, authorize('Admin'), addPrerequisiteDocument);
router.patch('/:id/prerequisites/documents/:type', protect, authorize('Admin'), updatePrerequisiteDocument);
router.delete('/:id/prerequisites/documents/:type', protect, authorize('Admin'), deletePrerequisiteDocument);
router.post('/:id/prerequisites/:type/upload', protect, prerequisiteUpload.single('file'), uploadPrerequisite);
router.patch('/:id/prerequisites/:certificateId/review', protect, authorize('Admin'), reviewPrerequisite);
router.delete('/:id/prerequisites/:certificateId', protect, authorize('Admin'), deletePrerequisite);
router.get('/:id', protect, getProject);
router.patch('/:id/stages/:stage', protect, updateStage);

export default router;
