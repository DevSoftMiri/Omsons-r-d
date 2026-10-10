import { Router } from 'express';
import { createVendor, listVendors, updateVendor } from '../controllers/vendorController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.route('/').get(protect, listVendors).post(protect, authorize('Admin'), createVendor);
router.route('/:id').patch(protect, authorize('Admin'), updateVendor);

export default router;
