import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Certificate } from '../models/Certificate.js';
import { Project } from '../models/Project.js';

const preferenceByType = {
  'project-assigned': 'projectAssignment',
  'project-removed': 'projectAssignment',
  'stage-changed': 'stageChanged',
  'stage-completed': 'stageCompleted',
  'project-status-changed': 'stageChanged',
  'certificate-reviewed': 'certificateExpiring',
  'certificate-expiring': 'certificateExpiring',
  'certificate-expired': 'certificateExpired'
};

export async function notifyProjectUsers({ project, actorId, type, title, message, link, dedupeKey }) {
  const projectUsers = [
    ...(project.teamMembers || []).map((user) => user?._id || user),
    project.reportTo?._id || project.reportTo
  ].filter(Boolean).map(String);
  const admins = await User.find({ role: 'Admin', isActive: { $ne: false } }).select('_id notificationPreferences');
  const recipientIds = [...new Set([...projectUsers, ...admins.map((user) => String(user._id))])]
    .filter((id) => String(id) !== String(actorId));
  if (!recipientIds.length) return [];

  const users = await User.find({ _id: { $in: recipientIds }, role: { $in: ['Admin', 'Staff'] }, isActive: { $ne: false } })
    .select('_id notificationPreferences');
  const preference = preferenceByType[type];
  const eligible = users.filter((user) => user.notificationPreferences?.[preference] !== false);
  if (!eligible.length) return [];
  const existing = dedupeKey ? await Notification.find({ dedupeKey, user: { $in: eligible.map((user) => user._id) } }).select('user') : [];
  const existingUsers = new Set(existing.map((item) => String(item.user)));
  const notifications = eligible.filter((user) => !existingUsers.has(String(user._id))).map((user) => ({
    user: user._id, actor: actorId, project: project._id, type, title, message, link, dedupeKey
  }));
  return notifications.length ? Notification.insertMany(notifications) : [];
}

export async function ensureCertificateExpiryNotifications() {
  const now = new Date();
  const reminderDate = new Date(now);
  reminderDate.setDate(reminderDate.getDate() + 30);
  const certificates = await Certificate.find({ expiryDate: { $lte: reminderDate } }).populate({ path: 'project', populate: [{ path: 'teamMembers', select: '_id' }, { path: 'reportTo', select: '_id' }] });
  await Promise.all(certificates.map(async (certificate) => {
    if (!certificate.project) return;
    const expired = new Date(certificate.expiryDate) < now;
    await notifyProjectUsers({
      project: certificate.project,
      type: expired ? 'certificate-expired' : 'certificate-expiring',
      title: expired ? 'Certificate expired' : 'Certificate expiring soon',
      message: `${certificate.type} for ${certificate.project.name} ${expired ? 'has expired' : 'expires soon'}.`,
      link: `/projects/${certificate.project.productCode}/prerequisites`,
      dedupeKey: `${expired ? 'expired' : 'expiring'}:${certificate._id}:${new Date(certificate.expiryDate).toISOString().slice(0, 10)}`
    });
  }));
}
