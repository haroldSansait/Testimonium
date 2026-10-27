import { NavLink, useNavigate, useLocation } from 'react-router-dom';
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
  Bot,
  Pin,
  PinOff,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import logoUrl from '@/assets/TESTIMONIUM_logo_alt.png';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/permissions/rolePermissions';
import { PERMISSIONS, type Permission } from '@/permissions/permissions';
import { Avatar } from '@/components/ui/Avatar';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';

// ─── Nav item definition ──────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Permission required to see this item. Omit = visible to all authenticated users. */
  permission?: Permission;
  badge?: number;
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

function getInitials(name?: string | null) {
  if (!name) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// ─── Sidebar component ────────────────────────────────────────────────────────

interface SidebarProps {
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

export function Sidebar({ isMobileDrawer = false, onCloseMobileDrawer }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, logout, applicationUser } = useAuth();
  const { documentRequestsCount, scheduleRequestsCount } = useNotificationCounts();
  const [pendingNav, setPendingNav] = useState<{ path?: string; action?: () => void } | null>(null);

  // Hover, Focus & Expansion State
  const [isHovered, setIsHovered] = useState(false);
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem('testimonium_sidebar_pinned') === 'true';
    } catch {
      return false;
    }
  });

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const isPointerInteractingRef = useRef(false);

  // Distinguish mouse/pointer interaction from keyboard focus
  useEffect(() => {
    const handlePointerDown = () => {
      isPointerInteractingRef.current = true;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key.startsWith('Arrow')) {
        isPointerInteractingRef.current = false;
      }
    };

    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  const handleMouseEnter = () => {
    if (isMobileDrawer) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 80);
  };

  const handleMouseLeave = () => {
    if (isMobileDrawer) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setIsKeyboardFocused(false);
      if (asideRef.current?.contains(document.activeElement) && isPointerInteractingRef.current) {
        (document.activeElement as HTMLElement)?.blur();
      }
    }, 120);
  };

  // On route change, collapse sidebar if pointer is not actively hovering
  useEffect(() => {
    if (!isPinned && !isMobileDrawer) {
      if (asideRef.current && !asideRef.current.matches(':hover')) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        setIsHovered(false);
        setIsKeyboardFocused(false);
      }
    }
  }, [location.pathname, isPinned, isMobileDrawer]);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleAsideFocus = (e: React.FocusEvent) => {
    const target = e.target as HTMLElement;
    const isFocusVisible = target.matches ? target.matches(':focus-visible') : !isPointerInteractingRef.current;
    if (!isPointerInteractingRef.current && isFocusVisible) {
      setIsKeyboardFocused(true);
    }
  };

  const handleAsideBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsKeyboardFocused(false);
    }
  };

  const isExpanded = isMobileDrawer || isPinned || isHovered || isKeyboardFocused;

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    try {
      localStorage.setItem('testimonium_sidebar_pinned', String(next));
    } catch (e) {
      console.warn('Unable to persist sidebar pinned state', e);
    }
  };

  // Keyboard navigation within Sidebar
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const focusable = asideRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]):not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const visibleFocusable = Array.from(focusable).filter(
        (el) => !el.classList.contains('pointer-events-none') && el.offsetParent !== null
      );
      const active = document.activeElement;
      const index = visibleFocusable.indexOf(active as HTMLElement);

      let nextIndex = index;
      if (e.key === 'ArrowDown') {
        nextIndex = (index + 1) % visibleFocusable.length;
      } else {
        nextIndex = (index - 1 + visibleFocusable.length) % visibleFocusable.length;
      }
      visibleFocusable[nextIndex]?.focus();
    } else if (e.key === 'Escape') {
      if (!isPinned && !isMobileDrawer) {
        setIsHovered(false);
        setIsKeyboardFocused(false);
        (document.activeElement as HTMLElement)?.blur();
      }
    }
  };

  // Filter nav items to only those the current role has permission to see.
  // Add badge counts strictly based on authorization.
  const visibleNavItems = ALL_NAV_ITEMS.filter((item) =>
    item.permission ? hasPermission(role, item.permission) : true
  ).map((item) => {
    let badge: number | undefined;
    if (
      item.to === '/document-requests' &&
      hasPermission(role, PERMISSIONS.VIEW_DOCUMENT_REQUESTS) &&
      documentRequestsCount > 0
    ) {
      badge = documentRequestsCount;
    } else if (
      item.to === '/schedule-requests' &&
      hasPermission(role, PERMISSIONS.VIEW_SCHEDULE_REQUESTS) &&
      scheduleRequestsCount > 0
    ) {
      badge = scheduleRequestsCount;
    }
    return { ...item, badge };
  });

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
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
    await logout();
    navigate('/');
  };

  const sidebarContent = (
    <div
      className="flex flex-col h-full text-white select-none w-full"
      onKeyDown={handleKeyDown}
    >
      {/* Brand Header */}
      <div className="h-16 px-3 flex items-center flex-shrink-0 border-b border-white/10 relative overflow-hidden">
        {/* Collapsed Logo - Smooth crossfade, centered in 76px rail */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out pointer-events-none ${
            isExpanded ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
          }`}
          aria-hidden={isExpanded}
        >
          <img
            src={logoUrl}
            alt="TESTIMONIUM Logo"
            className="w-10 h-10 object-contain"
          />
        </div>

        {/* Expanded Header Content (Logo, Title, Subtitle & Pin Button) */}
        <div
          className={`flex items-center justify-between w-full min-w-0 transition-all duration-300 ease-in-out px-1 ${
            isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 pointer-events-none'
          }`}
          aria-hidden={!isExpanded}
        >
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={logoUrl}
              alt="TESTIMONIUM Logo"
              className="w-10 h-10 object-contain flex-shrink-0"
            />
            <div className="flex flex-col justify-center min-w-0">
              <span
                className="font-bold text-white text-lg tracking-wide leading-tight truncate"
                style={{ fontFamily: 'Playfair Display, Georgia, serif' }}
              >
                TESTIMONIUM
              </span>
              <span className="text-[10px] text-white/60 font-semibold tracking-wider uppercase truncate">
                Parish Admin Portal
              </span>
            </div>
          </div>

          {/* Desktop Pin / Unpin Button (Hidden in Mobile Drawer) */}
          {!isMobileDrawer && (
            <button
              type="button"
              onClick={togglePin}
              className={`p-1.5 rounded-lg transition-colors shrink-0 text-white/65 hover:text-white hover:bg-white/10 ${
                isPinned ? 'text-white bg-white/15' : ''
              }`}
              title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
              aria-label={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
              aria-pressed={isPinned}
            >
              {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Keyboard Accessible Pin Button when collapsed (Desktop Only) */}
        {!isMobileDrawer && !isExpanded && (
          <button
            type="button"
            onClick={togglePin}
            className="sr-only focus:not-sr-only focus:absolute focus:top-3.5 focus:right-2 p-1.5 rounded-lg bg-white/20 text-white shadow-sm transition-colors z-50"
            title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
            aria-label={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
            aria-pressed={isPinned}
          >
            {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation grouped by Categories */}
      <nav
        className="flex-1 min-h-0 px-2.5 py-3 space-y-3 overflow-y-auto overflow-x-hidden"
        aria-label="Admin Navigation"
      >
        {categorizedItems.map((cat) => (
          <div key={cat.title} className="space-y-1">
            {/* Category Header */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out px-3 flex items-center ${
                isExpanded ? 'h-5 opacity-100 mb-1' : 'h-1 opacity-0 pointer-events-none'
              }`}
              aria-hidden={!isExpanded}
            >
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest whitespace-nowrap">
                {cat.title}
              </span>
            </div>

            {cat.items.map((item) => {
              const handleItemClick = (e: React.MouseEvent) => {
                if (!confirmNavigation(e, item.to)) {
                  return;
                }
                (e.currentTarget as HTMLElement)?.blur();
                setIsKeyboardFocused(false);
                if (isMobileDrawer && onCloseMobileDrawer) {
                  onCloseMobileDrawer();
                }
              };

              const hasBadge = item.badge !== undefined && item.badge > 0;
              const badgeDisplay = hasBadge ? (item.badge! > 99 ? '99+' : String(item.badge)) : '';

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  id={`nav-${item.to.replace('/', '')}`}
                  onClick={handleItemClick}
                  aria-label={
                    hasBadge
                      ? `${item.label}, ${badgeDisplay} unread`
                      : item.label
                  }
                  className={({ isActive }) => `
                    relative flex items-center h-10 w-full rounded-lg transition-colors duration-200 group overflow-hidden
                    ${
                      isActive
                        ? 'bg-white/15 text-white font-semibold shadow-xs border-l-2 border-white'
                        : 'text-white/65 hover:bg-white/10 hover:text-white font-medium border-l-2 border-transparent'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      {/* Nav Icon: Interpolates smoothly between centered (20px) and expanded (14px) */}
                      <span
                        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 transition-[left,color] duration-300 ease-in-out flex-shrink-0 ${
                          isActive ? 'text-white' : 'text-white/70'
                        }`}
                        style={{ left: isExpanded ? '14px' : '20px' }}
                      >
                        {item.icon}
                      </span>

                      {/* Nav Label: Smooth fade and slide */}
                      <span
                        className={`ml-[42px] font-medium text-sm whitespace-nowrap transition-all duration-300 ease-in-out ${
                          isExpanded
                            ? 'opacity-100 translate-x-0'
                            : 'opacity-0 -translate-x-2 pointer-events-none'
                        }`}
                      >
                        {item.label}
                      </span>

                      {/* Expanded Badge (Right Aligned) */}
                      {hasBadge && (
                        <span
                          className={`ml-auto mr-3 font-bold text-[10px] px-1.5 py-0.5 rounded-full transition-all duration-300 ease-in-out shrink-0 bg-[#E6B5BE] text-[#5B1220] shadow-xs ${
                            isExpanded
                              ? 'opacity-100 scale-100'
                              : 'opacity-0 scale-75 pointer-events-none hidden'
                          }`}
                          aria-label={`${item.label}, ${badgeDisplay} unread`}
                        >
                          {badgeDisplay}
                        </span>
                      )}

                      {/* Collapsed Badge (Positioned at Icon Top-Right, does not shift icon) */}
                      {hasBadge && (
                        <span
                          className={`absolute top-1.5 transition-all duration-300 ease-in-out pointer-events-none font-bold text-[9px] min-w-[14px] h-[14px] px-1 flex items-center justify-center rounded-full bg-[#E6B5BE] text-[#5B1220] shadow-xs ${
                            !isExpanded
                              ? 'opacity-100 scale-100'
                              : 'opacity-0 scale-75 pointer-events-none hidden'
                          }`}
                          style={{ left: '28px' }}
                          aria-hidden="true"
                        >
                          {badgeDisplay}
                        </span>
                      )}

                      {/* Collapsed Tooltip (Desktop Only) */}
                      {!isExpanded && !isMobileDrawer && (
                        <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none z-[9999]">
                          {item.label}
                          {hasBadge && ` (${badgeDisplay})`}
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom section: User profile card */}
      <div className="mt-auto flex-shrink-0 border-t border-white/10 pt-2 pb-2">
        <div className="px-2.5">
          <div
            className={`relative flex items-center h-12 rounded-xl transition-all duration-300 ease-in-out overflow-hidden ${
              isExpanded
                ? 'bg-white/5 border border-white/10 shadow-xs'
                : 'bg-transparent border border-transparent'
            }`}
          >
            {/* Avatar Container: smoothly transitions left position */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-300 ease-in-out flex items-center justify-center cursor-pointer"
              style={{ left: isExpanded ? '10px' : '12px' }}
              title={!isExpanded ? (applicationUser?.name || applicationUser?.email || 'User') : undefined}
              onClick={(e) => {
                if (confirmNavigation(e, '/profile')) {
                  navigate('/profile');
                  if (isMobileDrawer && onCloseMobileDrawer) {
                    onCloseMobileDrawer();
                  }
                }
              }}
            >
              <Avatar
                initials={getInitials(applicationUser?.name || applicationUser?.email)}
                bgColor="#7B1C2A"
                size="sm"
              />
            </div>

            {/* User Info */}
            <div
              onClick={(e) => {
                if (confirmNavigation(e, '/profile')) {
                  navigate('/profile');
                  if (isMobileDrawer && onCloseMobileDrawer) {
                    onCloseMobileDrawer();
                  }
                }
              }}
              className={`ml-[48px] min-w-0 pr-9 text-left cursor-pointer transition-all duration-300 ease-in-out ${
                isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
              }`}
            >
              <p className="text-xs font-bold text-white truncate leading-tight">
                {applicationUser?.name || 'User'}
              </p>
              <p className="text-[10px] text-white/50 truncate font-semibold uppercase">
                {role?.replace('_', ' ') || 'Staff'}
              </p>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={(e) => {
                if (confirmNavigation(e, undefined, handleLogout)) {
                  void handleLogout();
                }
              }}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-white/65 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-300 ease-in-out ${
                isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
              }`}
              title="Sign out of account"
              aria-label="Sign out of account"
              tabIndex={isExpanded ? 0 : -1}
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Tooltip for Avatar when collapsed */}
            {!isExpanded && !isMobileDrawer && (
              <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none z-[9999]">
                {applicationUser?.name || applicationUser?.email || 'User'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isMobileDrawer ? (
        <div
          ref={asideRef as React.RefObject<HTMLDivElement>}
          className="sidebar flex flex-col h-full select-none w-[280px] overflow-hidden"
        >
          {sidebarContent}
        </div>
      ) : (
        <aside
          ref={asideRef}
          className="sidebar flex flex-col transition-[width] duration-300 ease-in-out select-none border-r border-white/5 relative z-20 h-full flex-shrink-0"
          style={{ width: isExpanded ? '280px' : '76px' }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={handleAsideFocus}
          onBlur={handleAsideBlur}
        >
          <div className="h-full w-full flex flex-col overflow-hidden">
            {sidebarContent}
          </div>
        </aside>
      )}

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
              if (isMobileDrawer && onCloseMobileDrawer) {
                onCloseMobileDrawer();
              }
            }
          }}
          onClose={() => setPendingNav(null)}
        />
      )}
    </>
  );
}
