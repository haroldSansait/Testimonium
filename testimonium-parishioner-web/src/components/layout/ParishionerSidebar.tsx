import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Map,
  FileText,
  Search,
  Calendar,
  Bell,
  LogOut,
  Pin,
  PinOff,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useProfileRequirement } from '../../hooks/useProfileRequirement';
import { Avatar } from '../ui/Avatar';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavCategory {
  title: string;
  items: NavItem[];
}

interface ParishionerSidebarProps {
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

export const ParishionerSidebar: React.FC<ParishionerSidebarProps> = ({
  isMobileDrawer = false,
  onCloseMobileDrawer,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { isProfileIncomplete, requireCompleteProfile } = useProfileRequirement();

  // Hover, Focus & Expansion State
  const [isHovered, setIsHovered] = useState(false);
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem('testimonium_pw_sidebar_pinned') === 'true';
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
      localStorage.setItem('testimonium_pw_sidebar_pinned', String(next));
    } catch (e) {
      console.warn('Unable to persist sidebar pinned state', e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const focusable = asideRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]):not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const visibleFocusable = Array.from(focusable).filter(
        el => !el.classList.contains('pointer-events-none') && el.offsetParent !== null
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

  const handleNavClick = () => {
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
  };

  const handleLogout = async () => {
    if (isMobileDrawer && onCloseMobileDrawer) {
      onCloseMobileDrawer();
    }
    navigate('/', { replace: true });
    await logout();
  };

  const categories: NavCategory[] = [
    {
      title: 'Portal',
      items: [
        {
          to: '/dashboard/home',
          label: 'Home',
          icon: <Home className="w-4 h-4" />,
        },
        {
          to: '/dashboard/parishes',
          label: 'Parish Directory',
          icon: <Map className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'Services',
      items: [
        {
          to: '/dashboard/request',
          label: 'Request Document',
          icon: <FileText className="w-4 h-4" />,
        },
        {
          to: '/dashboard/track',
          label: 'Track Status',
          icon: <Search className="w-4 h-4" />,
        },
        {
          to: '/dashboard/scheduler',
          label: 'Schedule Appointment',
          icon: <Calendar className="w-4 h-4" />,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        {
          to: '/dashboard/notifications',
          label: 'Notifications',
          icon: <Bell className="w-4 h-4" />,
          badge: unreadCount > 0 ? unreadCount : undefined,
        },
      ],
    },
  ];

  const sidebarContent = (
    <div
      className="flex flex-col h-full bg-white text-text-primary select-none w-full"
      onKeyDown={handleKeyDown}
    >
      {/* Brand Header */}
      <div className="h-16 px-3 flex items-center flex-shrink-0 border-b border-border/40 relative overflow-hidden">
        {/* Collapsed 'T' Logo - Smooth crossfade, centered in collapsed rail */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ease-in-out pointer-events-none ${
            isExpanded ? 'opacity-0 scale-90' : 'opacity-100 scale-100'
          }`}
          aria-hidden={isExpanded}
        >
          <span className="font-serif font-black text-crimson text-xl tracking-widest select-none">
            T
          </span>
        </div>

        {/* Expanded Header Content (Title, Subtitle & Pin Button) */}
        <div
          className={`flex items-center justify-between w-full min-w-0 transition-all duration-300 ease-in-out ${
            isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3 pointer-events-none'
          }`}
          aria-hidden={!isExpanded}
        >
          <div className="flex flex-col justify-center min-w-0 pl-1">
            <span className="font-serif font-black text-crimson text-lg tracking-wider leading-tight truncate">
              TESTIMONIUM
            </span>
            <span className="text-[10px] text-text-muted font-semibold tracking-wider uppercase truncate">
              Parishioner Portal
            </span>
          </div>

          {/* Desktop Pin / Unpin Button (Hidden in Mobile Drawer) */}
          {!isMobileDrawer && (
            <button
              type="button"
              onClick={togglePin}
              className={`p-1.5 rounded-lg transition-colors focus-ring shrink-0 ${
                isPinned
                  ? 'text-crimson bg-red-50/80 hover:bg-red-100/80'
                  : 'text-text-muted hover:text-crimson hover:bg-app-page'
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
            className="sr-only focus:not-sr-only focus:absolute focus:top-3.5 focus:right-2 p-1.5 rounded-lg bg-white border border-border text-crimson shadow-sm transition-colors focus-ring z-50"
            title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
            aria-label={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
            aria-pressed={isPinned}
          >
            {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Navigation Grouped by Categories */}
      <nav className="flex-1 px-2.5 py-3 space-y-2 overflow-y-auto overflow-x-hidden" aria-label="Main Navigation">
        {categories.map((cat) => (
          <div key={cat.title} className="space-y-1">
            {/* Category Header */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out px-3 flex items-center ${
                isExpanded ? 'h-5 opacity-100 mb-1' : 'h-1 opacity-0 pointer-events-none'
              }`}
              aria-hidden={!isExpanded}
            >
              <span className="text-[10px] font-bold text-text-muted/70 uppercase tracking-widest whitespace-nowrap">
                {cat.title}
              </span>
            </div>

            {cat.items.map((item) => {
              const isProtected = item.to === '/dashboard/request' || item.to === '/dashboard/scheduler';

              const handleItemClick = (e: React.MouseEvent) => {
                // Remove pointer focus immediately to avoid stuck expansion
                (e.currentTarget as HTMLElement)?.blur();
                setIsKeyboardFocused(false);

                if (isProtected && isProfileIncomplete) {
                  e.preventDefault();
                  handleNavClick();
                  requireCompleteProfile(
                    () => navigate(item.to),
                    item.to === '/dashboard/request' ? 'request certificates' : 'schedule appointments'
                  );
                } else {
                  handleNavClick();
                }
              };

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  id={`nav-${item.to.replace('/dashboard/', '').replace('/', '')}`}
                  onClick={handleItemClick}
                  aria-current={location.pathname === item.to ? 'page' : undefined}
                  className={({ isActive }) => `
                    relative flex items-center h-10 w-full rounded-lg transition-colors duration-200 group overflow-hidden
                    ${isActive
                      ? 'bg-crimson text-white font-semibold shadow-xs'
                      : 'text-text-primary hover:bg-red-50/70 hover:text-crimson font-medium'
                    }
                  `}
                >
                  {({ isActive }) => (
                    <>
                      {/* Nav Icon: Interpolates smoothly between centered (20px) and expanded (14px) */}
                      <span
                        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 transition-[left,color] duration-300 ease-in-out ${
                          isActive ? 'text-white' : 'text-crimson'
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

                      {/* Badge for Notifications */}
                      {item.badge !== undefined && (
                        <span
                          className={`ml-auto mr-3 font-bold text-[10px] px-1.5 py-0.5 rounded-full transition-all duration-300 ease-in-out ${
                            isActive ? 'bg-white text-crimson' : 'bg-crimson text-white'
                          } ${
                            isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {/* Collapsed Tooltip (Desktop Only) */}
                      {!isExpanded && !isMobileDrawer && (
                        <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none z-[9999]">
                          {item.label}
                          {item.badge !== undefined && ` (${item.badge})`}
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

      {/* Bottom Section: User Profile */}
      <div className="mt-auto flex-shrink-0 border-t border-border/50 pt-2 pb-2">
        <div className="px-2.5">
          <div
            className={`relative flex items-center h-12 rounded-xl transition-all duration-300 ease-in-out overflow-hidden ${
              isExpanded
                ? 'bg-app-page/70 border border-border/70 shadow-xs'
                : 'bg-transparent border border-transparent'
            }`}
          >
            {/* Avatar Container: smoothly transitions left position */}
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-300 ease-in-out flex items-center justify-center"
              style={{ left: isExpanded ? '10px' : '12px' }}
              title={!isExpanded ? (user?.displayName || user?.email || 'Parishioner') : undefined}
            >
              <Avatar
                name={user?.displayName || user?.email || 'Parishioner'}
                size="sm"
              />
            </div>

            {/* User Info */}
            <div
              className={`ml-[48px] min-w-0 pr-9 text-left transition-all duration-300 ease-in-out ${
                isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2 pointer-events-none'
              }`}
            >
              <p className="text-xs font-bold text-text-primary truncate leading-tight">
                {user?.displayName || 'Parishioner'}
              </p>
              <p className="text-[10px] text-text-muted truncate font-sans">
                {user?.email || 'Authenticated'}
              </p>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleLogout}
              className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-crimson hover:bg-red-50 rounded-lg transition-all duration-300 ease-in-out focus-ring ${
                isExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
              }`}
              title="Sign Out"
              aria-label="Sign Out"
              tabIndex={isExpanded ? 0 : -1}
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Tooltip for Avatar when collapsed */}
            {!isExpanded && !isMobileDrawer && (
              <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none z-[9999]">
                {user?.displayName || user?.email || 'Parishioner'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // If used inside Mobile Drawer
  if (isMobileDrawer) {
    return sidebarContent;
  }

  // Desktop Persistent Sidebar Rail with Automatic Main Content Reflow
  return (
    <aside
      ref={asideRef}
      className="hidden lg:block relative flex-shrink-0 select-none transition-[width] duration-300 ease-in-out border-r border-border bg-white z-30 h-screen sticky top-0"
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
  );
};

export default ParishionerSidebar;
