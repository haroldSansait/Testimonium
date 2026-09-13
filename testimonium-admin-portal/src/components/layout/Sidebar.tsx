import { NavLink, useNavigate } from 'react-router-dom';
import { ConfirmNavigationModal } from '@/components/modals/ConfirmNavigationModal';
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
  ChevronLeft,
  ChevronRight,
  Bot,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';
import logoUrl from '@/assets/TESTIMONIUM_logo.png';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/permissions/rolePermissions';
import { PERMISSIONS, type Permission } from '@/permissions/permissions';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';


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
    to: '/reports',
    label: 'Daily Reports',
    icon: <ClipboardList className="w-4 h-4" />,
    permission: PERMISSIONS.MANAGE_REPORTS,
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
  {
    to: '/caloy',
    label: 'Caloy',
    icon: <Bot className="w-4 h-4" />,
    permission: PERMISSIONS.VIEW_CALOY,
  },
];

const CATEGORIES = [
  {
    title: 'Operations',
    itemKeys: ['/dashboard', '/calendar', '/notifications'],
  },
  {
    title: 'Requests',
    itemKeys: ['/document-requests', '/schedule-requests', '/mass-schedule', '/reports'],
  },
  {
    title: 'Configuration',
    itemKeys: ['/availability', '/settings'],
  },
  {
    title: 'Diocese',
    itemKeys: ['/parish-management', '/user-management', '/map-configuration', '/caloy', '/activity-log', '/analytics'],
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

// ─── Confirm Navigation Modal imported from @/components/modals/ConfirmNavigationModal

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
    const hasUnsaved = (window as any).hasUnsavedMapChanges || (window as any).hasUnsavedSettingsChanges;
    if (hasUnsaved) {
      e.preventDefault();
      setPendingNav({ path, action });
      return false;
    }
    return true;
  };

  const handleLogout = async () => {
    (window as any).hasUnsavedMapChanges = false;
    (window as any).hasUnsavedSettingsChanges = false;
    await logout();
    navigate('/');
  };

  return (
    <>
      <aside
        className="sidebar flex flex-col transition-all duration-300 ease-in-out select-none border-r border-white/5 relative z-20 h-full"
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
        <nav className="flex-1 min-h-0 px-2 py-2 space-y-4 overflow-y-auto">
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
                  aria-label={item.label}
                  onClick={(e) => confirmNavigation(e, item.to)}
                >
                  <Tooltip
                    content={item.label}
                    side="right"
                    sideOffset={16}
                    disabled={isExpanded}
                  >
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span
                        className={cn(
                          "transition-all duration-200 truncate",
                          isExpanded ? "opacity-100 max-w-[200px] ml-0" : "opacity-0 max-w-0 ml-[-8px] pointer-events-none hidden"
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                  </Tooltip>
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
                >
                  <Avatar initials={getInitials(applicationUser?.name || applicationUser?.email)} bgColor="#7B1C2A" size="sm" />
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-bold text-white truncate">{applicationUser?.name || 'User'}</p>
                    <p className="text-[10px] text-white/50 truncate font-semibold uppercase">{role?.replace('_', ' ') || 'Staff'}</p>
                  </div>
                </div>
                <Tooltip content="Sign out of account" side="top">
                  <button
                    onClick={(e) => {
                      if (confirmNavigation(e, undefined, handleLogout)) {
                        void handleLogout();
                      }
                    }}
                    className="p-1.5 text-white/65 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Sign out of account"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </Tooltip>
              </div>
            ) : (
              <Tooltip content="View Profile" side="right" sideOffset={12}>
                <div
                  className="flex justify-center py-2 relative cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label="View Profile"

                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (confirmNavigation(e as any, '/profile')) {
                        navigate('/profile');
                      }
                    }
                  }}
                  onClick={(e) => {
                    if (confirmNavigation(e, '/profile')) {
                      navigate('/profile');
                    }
                  }}
                >
                  <Avatar initials={getInitials(applicationUser?.name || applicationUser?.email)} bgColor="#7B1C2A" size="sm" />
                </div>
              </Tooltip>
            )}
          </div>

          {/* Pin toggle button */}
          <div className="px-3 pb-4">
            <Tooltip
              content={isPinned ? "Collapse sidebar" : "Pin sidebar expanded"}
              side="right"
              sideOffset={12}
              disabled={isExpanded}
            >
              <button
                onClick={() => {
                  const newVal = !isPinned;
                  setIsPinned(newVal);
                  localStorage.setItem('testimonium_sidebar_pinned', String(newVal));
                }}
                className="w-full flex items-center justify-center p-2 rounded-md hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                aria-label={isPinned ? "Collapse sidebar" : "Pin sidebar expanded"}
              >
                {isPinned ? <ChevronLeft className="w-4.5 h-4.5" /> : <ChevronRight className="w-4.5 h-4.5" />}
                {isExpanded && <span className="text-xs font-medium ml-2">{isPinned ? "Collapse Sidebar" : "Pin Sidebar"}</span>}
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>


      {/* Navigation confirmation popup modal */}
      {pendingNav && (
        <ConfirmNavigationModal
          onConfirm={() => {
            (window as any).hasUnsavedMapChanges = false;
            (window as any).hasUnsavedSettingsChanges = false;
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
