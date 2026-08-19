import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Map,
  FileText,
  Search,
  Calendar,
  Bell,
  User as UserIcon,
  HelpCircle,
  Info,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
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
  onOpenHelp?: () => void;
  onOpenAbout?: () => void;
  isMobileDrawer?: boolean;
  onCloseMobileDrawer?: () => void;
}

export const ParishionerSidebar: React.FC<ParishionerSidebarProps> = ({
  onOpenHelp,
  onOpenAbout,
  isMobileDrawer = false,
  onCloseMobileDrawer,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();

  // Hover & Expansion State
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem('testimonium_pw_sidebar_pinned') === 'true';
    } catch {
      return false;
    }
  });

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (isMobileDrawer) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 80);
  };

  const handleMouseLeave = () => {
    if (isMobileDrawer) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const isExpanded = isMobileDrawer || isPinned || isHovered;

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
      const focusable = navRef.current?.querySelectorAll<HTMLElement>('a, button');
      if (!focusable || focusable.length === 0) return;
      const active = document.activeElement;
      const index = Array.from(focusable).indexOf(active as HTMLElement);

      let nextIndex = index;
      if (e.key === 'ArrowDown') {
        nextIndex = (index + 1) % focusable.length;
      } else {
        nextIndex = (index - 1 + focusable.length) % focusable.length;
      }
      focusable[nextIndex]?.focus();
    } else if (e.key === 'Escape') {
      if (!isPinned && !isMobileDrawer) {
        setIsHovered(false);
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
        {
          to: '/dashboard/profile',
          label: 'My Profile',
          icon: <UserIcon className="w-4 h-4" />,
        },
      ],
    },
  ];

  const sidebarContent = (
    <div
      className={`flex flex-col h-full bg-white text-text-primary select-none w-full`}
      onKeyDown={handleKeyDown}
      ref={navRef}
    >
      {/* Brand Header (Clean without artificial TX square) */}
      <div className="h-16 px-4 flex items-center flex-shrink-0 border-b border-border/40">
        {isExpanded ? (
          <div className="flex flex-col justify-center min-w-0 transition-opacity duration-200">
            <span className="font-serif font-black text-crimson text-lg tracking-wider leading-tight truncate">
              TESTIMONIUM
            </span>
            <span className="text-[10px] text-text-muted font-semibold tracking-wider uppercase truncate">
              Parishioner Portal
            </span>
          </div>
        ) : (
          <div className="w-full flex items-center justify-center">
            <span className="font-serif font-black text-crimson text-base tracking-widest">
              T
            </span>
          </div>
        )}
      </div>

      {/* Navigation Grouped by Categories */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto overflow-x-hidden" aria-label="Main Navigation">
        {categories.map((cat) => (
          <div key={cat.title} className="space-y-1">
            {isExpanded ? (
              <p className="text-[10px] font-bold text-text-muted/70 uppercase tracking-widest px-3 mb-1.5 transition-opacity duration-200">
                {cat.title}
              </p>
            ) : (
              <div className="h-1" />
            )}
            {cat.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                id={`nav-${item.to.replace('/dashboard/', '').replace('/', '')}`}
                onClick={handleNavClick}
                aria-current={location.pathname === item.to ? 'page' : undefined}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-all duration-150 group relative
                  ${isActive
                    ? 'bg-crimson text-white font-semibold shadow-xs'
                    : 'text-text-primary hover:bg-red-50/70 hover:text-crimson font-medium'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <span className={`flex-shrink-0 transition-colors ${isActive ? 'text-white' : 'text-crimson'}`}>
                      {item.icon}
                    </span>
                    <span
                      className={`transition-all duration-200 truncate ${
                        isExpanded
                          ? 'opacity-100 max-w-[170px] ml-0'
                          : 'opacity-0 max-w-0 ml-[-8px] pointer-events-none'
                      }`}
                    >
                      {item.label}
                    </span>

                    {/* Badge for Notifications */}
                    {item.badge !== undefined && (
                      <span
                        className={`ml-auto font-bold text-[10px] px-1.5 py-0.5 rounded-full transition-opacity duration-150 ${
                          isActive ? 'bg-white text-crimson' : 'bg-crimson text-white'
                        } ${
                          isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none hidden'
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
            ))}
          </div>
        ))}

        {/* Support Section */}
        <div className="space-y-1 pt-1 border-t border-border/40">
          {isExpanded ? (
            <p className="text-[10px] font-bold text-text-muted/70 uppercase tracking-widest px-3 mb-1.5">
              Support
            </p>
          ) : (
            <div className="h-1" />
          )}

          {onOpenHelp && (
            <button
              onClick={() => {
                handleNavClick();
                onOpenHelp();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-text-muted hover:text-crimson hover:bg-red-50/70 rounded-lg transition-colors text-left group relative"
              title="Help Center"
            >
              <HelpCircle className="w-4 h-4 flex-shrink-0 text-crimson" />
              <span
                className={`transition-all duration-200 truncate ${
                  isExpanded ? 'opacity-100 max-w-[170px]' : 'opacity-0 max-w-0 pointer-events-none'
                }`}
              >
                Help Center
              </span>
              {!isExpanded && !isMobileDrawer && (
                <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[9999]">
                  Help Center
                </div>
              )}
            </button>
          )}

          {onOpenAbout && (
            <button
              onClick={() => {
                handleNavClick();
                onOpenAbout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-text-muted hover:text-crimson hover:bg-red-50/70 rounded-lg transition-colors text-left group relative"
              title="About TESTIMONIUM"
            >
              <Info className="w-4 h-4 flex-shrink-0 text-crimson" />
              <span
                className={`transition-all duration-200 truncate ${
                  isExpanded ? 'opacity-100 max-w-[170px]' : 'opacity-0 max-w-0 pointer-events-none'
                }`}
              >
                About
              </span>
              {!isExpanded && !isMobileDrawer && (
                <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[9999]">
                  About TESTIMONIUM
                </div>
              )}
            </button>
          )}
        </div>
      </nav>

      {/* Bottom Section: User Profile & Pin/Collapse Control */}
      <div className="mt-auto flex-shrink-0 border-t border-border/50 pt-2">
        {/* User Card */}
        <div className="px-2.5 mb-2">
          {isExpanded ? (
            <div className="flex items-center justify-between p-2 bg-app-page/70 rounded-xl border border-border/70 shadow-xs transition-all duration-200">
              <Link
                to="/dashboard/profile"
                onClick={handleNavClick}
                className="flex items-center gap-2.5 min-w-0 hover:bg-white p-1 rounded-lg transition-colors flex-1 focus-ring"
                title="View Profile"
              >
                <Avatar
                  name={user?.displayName || user?.email || 'Parishioner'}
                  size="sm"
                />
                <div className="min-w-0 text-left">
                  <p className="text-xs font-bold text-text-primary truncate leading-tight">
                    {user?.displayName || 'Parishioner'}
                  </p>
                  <p className="text-[10px] text-text-muted truncate font-sans">
                    {user?.email || 'Authenticated'}
                  </p>
                </div>
              </Link>

              <button
                onClick={handleLogout}
                className="p-1.5 text-text-muted hover:text-crimson hover:bg-red-50 rounded-lg transition-colors focus-ring"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              to="/dashboard/profile"
              className="flex justify-center py-2 relative group focus-ring rounded-lg hover:bg-app-page transition-colors"
              title="View Profile"
              aria-label="View Profile"
            >
              <Avatar
                name={user?.displayName || user?.email || 'Parishioner'}
                size="sm"
              />
              <div className="absolute left-16 bg-gray-900 text-white text-xs px-2.5 py-1.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[9999]">
                Profile
              </div>
            </Link>
          )}
        </div>

        {/* Pin/Collapse Button (Desktop Only) */}
        {!isMobileDrawer && (
          <div className="px-2.5 pb-2.5">
            <button
              onClick={togglePin}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-app-page text-text-muted hover:text-text-primary transition-colors focus-ring"
              title={isPinned ? 'Collapse Sidebar' : 'Pin Sidebar'}
              aria-label={isPinned ? 'Collapse Sidebar' : 'Pin Sidebar'}
            >
              {isPinned ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {isExpanded && (
                <span className="text-xs font-medium ml-2">
                  {isPinned ? 'Collapse Sidebar' : 'Pin Sidebar'}
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // If used inside Mobile Drawer
  if (isMobileDrawer) {
    return sidebarContent;
  }

  // Desktop Persistent Sidebar Rail with Smooth Shadow and Expansion
  return (
    <aside
      className="hidden lg:block relative flex-shrink-0 select-none z-30 transition-[width] duration-300 ease-in-out"
      style={{ width: isPinned ? '280px' : '76px' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`h-screen sticky top-0 bg-white border-r border-border flex flex-col z-30 transition-[width,box-shadow] duration-300 ease-in-out ${
          !isPinned && isHovered
            ? 'absolute top-0 left-0 w-[280px] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.06),0_8px_10px_-6px_rgba(0,0,0,0.04)] z-40'
            : (isPinned ? 'w-[280px]' : 'w-[76px]')
        }`}
      >
        {sidebarContent}
      </div>
    </aside>
  );
};

export default ParishionerSidebar;
