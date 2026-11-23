import { Router } from 'express';
import { completeInventoryAttachmentUpload, createInventory, createInventoryAttachmentUpload, deleteInventory, listInventory, updateInventory, uploadInventoryAttachment } from '../controllers/inventoryController.js';
import { authorize, protect } from '../middleware/authMiddleware.js';
import { attachmentUpload } from '../middleware/uploadMiddleware.js';

const router = Router();
router.route('/').get(protect, listInventory).post(protect, authorize('Admin', 'Staff'), createInventory);
router.patch('/:id', protect, authorize('Admin', 'Staff'), updateInventory);
router.delete('/:id', protect, authorize('Admin'), deleteInventory);
router.post('/:id/attachment', protect, authorize('Admin', 'Staff'), attachmentUpload.single('file'), uploadInventoryAttachment);
router.post('/:id/attachment/upload-url', protect, authorize('Admin', 'Staff'), createInventoryAttachmentUpload);
router.post('/:id/attachment/complete', protect, authorize('Admin', 'Staff'), completeInventoryAttachmentUpload);
export default router;
