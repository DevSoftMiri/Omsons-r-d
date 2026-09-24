import { Router } from 'express';
import { createVendor, listVendors } from '../controllers/vendorController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.route('/').get(protect, listVendors).post(protect, authorize('Admin'), createVendor);

export default router;
