import { FileBadge, FileText, FlaskConical, LayoutDashboard, Settings, Users, Warehouse } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FlaskConical },
  { label: 'Team Members', href: '/team', icon: Users },
  { label: 'Vendors', href: '/vendors', icon: Warehouse },
  { label: 'Certificates', href: '/certificates', icon: FileBadge },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings }
];

const brandImageUrl = 'https://res.cloudinary.com/dzrg0utcm/image/upload/v1784113445/ChatGPT_Image_Jul_15_2026_04_32_56_PM_koo8hz.png';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-[#f4f8ff] text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-[292px] border-r border-blue-50 bg-white/92 shadow-[18px_0_55px_rgba(30,64,175,0.08)] backdrop-blur lg:block">
        <div className="flex h-[108px] items-center justify-center px-7">
          <img className="h-20 w-full max-w-[150px] object-contain" src={brandImageUrl} alt="Omsons Germany" />
        </div>
        <nav className="space-y-3 px-[18px]">
          {navItems.map((item) => (
            <NavLink key={item.label} to={item.href} className={({ isActive }) => `flex h-12 w-full items-center gap-4 rounded-lg px-5 text-left text-[17px] font-semibold transition ${isActive ? 'bg-[#eaf2ff] text-[#0066ff] shadow-sm' : 'text-[#243b67] hover:bg-[#f3f7ff]'}`}>
              <item.icon size={21} strokeWidth={2.1} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-h-screen lg:pl-[292px]">
        <Outlet />
      </main>
    </div>
  );
}
