import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, Info } from 'lucide-react';
import { cn } from '@/utils/cn';
import { DATA_PROVIDER } from '@/config/demo';
import { NotificationService } from '@/services/NotificationService';
import { useState, useEffect, useCallback } from 'react';
import { HelpModal } from '@/components/modals/HelpModal';
import { AboutModal } from '@/components/modals/AboutModal';
import { Tooltip } from '@/components/ui/Tooltip';

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

  const mode = (DATA_PROVIDER || 'demo') as 'demo' | 'api' | 'hybrid';
  const cfg = modeConfig[mode] || modeConfig.demo;

  const [unreadCount, setUnreadCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

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
        <Tooltip content={`Connectivity mode: ${cfg.label} (${cfg.sub})`} side="bottom">
          <div
            tabIndex={0}
            role="status"
            aria-label={`Connectivity mode: ${cfg.label}, ${cfg.sub}`}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-sm cursor-default focus:outline-none focus:ring-2 focus:ring-crimson-700/20",
              cfg.bg
            )}
          >
            <span className={cn("w-2 h-2 rounded-full animate-pulse", cfg.dot)} />
            <span className="font-semibold">{cfg.label}</span>
            <span className="hidden sm:inline-block text-[10px] opacity-75 border-l pl-1.5 border-current/25">{cfg.sub}</span>
          </div>
        </Tooltip>
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
