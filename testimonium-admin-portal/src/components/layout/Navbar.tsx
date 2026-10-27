import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, Info, Menu } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useState, useEffect } from 'react';
import { HelpModal } from '@/components/modals/HelpModal';
import { AboutModal } from '@/components/modals/AboutModal';
import { Tooltip } from '@/components/ui/Tooltip';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';

interface NavbarProps {
  className?: string;
  onOpenNavigation?: () => void;
}

export function Navbar({ className, onOpenNavigation }: NavbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const { unreadCount, refetch } = useNotificationCounts();
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    void refetch(true);
  }, [pathname, refetch]);

  return (
    <header
      className={cn(
        'flex items-center justify-between px-3 sm:px-6 py-3.5 bg-white border-b border-gray-200 sticky top-0 z-10',
        className
      )}
    >
      {/* Mobile navigation */}
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Open navigation" onClick={onOpenNavigation} className="rounded-md p-2 text-gray-600 hover:bg-gray-100 lg:hidden"><Menu className="h-5 w-5" /></button>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <Tooltip content="Notifications & alerts" side="bottom">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors relative"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount > 99 ? '99+' : unreadCount} unread` : 'Notifications, none unread'}
            id="navbar-notifications"
            onClick={() => {
              const hasUnsaved = (window as any).hasUnsavedMapChanges || (window as any).hasUnsavedSettingsChanges;
              if (hasUnsaved) {
                const proceed = window.confirm('You have unsaved changes. Are you sure you want to leave without saving?');
                if (!proceed) return;
                (window as any).hasUnsavedMapChanges = false;
                (window as any).hasUnsavedSettingsChanges = false;
              }
              navigate('/notifications');
            }}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-[#7B1C2A] text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-xs pointer-events-none"
                aria-hidden="true"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </Tooltip>

        <Tooltip content="Administrative help & guides" side="bottom">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Help"
            id="navbar-help"
            onClick={() => setShowHelp(true)}
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </Tooltip>

        <Tooltip content="About TESTIMONIUM" side="bottom">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="About"
            id="navbar-about"
            onClick={() => setShowAbout(true)}
          >
            <Info className="w-5 h-5" />
          </button>
        </Tooltip>
      </div>

      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </header>
  );
}
