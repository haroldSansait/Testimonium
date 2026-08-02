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
  LogOut,
  Clock,
  Settings,
  Map,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';
import logoUrl from '@/assets/TESTIMONIUM_logo.png';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/permissions/rolePermissions';
import { PERMISSIONS, type Permission } from '@/permissions/permissions';
import { Avatar } from '@/components/ui/Avatar';

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

const CATEGORIES = [
  {
    title: 'Operations',
    itemKeys: ['/dashboard', '/calendar', '/notifications'],
  },
  {
    title: 'Requests',
    itemKeys: ['/document-requests', '/schedule-requests', '/mass-schedule'],
  },
  {
    title: 'Configuration',
    itemKeys: ['/availability', '/settings'],
  },
  {
    title: 'Diocese',
    itemKeys: ['/parish-management', '/user-management', '/map-configuration', '/activity-log', '/analytics'],
  },
];

// ─── Shared nav link class helper ─────────────────────────────────────────────

function navLinkClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-all duration-150 group relative',
    isActive
      ? 'bg-white/15 text-white border-l-2 border-white pl-[10px]'
      : 'text-white/65 hover:bg-white/10 hover:text-white border-l-2 border-transparent pl-[10px]'
  );
}

// ─── Confirm Navigation Modal ────────────────────────────────────────────────

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

function getInitials(name?: string | null) {
  if (!name) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Sidebar component ────────────────────────────────────────────────────────

export function Sidebar() {
  const navigate = useNavigate();
  const { role, logout, applicationUser } = useAuth();
  const [pendingNav, setPendingNav] = useState<{ path?: string; action?: () => void } | null>(null);

  // Hover & Expansion State
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    return localStorage.getItem('testimonium_sidebar_pinned') === 'true';
  });

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 150);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const isExpanded = isPinned || isHovered;

  // Keyboard navigation within Sidebar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const focusable = navRef.current?.querySelectorAll('a, button');
      if (!focusable) return;
      const active = document.activeElement;
      const index = Array.from(focusable).indexOf(active as Element);

      let nextIndex = index;
      if (e.key === 'ArrowDown') {
        nextIndex = (index + 1) % focusable.length;
      } else {
        nextIndex = (index - 1 + focusable.length) % focusable.length;
      }
      (focusable[nextIndex] as HTMLElement).focus();
    } else if (e.key === 'Escape') {
      if (!isPinned) {
        setIsHovered(false);
      }
    }
  };

  // Filter nav items to only those the current role has permission to see.
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    item.permission ? hasPermission(role, item.permission) : true
  );

  const categorizedItems = CATEGORIES.map((cat) => {
    return {
      title: cat.title,
      items: visibleNavItems.filter((item) => cat.itemKeys.includes(item.to)),
    };
  }).filter((cat) => cat.items.length > 0);

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
      <aside
        className="sidebar flex flex-col transition-all duration-300 ease-in-out select-none border-r border-white/5 relative z-20"
        style={{ width: isExpanded ? '280px' : '76px' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        ref={navRef}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <img
              src={logoUrl}
              alt="TESTIMONIUM Logo"
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
            <div className={cn("transition-opacity duration-200", isExpanded ? "opacity-100" : "opacity-0 hidden")}>
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

        {/* Navigation grouped by Categories */}
        <nav className="flex-1 px-2 py-2 space-y-4 overflow-y-auto">
          {categorizedItems.map((cat) => (
            <div key={cat.title} className="space-y-1">
              {isExpanded ? (
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-3 mb-1.5 transition-opacity duration-200">
                  {cat.title}
                </p>
              ) : (
                <div className="h-1" />
              )}
              {cat.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={navLinkClass}
                  id={`nav-${item.to.replace('/', '')}`}
                  onClick={(e) => confirmNavigation(e, item.to)}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span className={cn(
                    "transition-all duration-200 truncate",
                    isExpanded ? "opacity-100 max-w-[200px] ml-0" : "opacity-0 max-w-0 ml-[-8px] pointer-events-none"
                  )}>
                    {item.label}
                  </span>
                  {!isExpanded && (
                    <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[9999]">
                      {item.label}
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto">
          <div className="h-px bg-white/10 mx-4 mb-3" />

          {/* User profile card or avatar */}
          <div className="px-3 mb-2">
            {isExpanded ? (
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 shadow-sm transition-all duration-300">
                <div 
                  onClick={(e) => {
                    if (confirmNavigation(e, '/profile')) {
                      navigate('/profile');
                    }
                  }}
                  className="flex items-center gap-3 min-w-0 cursor-pointer hover:bg-white/10 p-1.5 rounded-lg transition-all duration-200"
                  title="View Profile"
                >
                  <Avatar initials={getInitials(applicationUser?.name || applicationUser?.email)} bgColor="#7B1C2A" size="sm" />
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold text-white truncate">{applicationUser?.name || 'User'}</p>
                    <p className="text-[10px] text-white/50 truncate font-semibold uppercase">{role?.replace('_', ' ') || 'Staff'}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    if (confirmNavigation(e, undefined, handleLogout)) {
                      void handleLogout();
                    }
                  }}
                  className="p-1.5 text-white/65 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div 
                className="flex justify-center py-2 relative group cursor-pointer" 
                onClick={(e) => {
                  if (confirmNavigation(e, '/profile')) {
                    navigate('/profile');
                  }
                }}
              >
                <Avatar initials={getInitials(applicationUser?.name || applicationUser?.email)} bgColor="#7B1C2A" size="sm" />
                <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[9999]">
                  Profile
                </div>
              </div>
            )}
          </div>

          {/* Pin toggle button */}
          <div className="px-3 pb-4">
            <button
              onClick={() => {
                const newVal = !isPinned;
                setIsPinned(newVal);
                localStorage.setItem('testimonium_sidebar_pinned', String(newVal));
              }}
              className="w-full flex items-center justify-center p-2 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title={isPinned ? "Collapse Sidebar" : "Pin Sidebar"}
            >
              {isPinned ? <ChevronLeft className="w-4.5 h-4.5" /> : <ChevronRight className="w-4.5 h-4.5" />}
              {isExpanded && <span className="text-xs font-medium ml-2">{isPinned ? "Collapse Sidebar" : "Pin Sidebar"}</span>}
            </button>
          </div>
        </div>
      </aside>

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
