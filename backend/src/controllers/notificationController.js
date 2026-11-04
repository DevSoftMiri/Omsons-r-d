import asyncHandler from 'express-async-handler';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { ensureCertificateExpiryNotifications } from '../services/notificationService.js';

const preferenceKeys = ['projectAssignment', 'stageCompleted', 'stageChanged', 'projectDeadlineApproaching', 'projectOverdue', 'certificateExpiring', 'certificateExpired'];

export const listNotifications = asyncHandler(async (req, res) => {
  await ensureCertificateExpiryNotifications();
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const query = { user: req.user._id };
  if (req.query.unreadOnly === 'true') query.read = false;
  if (req.query.cursor) query.createdAt = { $lt: new Date(req.query.cursor) };
  const items = await Notification.find(query).sort({ createdAt: -1 }).limit(limit).populate('project', 'productCode name');
  res.json({ notifications: items, nextCursor: items.length === limit ? items[items.length - 1].createdAt : null });
});

export const unreadCount = asyncHandler(async (req, res) => {
  res.json({ count: await Notification.countDocuments({ user: req.user._id, read: false }) });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true });
  if (!notification) { res.status(404); throw new Error('Notification not found'); }
  res.json(notification);
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
  res.json({ message: 'Notifications marked as read' });
});

export const getNotificationPreferences = asyncHandler(async (req, res) => {
  res.json(req.user.notificationPreferences || Object.fromEntries(preferenceKeys.map((key) => [key, true])));
});

export const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const preferences = Object.fromEntries(preferenceKeys.map((key) => [key, req.body[key] !== false]));
  req.user.notificationPreferences = preferences;
  await req.user.save();
  res.json(preferences);
});
