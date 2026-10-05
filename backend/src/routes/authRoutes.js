import { Router } from 'express';
import { createStaff, listStaff, login, me, register, resetStaffPassword, updateStaff } from '../controllers/authController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, me);
router.get('/staff', protect, authorize('Admin'), listStaff);
router.post('/staff', protect, authorize('Admin'), createStaff);
router.patch('/staff/:userId', protect, authorize('Admin'), updateStaff);
router.patch('/staff/:userId/password', protect, authorize('Admin'), resetStaffPassword);

export default router;
