import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  MapPin, 
  FilePlus, 
  ClipboardCheck, 
  Calendar, 
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

  const navItems = [
    { label: 'Home', path: '/dashboard/home', icon: <Home size={18} /> },
    { label: 'Vicariate Directory', path: '/dashboard/parishes', icon: <MapPin size={18} /> },
    { label: 'Request Document', path: '/dashboard/request', icon: <FilePlus size={18} /> },
    { label: 'Track Request', path: '/dashboard/track', icon: <ClipboardCheck size={18} /> },
    { label: 'Scheduler', path: '/dashboard/scheduler', icon: <Calendar size={18} /> },
    { label: 'Notifications', path: '/dashboard/notifications', icon: <Bell size={18} /> },
    { label: 'Profile', path: '/dashboard/profile', icon: <UserIcon size={18} /> },
  ];

  const getPageTitle = () => {
    const activeItem = navItems.find(item => location.pathname.startsWith(item.path));
    return activeItem ? activeItem.label : 'Dashboard';
  };

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
        await logout();
        navigate('/');
      } 
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-app-page text-text-primary overflow-hidden relative">
      {/* Top Application Bar */}
      <header className="h-16 bg-white border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8 z-[1010] sticky top-0 shadow-sm">
        <div className="flex items-center space-x-4">
          {/* Hamburger trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 rounded-button hover:bg-app-page text-text-muted hover:text-crimson transition-colors focus-ring"
            aria-label="Open navigation menu"
            aria-expanded={isDrawerOpen}
          >
            <Menu size={22} />
          </button>
          
          <div className="flex items-center space-x-3">
            <Link
              to="/dashboard/home"
              className="font-serif font-black tracking-wider text-crimson text-lg md:text-xl hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson/20 rounded px-1 transition-opacity"
              aria-label="TESTIMONIUM Home"
            >
              TESTIMONIUM
            </Link>
            <span className="text-border hidden sm:inline">|</span>
            <h2 className="text-sm font-medium text-text-muted hidden sm:inline-block pt-0.5">
              {getPageTitle()}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notifications button */}
          <Link
            to="/dashboard/notifications"
            className="relative p-2 rounded-full hover:bg-app-page text-text-muted hover:text-crimson transition-colors focus-ring"
            aria-label={`${unreadCount} unread notifications`}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-crimson text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </Link>

          {/* User profile avatar dropdown */}
          <Dropdown
            trigger={
              <button className="flex items-center space-x-2 p-1 rounded-full hover:bg-app-page transition-colors focus-ring">
                <Avatar name={user?.displayName || user?.email || 'User'} size="sm" />
                <ChevronDown size={14} className="text-text-muted hidden sm:inline" />
              </button>
            }
            items={userMenuItems}
            align="right"
          />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-y-auto bg-app-base">
        {/* Centered Content with generous margins */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
          {children}
        </div>
      </main>

      {/* Unified Sliding Drawer Panel */}
      <div 
        className={`fixed inset-0 z-[9999] flex ${isDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        role="dialog"
        aria-modal="true"
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
          className={`relative w-72 max-w-xs bg-sidebar-bg text-white h-full flex flex-col z-10 border-none shadow-card transition-transform duration-300 ease-in-out transform ${
            isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="h-16 flex items-center justify-between px-6 bg-sidebar-dark flex-shrink-0 shadow-sm">
            <span className="font-serif font-black text-lg tracking-wider">TESTIMONIUM</span>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors focus-ring"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* User profile summary */}
          <div className="p-5 bg-sidebar-dark/20 flex items-center space-x-3.5 flex-shrink-0">
            <Avatar name={user?.displayName || user?.email || 'User'} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{user?.displayName || 'Parishioner'}</p>
              <p className="text-xs text-white/50 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Navigation Links Grouped into Sections */}
          <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
            {/* Portal Section */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-4 mb-2">Portal</p>
              <Link
                to="/dashboard/home"
                onClick={() => setIsDrawerOpen(false)}
                className={`flex items-center space-x-3.5 px-4 py-2.5 rounded-button text-sm font-medium transition-all duration-150 focus-ring ${
                  location.pathname === '/dashboard/home'
                    ? 'bg-white/10 text-white font-semibold shadow-inner'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Home size={18} className={location.pathname === '/dashboard/home' ? 'text-white' : 'text-white/60'} />
                <span>Home</span>
              </Link>
            </div>

            {/* Account Section */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-4 mb-2">Account</p>
              
              <Link
                to="/dashboard/profile"
                onClick={() => setIsDrawerOpen(false)}
                className={`flex items-center space-x-3.5 px-4 py-2.5 rounded-button text-sm font-medium transition-all duration-150 focus-ring ${
                  location.pathname === '/dashboard/profile'
                    ? 'bg-white/10 text-white font-semibold shadow-inner'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <UserIcon size={18} className={location.pathname === '/dashboard/profile' ? 'text-white' : 'text-white/60'} />
                <span>Profile</span>
              </Link>

              <Link
                to="/dashboard/notifications"
                onClick={() => setIsDrawerOpen(false)}
                className={`flex items-center space-x-3.5 px-4 py-2.5 rounded-button text-sm font-medium transition-all duration-150 focus-ring ${
                  location.pathname === '/dashboard/notifications'
                    ? 'bg-white/10 text-white font-semibold shadow-inner'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Bell size={18} className={location.pathname === '/dashboard/notifications' ? 'text-white' : 'text-white/60'} />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="ml-auto bg-white text-crimson font-bold text-xs px-2 py-0.5 rounded-full animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </Link>
            </div>

            {/* Support Section */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-4 mb-2">Support</p>
              
              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  setModalType('help');
                }}
                className="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-button text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white focus-ring text-left"
              >
                <HelpCircle size={18} className="text-white/60" />
                <span>Help Center</span>
              </button>

              <button
                onClick={() => {
                  setIsDrawerOpen(false);
                  setModalType('about');
                }}
                className="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-button text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white focus-ring text-left"
              >
                <Info size={18} className="text-white/60" />
                <span>About TESTIMONIUM</span>
              </button>
            </div>

            {/* Session Section */}
            <div className="space-y-1.5 pt-2">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest px-4 mb-2">Session</p>
              <button 
                onClick={async () => {
                  setIsDrawerOpen(false);
                  await logout();
                  navigate('/');
                }}
                className="w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-button text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors focus-ring text-left"
              >
                <LogOut size={18} className="text-white/60" />
                <span>Sign Out</span>
              </button>
            </div>
          </nav>

          {/* Drawer Footer info */}
          <div className="p-4 bg-sidebar-dark/20 flex-shrink-0 text-center">
            <span className="text-[10px] text-white/30 font-medium">TESTIMONIUM v1.0.0</span>
          </div>
        </aside>
      </div>

      {/* Floating Caloy AI Assistant Drawer */}
      <CaloyAssistant />

      {/* Help / About Modals */}
      {modalType !== 'none' && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setModalType('none')}
        >
          <div 
            className="bg-white rounded-card shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4 text-left"
            onClick={e => e.stopPropagation()}
          >
            {modalType === 'help' ? (
              <>
                <div className="flex items-center space-x-3 text-crimson">
                  <HelpCircle size={24} />
                  <h3 className="font-serif font-bold text-lg text-text-primary">Help Center</h3>
                </div>
                <div className="text-xs text-text-muted space-y-2.5 leading-relaxed">
                  <p>
                    Welcome to the <strong>TESTIMONIUM Help Center</strong>. Here is how you can get help:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1">
                    <li>
                      <strong>Caloy AI Assistant:</strong> Use the floating widget in the bottom right corner of any page to ask instant questions about services, requirements, and office hours.
                    </li>
                    <li>
                      <strong>Support Email:</strong> Write to us at <a href="mailto:support@testimonium.org" className="text-crimson hover:underline font-semibold">support@testimonium.org</a> for technical or account issues.
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
                  <h3 className="font-serif font-bold text-lg text-text-primary">About TESTIMONIUM</h3>
                </div>
                <div className="text-xs text-text-muted space-y-2.5 leading-relaxed">
                  <p>
                    <strong>TESTIMONIUM v1.0.0</strong> is the official digital registry and sacramental services portal of the Diocese and the Vicariate of Canlaon.
                  </p>
                  <p>
                    Designed to streamline communications and certificate processing, TESTIMONIUM links parishioners directly to parish records, canonical scheduling calendars, and secure document verification systems.
                  </p>
                  <p className="text-[10px] text-text-muted/65 italic border-t border-border/40 pt-2.5">
                    © 2026 Diocese and Vicariate of Canlaon. All rights reserved.
                  </p>
                </div>
              </>
            )}
            <div className="flex justify-end pt-2">
              <Button size="sm" className="bg-crimson hover:bg-crimson-dark" onClick={() => setModalType('none')}>
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
