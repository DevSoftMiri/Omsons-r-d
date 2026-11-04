import { Bell, Check, Loader2, Plus, Search, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../hooks';
import { fetchNotifications, fetchUnreadNotificationCount, markAllNotificationsRead, markNotificationRead, type NotificationItem } from '../services/notificationService';

interface PageTopBarProps {
  title: string;
  subtitle: string;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function PageTopBar({ title, subtitle, searchValue, searchPlaceholder = 'Search...', onSearchChange, actionLabel, actionHref, onAction }: PageTopBarProps) {
  const user = useAppSelector((state) => state.auth.user);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const actionClass = 'inline-flex h-11 items-center gap-2 rounded-lg bg-[#00494B] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,73,75,0.18)] transition hover:bg-[#007D7D]';
  const actionContent = (
    <>
      <Plus size={20} />
      {actionLabel}
    </>
  );

  async function refreshNotifications() {
    if (!user || user.role === 'auditor') return;
    setLoadingNotifications(true);
    setNotificationError('');
    try {
      const [list, unread] = await Promise.all([fetchNotifications(), fetchUnreadNotificationCount()]);
      setNotifications(list.notifications);
      setUnreadCount(unread.count);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to load notifications');
    } finally {
      setLoadingNotifications(false);
    }
  }

  useEffect(() => {
    void refreshNotifications();
    const timer = window.setInterval(() => void refreshNotifications(), 30000);
    return () => window.clearInterval(timer);
  }, [user?.id, user?.role]);

  async function openNotification(notification: NotificationItem) {
    if (!notification.read) {
      await markNotificationRead(notification._id).catch(() => undefined);
      setNotifications((current) => current.map((item) => item._id === notification._id ? { ...item, read: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
  }

  async function readAll() {
    await markAllNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
  }

  function formatNotificationDate(value: string) {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  }

  return (
    <header className="mb-4 rounded-lg border-b border-[#333333] bg-[#333333] p-4 text-white">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold leading-none text-white">{title}</h1>
          <p className="mt-2 text-base font-medium leading-none text-white/80">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onSearchChange ? (
            <label className="flex h-11 w-full min-w-[260px] items-center gap-3 rounded-lg border border-[#d8e2f2] bg-white px-4 text-[#28406e] shadow-sm sm:w-[360px]">
              <Search size={20} />
              <input
                value={searchValue || ''}
                onChange={(event) => onSearchChange(event.target.value)}
                className="w-full border-0 bg-transparent text-sm font-medium outline-none placeholder:text-[#7282a1]"
                placeholder={searchPlaceholder}
              />
            </label>
          ) : null}
          <div className="relative">
            <button className="relative grid h-11 w-12 place-items-center rounded-lg border border-white/15 bg-white/10 text-white shadow-sm" title="Notifications" onClick={() => setNotificationsOpen((open) => !open)}>
              <Bell size={20} />
              {unreadCount ? <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-[#333333] bg-[#ff304b] px-1 text-[10px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
            </button>
            {notificationsOpen ? (
              <div className="absolute right-0 top-13 z-30 w-80 overflow-hidden rounded-lg border border-[#d8e2f2] bg-white text-sm shadow-[0_18px_45px_rgba(21,40,80,0.16)]">
                <div className="flex items-center justify-between border-b border-slate-100 p-4"><p className="font-bold text-[#333333]">Notifications</p>{unreadCount ? <button className="text-xs font-bold text-primary hover:underline" onClick={() => void readAll()}>Mark all read</button> : null}</div>
                {loadingNotifications ? <div className="flex items-center gap-2 p-4 text-[#53688d]"><Loader2 size={16} className="animate-spin" />Loading notifications...</div> : null}
                {notificationError ? <p className="p-4 text-rose-600">{notificationError}</p> : null}
                {!loadingNotifications && !notificationError && !notifications.length ? <p className="p-4 text-[#53688d]">No notifications yet.</p> : null}
                {!loadingNotifications && !notificationError ? <div className="max-h-96 overflow-y-auto">{notifications.map((notification) => {
                  const content = <div className={`border-b border-slate-100 p-3 text-left transition hover:bg-slate-50 ${notification.read ? '' : 'bg-blue-50/60'}`} onClick={() => void openNotification(notification)}><div className="flex gap-2"><div className="min-w-0 flex-1"><p className="font-bold text-[#333333]">{notification.title}</p><p className="mt-1 text-xs leading-5 text-[#53688d]">{notification.message}</p><p className="mt-1 text-[11px] font-semibold text-slate-400">{formatNotificationDate(notification.createdAt)}</p></div>{notification.read ? <Check size={15} className="shrink-0 text-emerald-600" /> : <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff304b]" />}</div></div>;
                  return notification.link ? <Link key={notification._id} to={notification.link} onClick={() => void openNotification(notification)}>{content}</Link> : <div key={notification._id}>{content}</div>;
                })}</div> : null}
              </div>
            ) : null}
          </div>
          <div className="flex h-11 items-center gap-3 rounded-lg bg-white/10 px-3 text-white shadow-sm">
            <div>
              <p className="text-sm font-bold leading-4 text-white">{user?.name || 'Admin'}</p>
              <p className="mt-0.5 text-xs font-semibold uppercase leading-4 text-white/75">{user?.role || 'ADMIN'}</p>
            </div>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white">
              <UserRound size={20} />
            </div>
          </div>
          {actionLabel && actionHref ? <Link to={actionHref} className={actionClass}>{actionContent}</Link> : null}
          {actionLabel && onAction ? <button className={actionClass} onClick={onAction}>{actionContent}</button> : null}
        </div>
      </div>
    </header>
  );
}
