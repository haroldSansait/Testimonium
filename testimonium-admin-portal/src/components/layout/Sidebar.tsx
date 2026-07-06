import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Calendar,
  Bell,
  BarChart2,
  User,
  LogOut,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import logoUrl from '@/assets/TESTIMONIUM_logo.png';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  { to: '/document-requests', label: 'Document Requests', icon: <FileText className="w-4 h-4" /> },
  { to: '/schedule-requests', label: 'Schedule Requests', icon: <CalendarDays className="w-4 h-4" /> },
  { to: '/calendar', label: 'Calendar', icon: <Calendar className="w-4 h-4" /> },
  { to: '/notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
  { to: '/activity-log', label: 'Reports / Activity Log', icon: <BarChart2 className="w-4 h-4" /> },
];

export function Sidebar() {
  const navigate = useNavigate();

  return (
    <aside className="sidebar flex flex-col">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <img src={logoUrl} alt="TESTIMONIUM Logo" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          <div>
            <span className="block text-white font-bold text-lg tracking-wide leading-none" style={{ fontFamily: 'Playfair Display, serif' }}>
              TESTIMONIUM
            </span>
            <span className="block text-white/60 text-xs mt-0.5">Parish Admin Portal</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 mx-4 mb-3" />

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-150 group',
                isActive
                  ? 'bg-white/15 text-white border-l-2 border-white pl-[10px]'
                  : 'text-white/65 hover:bg-white/10 hover:text-white border-l-2 border-transparent pl-[10px]'
              )
            }
            id={`nav-${item.to.replace('/', '')}`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto">
        <div className="h-px bg-white/10 mx-4 mb-3" />
        <div className="px-2 pb-6 space-y-0.5">
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 rounded-md hover:bg-white/10 hover:text-white transition-all duration-150 border-l-2 border-transparent pl-[10px]"
            id="nav-profile"
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span>Profile</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 rounded-md hover:bg-white/10 hover:text-white transition-all duration-150 border-l-2 border-transparent pl-[10px]"
            id="nav-logout"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
