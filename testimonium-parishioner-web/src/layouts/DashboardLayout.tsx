import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Bell,
  User as UserIcon,
  Menu,
  X,
  LogOut,
  ChevronDown,
  HelpCircle,
  Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Avatar } from '../components/ui/Avatar';
import { Dropdown } from '../components/ui/Dropdown';
import type { DropdownItem } from '../components/ui/Dropdown';
import { CaloyAssistant } from '../features/chat/components/CaloyAssistant';
import { Button } from '../components/ui/Button';
import { ParishionerSidebar } from '../components/layout/ParishionerSidebar';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [modalType, setModalType] = useState<'none' | 'help' | 'about'>('none');

  // Close drawer on route change
  useEffect(() => {
    setIsDrawerOpen(false);
  }, [location.pathname]);

  // ESC key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const userMenuItems: DropdownItem[] = [
    {
      label: 'My Profile',
      value: 'profile',
      icon: <UserIcon size={16} />,
      onClick: () => navigate('/dashboard/profile')
    },
    {
      label: 'Notifications',
      value: 'notifications',
      icon: <Bell size={16} />,
      onClick: () => navigate('/dashboard/notifications')
    },
    {
      label: 'Sign Out',
      value: 'logout',
      icon: <LogOut size={16} />,
      onClick: async () => {
        navigate('/', { replace: true });
        await logout();
      }
    },
  ];

  return (
    <div className="h-screen flex overflow-hidden bg-app-base text-text-primary relative">
      {/* Skip to main content for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[99999] focus:bg-white focus:text-crimson focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-crimson font-medium text-sm transition-all"
      >
        Skip to content
      </a>

      {/* Desktop Persistent Sidebar (≥1024px) */}
      <ParishionerSidebar
        onOpenHelp={() => navigate('/dashboard/help')}
        onOpenAbout={() => setModalType('about')}
      />

      {/* Main Content Viewport */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        {/* Top Application Bar */}
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8 z-20 flex-shrink-0 shadow-xs">
          <div className="flex items-center space-x-3">
            {/* Mobile Hamburger Trigger (<1024px) */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 rounded-button hover:bg-app-page text-text-muted hover:text-crimson transition-colors focus-ring lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={isDrawerOpen}
            >
              <Menu size={22} />
            </button>

            <div className="flex items-center space-x-2">
              <Link
                to="/dashboard/home"
                className="font-serif font-black tracking-wider text-crimson text-lg md:text-xl hover:opacity-85 focus-ring rounded px-1 transition-opacity lg:hidden"
                aria-label="TESTIMONIUM Home"
              >
                TESTIMONIUM
              </Link>
              <span className="hidden lg:inline-block font-serif font-bold text-crimson text-base tracking-wide">
                TESTIMONIUM
              </span>
            </div>

          </div>

          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Notifications Button */}
            <Link
              to="/dashboard/notifications"
              className="relative p-2 rounded-full hover:bg-app-page text-text-muted hover:text-crimson transition-colors focus-ring"
              aria-label={`${unreadCount} unread notifications`}
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-crimson text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Quick Help & About (Desktop) */}
            <button
              onClick={() => setModalType('help')}
              className="hidden sm:flex p-2 text-text-muted hover:text-text-primary hover:bg-app-page rounded-full transition-colors focus-ring"
              aria-label="Help Center"
              title="Help Center"
            >
              <HelpCircle size={19} />
            </button>

            {/* User Profile Avatar Dropdown */}
            <Dropdown
              trigger={
                <button
                  className="flex items-center space-x-2 p-1 rounded-full hover:bg-app-page transition-colors focus-ring"
                  aria-label="User account menu"
                >
                  <Avatar name={user?.displayName || user?.email || 'User'} size="sm" />
                  <ChevronDown size={14} className="text-text-muted hidden sm:inline" />
                </button>
              }
              items={userMenuItems}
              align="right"
            />
          </div>
        </header>

        {/* Scrollable Main Canvas */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto bg-app-base focus:outline-none"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Drawer Navigation (<1024px) */}
      <div
        className={`fixed inset-0 z-[9999] lg:hidden flex ${isDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile Navigation"
      >
        {/* Backdrop Overlay */}
        <div
          className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
            isDrawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsDrawerOpen(false)}
          aria-hidden="true"
        />

        {/* Sliding Panel */}
        <aside
          className={`relative w-72 max-w-[80vw] bg-white text-text-primary h-full flex flex-col z-10 shadow-2xl border-r border-border transition-transform duration-300 ease-in-out transform ${
            isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Close button at top right */}
          <div className="absolute top-4 right-4 z-20">
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1.5 rounded-full hover:bg-app-page text-text-muted hover:text-text-primary transition-colors focus-ring"
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>


          <ParishionerSidebar
            isMobileDrawer={true}
            onCloseMobileDrawer={() => setIsDrawerOpen(false)}
            onOpenHelp={() => {
              setIsDrawerOpen(false);
              navigate('/dashboard/help');
            }}
            onOpenAbout={() => {
              setIsDrawerOpen(false);
              setModalType('about');
            }}
          />
        </aside>
      </div>

      {/* Floating Caloy AI Assistant Drawer */}
      <CaloyAssistant />

      {/* Help / About Modals */}
      {modalType !== 'none' && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setModalType('none')}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-dialog-title"
        >
          <div
            className="bg-white rounded-card shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4 text-left border border-border"
            onClick={e => e.stopPropagation()}
          >
            {modalType === 'help' ? (
              <>
                <div className="flex items-center space-x-3 text-crimson">
                  <HelpCircle size={24} />
                  <h3 id="modal-dialog-title" className="font-serif font-bold text-lg text-text-primary">Help Center</h3>
                </div>
                <div className="text-xs text-text-muted space-y-2.5 leading-relaxed">
                  <p>
                    Welcome to the <strong>TESTIMONIUM Help Center</strong>. Here is how you can get assistance:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 pl-1 text-text-primary">
                    <li>
                      <strong>Caloy AI Assistant:</strong> Use the floating widget in the bottom right corner of any page to ask instant questions about services, requirements, and office hours.
                    </li>
                    <li>
                      <strong>Support Email:</strong> Write to us at <a href="mailto:support@testimonium.org" className="text-crimson hover:underline font-semibold focus-ring rounded">support@testimonium.org</a> for technical or account issues.
                    </li>
                    <li>
                      <strong>Parish Contact:</strong> Contact your selected parish office directly using the phone or email listed under the Parishes Directory page.
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-3 text-crimson">
                  <Info size={24} />
                  <h3 id="modal-dialog-title" className="font-serif font-bold text-lg text-text-primary">About TESTIMONIUM</h3>
                </div>
                <div className="text-xs text-text-muted space-y-2.5 leading-relaxed">
                  <p>
                    <strong>TESTIMONIUM</strong> is the official digital registry and sacramental services portal of the Diocese and the Vicariate of Canlaon.
                  </p>
                  <p>
                    Designed to streamline communications and certificate processing, TESTIMONIUM links parishioners directly to parish records, canonical scheduling calendars, and secure document verification systems.
                  </p>
                  <p className="text-[11px] text-text-muted/75 italic border-t border-border/40 pt-2.5">
                    © {new Date().getFullYear()} Roman Catholic Diocese of San Carlos. All rights reserved.
                  </p>
                </div>
              </>
            )}
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setModalType('none')}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
