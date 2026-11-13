import { Router } from 'express';
import { createVendor, deleteVendor, listVendors, updateVendor } from '../controllers/vendorController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.route('/').get(protect, listVendors).post(protect, authorize('Admin', 'Staff', 'Auditor'), createVendor);
router.route('/:id').patch(protect, authorize('Admin'), updateVendor);
router.route('/:id').delete(protect, authorize('Admin'), deleteVendor);

export default router;
