import { FileBadge, FileText, FlaskConical, LayoutDashboard, LogOut, Settings, Users, Warehouse } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout } from '../store';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FlaskConical },
  { label: 'Team Members', href: '/team', icon: Users },
  { label: 'Vendors', href: '/vendors', icon: Warehouse },
  { label: 'Certificates', href: '/certificates', icon: FileBadge },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings }
];

const brandImageUrl = '/omsonsnewlogo.jpeg';

export function AppLayout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const visibleNavItems = navItems.filter((item) => user?.role === 'admin' || item.href !== '/team');

  return (
    <div className="main-app-compact min-h-screen bg-[#f4f8ff] text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-[240px] flex-col border-r border-blue-50 bg-white/92 shadow-[18px_0_55px_rgba(30,64,175,0.08)] backdrop-blur lg:flex">
        <div className="flex h-[96px] items-center justify-center px-6">
          <img className="h-[74px] w-full max-w-[146px] object-contain" src={brandImageUrl} alt="Omsons Germany" />
        </div>
        <nav className="grid gap-2.5 px-3.5">
          {visibleNavItems.map((item) => (
            <NavLink key={item.label} to={item.href} className={({ isActive }) => `grid h-12 w-full grid-cols-[34px_minmax(0,1fr)] items-center rounded-lg px-4 text-left text-[15px] font-bold transition ${isActive ? 'bg-[#eaf2ff] text-[#00494B] shadow-sm' : 'text-[#333333] hover:bg-[#f3f7ff]'}`}>
              <span className="grid h-8 w-8 place-items-center">
                <item.icon size={21} strokeWidth={2.15} />
              </span>
              <span className="truncate pl-2.5">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-3.5 pb-5">
          <button
            className="grid h-12 w-full grid-cols-[34px_minmax(0,1fr)] items-center rounded-lg px-4 text-left text-[15px] font-bold text-[#333333] transition hover:bg-[#f3f7ff]"
            onClick={() => dispatch(logout())}
          >
            <span className="grid h-8 w-8 place-items-center">
              <LogOut size={21} strokeWidth={2.15} />
            </span>
            <span className="truncate pl-2.5">Logout</span>
          </button>
        </div>
      </aside>

      <main className="min-h-screen lg:pl-[240px]">
        <Outlet />
      </main>
    </div>
  );
}
