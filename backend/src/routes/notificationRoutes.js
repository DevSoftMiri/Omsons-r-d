import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { getNotificationPreferences, listNotifications, markAllNotificationsRead, markNotificationRead, unreadCount, updateNotificationPreferences } from '../controllers/notificationController.js';

const router = Router();
router.use(protect, authorize('Admin', 'Staff'));
router.get('/', listNotifications);
router.get('/unread-count', unreadCount);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.get('/preferences', getNotificationPreferences);
router.patch('/preferences', updateNotificationPreferences);

export default router;
