import { NavLink, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Calendar,
  Bell,
  BarChart2,
  Church,
  Users,
  ClipboardList,
  User,
  LogOut,
  Clock,
  HelpCircle,
  Info,
  Settings,
  Map,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/utils/cn';
import logoUrl from '@/assets/TESTIMONIUM_logo.png';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/permissions/rolePermissions';
import { PERMISSIONS, type Permission } from '@/permissions/permissions';
import { HelpModal } from '@/components/modals/HelpModal';
import { AboutModal } from '@/components/modals/AboutModal';

// ─── Nav item definition ──────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Permission required to see this item. Omit = visible to all authenticated users. */
  permission?: Permission;
}

/** Ordered list of all possible nav items, each tagged with its required permission. */
const ALL_NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-4 h-4" />,
    permission: PERMISSIONS.VIEW_DASHBOARD,
  },
  {
    to: '/document-requests',
    label: 'Document Requests',
    icon: <FileText className="w-4 h-4" />,
    permission: PERMISSIONS.VIEW_DOCUMENT_REQUESTS,
  },
  {
    to: '/schedule-requests',
    label: 'Schedule Requests',
    icon: <CalendarDays className="w-4 h-4" />,
    permission: PERMISSIONS.VIEW_SCHEDULE_REQUESTS,
  },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: <Calendar className="w-4 h-4" />,
    permission: PERMISSIONS.VIEW_CALENDAR,
  },
  {
    to: '/notifications',
    label: 'Notifications',
    icon: <Bell className="w-4 h-4" />,
    permission: PERMISSIONS.VIEW_NOTIFICATIONS,
  },
  {
    to: '/mass-schedule',
    label: 'Mass Schedule',
    icon: <Clock className="w-4 h-4" />,
    permission: PERMISSIONS.MANAGE_MASS_SCHEDULE,
  },
  {
    to: '/availability',
    label: 'My Leave Settings',
    icon: <Calendar className="w-4 h-4" />,
    permission: PERMISSIONS.MANAGE_MY_AVAILABILITY,
  },
  {
    to: '/settings',
    label: 'Parish Settings',
    icon: <Settings className="w-4 h-4" />,
    permission: PERMISSIONS.MANAGE_PARISH_SETTINGS,
  },
  // ── Diocese Coordinator only ──
  {
    to: '/analytics',
    label: 'Analytics',
    icon: <BarChart2 className="w-4 h-4" />,
    permission: PERMISSIONS.VIEW_ANALYTICS,
  },
  {
    to: '/parish-management',
    label: 'Parish Management',
    icon: <Church className="w-4 h-4" />,
    permission: PERMISSIONS.MANAGE_PARISHES,
  },
  {
    to: '/map-configuration',
    label: 'Map Configuration',
    icon: <Map className="w-4 h-4" />,
    permission: PERMISSIONS.MANAGE_MAP_CONFIG,
  },
  {
    to: '/user-management',
    label: 'User Management',
    icon: <Users className="w-4 h-4" />,
    permission: PERMISSIONS.MANAGE_USERS,
  },
  {
    to: '/activity-log',
    label: 'Activity Log',
    icon: <ClipboardList className="w-4 h-4" />,
    permission: PERMISSIONS.VIEW_ACTIVITY_LOG,
  },
];

// ─── Shared nav link class helper ─────────────────────────────────────────────

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-150 group',
    isActive
      ? 'bg-white/15 text-white border-l-2 border-white pl-[10px]'
      : 'text-white/65 hover:bg-white/10 hover:text-white border-l-2 border-transparent pl-[10px]'
  );
}

// ─── Sidebar component ────────────────────────────────────────────────────────

function ConfirmNavigationModal({
  onConfirm,
  onClose
}: {
  onConfirm: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <h3
          className="text-base font-bold text-gray-900 mb-1"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Discard Changes?
        </h3>
        <p className="text-xs text-gray-500 mb-6 leading-relaxed">
          You have unsaved map configuration changes. Leaving this page will discard all edits permanently.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 active:scale-95 transition-all"
          >
            Discard & Leave
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const { role, logout } = useAuth();
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [pendingNav, setPendingNav] = useState<{ path?: string; action?: () => void } | null>(null);

  // Filter nav items to only those the current role has permission to see.
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    item.permission ? hasPermission(role, item.permission) : true
  );

  const confirmNavigation = (e: React.MouseEvent, path?: string, action?: () => void) => {
    if ((window as any).hasUnsavedMapChanges) {
      e.preventDefault();
      setPendingNav({ path, action });
      return false;
    }
    return true;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
    <aside className="sidebar flex flex-col">
      {/* Brand */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <img
            src={logoUrl}
            alt="TESTIMONIUM Logo"
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          />
          <div>
            <span
              className="block text-white font-bold text-lg tracking-wide leading-none"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              TESTIMONIUM
            </span>
            <span className="block text-white/60 text-xs mt-0.5">Parish Admin Portal</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10 mx-4 mb-3" />

      {/* Navigation — dynamically filtered by role */}
      <nav className="flex-1 px-2 py-2 space-y-0.5">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={navLinkClass}
            id={`nav-${item.to.replace('/', '')}`}
            onClick={(e) => confirmNavigation(e, item.to)}
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
            onClick={(e) => {
              if (confirmNavigation(e, '/profile')) {
                navigate('/profile');
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 rounded-md hover:bg-white/10 hover:text-white transition-all duration-150 border-l-2 border-transparent pl-[10px]"
            id="nav-profile"
          >
            <User className="w-4 h-4 flex-shrink-0" />
            <span>Profile</span>
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 rounded-md hover:bg-white/10 hover:text-white transition-all duration-150 border-l-2 border-transparent pl-[10px]"
            id="nav-help"
          >
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
            <span>Help</span>
          </button>
          <button
            onClick={() => setShowAbout(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 rounded-md hover:bg-white/10 hover:text-white transition-all duration-150 border-l-2 border-transparent pl-[10px]"
            id="nav-about"
          >
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>About</span>
          </button>
          <button
            onClick={(e) => {
              if (confirmNavigation(e, undefined, handleLogout)) {
                handleLogout();
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/65 rounded-md hover:bg-white/10 hover:text-white transition-all duration-150 border-l-2 border-transparent pl-[10px]"
            id="nav-logout"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>

    {/* Modals rendered outside aside to escape stacking context */}
    <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
    <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />

    {/* Navigation confirmation popup modal */}
    {pendingNav && (
      <ConfirmNavigationModal
        onConfirm={() => {
          (window as any).hasUnsavedMapChanges = false;
          const { path, action } = pendingNav;
          setPendingNav(null);
          if (action) {
            action();
          } else if (path) {
            navigate(path);
          }
        }}
        onClose={() => setPendingNav(null)}
      />
    )}
    </>
  );
}
