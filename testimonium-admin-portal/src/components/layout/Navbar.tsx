import { useLocation } from 'react-router-dom';
import { Search, Bell, HelpCircle, Settings } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/utils/cn';

const routeTitles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/document-requests': 'Document Requests',
  '/schedule-requests': 'Schedule Requests',
  '/calendar': 'Parish Management System',
  '/notifications': 'Parish Management System',
  '/activity-log': 'Activity Log',
};

interface NavbarProps {
  className?: string;
}

export function Navbar({ className }: NavbarProps) {
  const { pathname } = useLocation();
  const title = routeTitles[pathname] ?? 'TESTIMONIUM';

  const showSearchBar = pathname === '/notifications';
  const showSearchIcon = !showSearchBar && pathname !== '/calendar' && pathname !== '/notifications';

  return (
    <header
      className={cn(
        'flex items-center justify-between px-6 py-3.5 bg-white border-b border-gray-200 sticky top-0 z-10',
        className
      )}
    >
      {/* Page title */}
      <h2
        className="text-xl font-semibold text-crimson-700"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        {title}
      </h2>

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
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
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
