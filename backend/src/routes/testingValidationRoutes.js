import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { completeTestingValidation, getTestingValidation, saveTestingValidation } from '../controllers/testingValidationController.js';

const router = Router();
router.get('/:id/testing-validation', protect, authorize('Admin', 'Staff', 'Auditor'), getTestingValidation);
router.put('/:id/testing-validation', protect, authorize('Auditor'), saveTestingValidation);
router.post('/:id/testing-validation/complete', protect, authorize('Admin', 'Staff', 'Auditor'), completeTestingValidation);

export default router;
