import { Router } from 'express';
import { createReport, listReports, reviewReport } from '../controllers/reportController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.route('/').get(protect, listReports).post(protect, createReport);
router.patch('/:id/review', protect, authorize('Admin'), reviewReport);

export default router;
