import { Bell, Plus, Search, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '../hooks';

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
  const actionClass = 'inline-flex h-11 items-center gap-2 rounded-lg bg-[#00494B] px-4 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,73,75,0.18)] transition hover:bg-[#007D7D]';
  const actionContent = (
    <>
      <Plus size={20} />
      {actionLabel}
    </>
  );

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
              <span className="absolute right-3 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#ff304b]" />
            </button>
            {notificationsOpen ? (
              <div className="absolute right-0 top-13 z-30 w-72 rounded-lg border border-[#d8e2f2] bg-white p-4 text-sm shadow-[0_18px_45px_rgba(21,40,80,0.16)]">
                <p className="font-bold text-[#333333]">Notifications</p>
                <p className="mt-2 text-[#53688d]">No notifications yet.</p>
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
