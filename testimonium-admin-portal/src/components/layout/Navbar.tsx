import { useCachedQuery } from '@/hooks/useCachedQuery';
import { queryClient, privateQueryKey, guardedQuery } from '@/services/queryClient';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, Info, Menu } from 'lucide-react';
import { cn } from '@/utils/cn';
import { NotificationService } from '@/services/NotificationService';
import { useState, useEffect, useCallback } from 'react';
import { HelpModal } from '@/components/modals/HelpModal';
import { AboutModal } from '@/components/modals/AboutModal';
import { Tooltip } from '@/components/ui/Tooltip';

interface NavbarProps {
  className?: string;
  onOpenNavigation?: () => void;
}

export function Navbar({ className, onOpenNavigation }: NavbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const notifications = useCachedQuery(['notifications'], () => NotificationService.getNotifications(), { enabled: false });
  const unreadCount = (notifications.data ?? []).filter(n => !n.isRead).length;
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const fetchUnread = useCallback(() => {
    void queryClient.fetchQuery({ queryKey: privateQueryKey('notifications'),
      queryFn: guardedQuery(() => NotificationService.getNotifications()), staleTime: 30_000,
    }).catch(() => {});
  }, []);
  const refreshUnread = notifications.refetch;
  useEffect(() => {
    fetchUnread();
  }, [fetchUnread, pathname]);
  useEffect(() => {
    const refresh = () => { void refreshUnread(true); };
    window.addEventListener('notifications-updated', refresh);
    return () => window.removeEventListener('notifications-updated', refresh);
  }, [refreshUnread]);


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
            aria-label="Notifications"
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
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
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
