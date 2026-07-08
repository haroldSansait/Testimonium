import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, HelpCircle, Settings } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';
import { DATA_PROVIDER } from '@/config/demo';
import { NotificationService } from '@/services/NotificationService';
import { useState, useEffect, useCallback } from 'react';

const modeConfig = {
  api: {
    label: 'API Mode',
    sub: 'Connected to Backend',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    dot: 'bg-emerald-500'
  },
  hybrid: {
    label: 'Hybrid Mode',
    sub: 'Mixed Data Sources',
    bg: 'bg-amber-50 text-amber-700 border-amber-200/60',
    dot: 'bg-amber-500'
  },
  demo: {
    label: 'Demo Mode',
    sub: 'Using Mock Data',
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
    dot: 'bg-indigo-500'
  }
};

interface NavbarProps {
  className?: string;
}

export function Navbar({ className }: NavbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const showSearchBar = pathname === '/notifications';
  const showSearchIcon = !showSearchBar && pathname !== '/calendar' && pathname !== '/notifications';

  const mode = (DATA_PROVIDER || 'demo') as 'demo' | 'api' | 'hybrid';
  const cfg = modeConfig[mode] || modeConfig.demo;

  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnread = useCallback(() => {
    NotificationService.getNotifications()
      .then((list) => {
        setUnreadCount(list.filter((n) => !n.isRead).length);
      })
      .catch((err) => console.error('Failed to get notifications:', err));
  }, []);

  useEffect(() => {
    fetchUnread();
    window.addEventListener('notifications-updated', fetchUnread);
    return () => window.removeEventListener('notifications-updated', fetchUnread);
  }, [fetchUnread, pathname]);

  return (
    <header
      className={cn(
        'flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200 sticky top-0 z-10',
        className
      )}
    >
      {/* Title & Mode Indicator */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm",
          cfg.bg
        )}>
          <span className={cn("w-2 h-2 rounded-full animate-pulse", cfg.dot)} />
          <span className="font-semibold">{cfg.label}</span>
          <span className="hidden sm:inline-block text-[10px] opacity-75 border-l pl-1.5 border-current/25">{cfg.sub}</span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {showSearchBar && (
          <div className="relative mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all w-56"
            />
          </div>
        )}

        {showSearchIcon && (
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors relative"
            aria-label="Search"
            id="navbar-search"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        <button
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors relative"
          aria-label="Notifications"
          id="navbar-notifications"
          onClick={() => navigate('/notifications')}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        <button
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Help"
          id="navbar-help"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {(pathname === '/calendar' || pathname === '/notifications') && (
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Settings"
            id="navbar-settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}

        <Avatar initials="AD" bgColor="#7B1C2A" size="sm" className="ml-1 cursor-pointer" />
      </div>
    </header>
  );
}
