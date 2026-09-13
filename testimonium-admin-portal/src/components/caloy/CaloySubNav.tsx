import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BarChart2, BookOpen, Sliders, ScrollText } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/permissions/rolePermissions';
import { PERMISSIONS, type Permission } from '@/permissions/permissions';
import { ConfirmNavigationModal } from '@/components/modals/ConfirmNavigationModal';

interface SubNavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  permission: Permission;
}

const SUB_NAV_ITEMS: SubNavItem[] = [
  { to: '/caloy', label: 'Overview', icon: LayoutDashboard, end: true, permission: PERMISSIONS.VIEW_CALOY },
  { to: '/caloy/analytics', label: 'Analytics', icon: BarChart2, permission: PERMISSIONS.VIEW_CALOY },
  { to: '/caloy/knowledge-base', label: 'Knowledge Base', icon: BookOpen, permission: PERMISSIONS.MANAGE_KNOWLEDGE_BASE },
  { to: '/caloy/settings', label: 'AI Settings', icon: Sliders, permission: PERMISSIONS.MANAGE_CALOY_SETTINGS },
  { to: '/caloy/logs', label: 'Logs', icon: ScrollText, permission: PERMISSIONS.VIEW_CALOY_LOGS },
];

export function CaloySubNav() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const visibleItems = SUB_NAV_ITEMS.filter((item) => hasPermission(role, item.permission));

  const handleNavClick = (e: React.MouseEvent, path: string) => {
    // If clicking current route, ignore
    if (location.pathname === path) return;

    const hasUnsaved =
      typeof window !== 'undefined' &&
      Boolean((window as any).hasUnsavedMapChanges || (window as any).hasUnsavedSettingsChanges);

    if (hasUnsaved) {
      e.preventDefault();
      e.stopPropagation();
      setPendingPath(path);
    }
  };

  const handleConfirmLeave = () => {
    if (typeof window !== 'undefined') {
      (window as any).hasUnsavedMapChanges = false;
      (window as any).hasUnsavedSettingsChanges = false;
    }
    const path = pendingPath;
    setPendingPath(null);
    if (path) {
      navigate(path);
    }
  };

  return (
    <>
      <div className="border border-gray-200 bg-white rounded-xl px-4 pt-1 shadow-sm mb-2">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto" aria-label="Caloy Tabs">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={(e) => handleNavClick(e, item.to)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 py-3 px-3 sm:px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-crimson-700 text-crimson-700 font-semibold'
                      : 'border-transparent text-gray-600 font-medium hover:text-gray-900 hover:border-gray-300'
                  )
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {pendingPath && (
        <ConfirmNavigationModal
          onConfirm={handleConfirmLeave}
          onClose={() => setPendingPath(null)}
        />
      )}
    </>
  );
}
