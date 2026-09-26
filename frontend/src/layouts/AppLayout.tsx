import { Bell, FileBadge, FileText, FlaskConical, LayoutDashboard, LogOut, Settings, Users, Warehouse } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks';
import { logout } from '../store';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FlaskConical },
  { label: 'Team Members', href: '/team', icon: Users },
  { label: 'Vendors', href: '/vendors', icon: Warehouse },
  { label: 'Certificates', href: '/settings', icon: FileBadge },
  { label: 'Reports', href: '/settings', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings }
];

const brandImageUrl = 'https://res.cloudinary.com/dzrg0utcm/image/upload/v1784113445/ChatGPT_Image_Jul_15_2026_04_32_56_PM_koo8hz.png';

export function AppLayout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  return (
    <div className="min-h-screen bg-slate-100 text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-20 items-center justify-center px-6">
          <img className="h-14 w-full max-w-[190px] object-contain" src={brandImageUrl} alt="Omsons R&D" />
        </div>
        <nav className="space-y-1 px-4">
          {navItems.map((item) => (
            <NavLink key={item.label} to={item.href} className={({ isActive }) => `flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium ${isActive ? 'bg-mist text-primary' : 'text-slate-600 hover:bg-slate-100'}`}>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-5 backdrop-blur lg:px-8">
          <div>
            <h1 className="text-2xl font-bold">R&D Project Lifecycle</h1>
            <p className="text-sm text-slate-500">Glassware product development from concept to production readiness</p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-ink">{user.name}</p>
                <p className="text-xs font-semibold uppercase text-slate-500">{user.role}</p>
              </div>
            )}
            <button className="icon-button" title="Notifications">
              <Bell size={18} />
            </button>
            <button className="icon-button" title="Logout" onClick={() => dispatch(logout())}>
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
