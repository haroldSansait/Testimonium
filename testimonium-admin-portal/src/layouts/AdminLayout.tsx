import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';

export function AdminLayout() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileNavigationOpen(false), [location.pathname]);

  // Single authoritative background polling for notification counts across portal
  useNotificationCounts({ enableAutoRefresh: true });

  return (
    <div className="flex h-full w-full overflow-hidden bg-page">
      {/* Sidebar */}
      <div className="hidden lg:flex h-full"><Sidebar /></div>
      {mobileNavigationOpen && <>
        <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileNavigationOpen(false)} />
        <div className="fixed inset-y-0 left-0 z-50 flex lg:hidden h-full">
          <Sidebar isMobileDrawer onCloseMobileDrawer={() => setMobileNavigationOpen(false)} />
          <button aria-label="Close navigation" onClick={() => setMobileNavigationOpen(false)} className="absolute right-3 top-3 rounded-md bg-white/10 p-2 text-white z-50 hover:bg-white/20 transition-colors"><X className="h-5 w-5" /></button>
        </div>
      </>}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        <Navbar onOpenNavigation={() => setMobileNavigationOpen(true)} />
        <main className="flex-1 min-h-0 overflow-y-auto bg-[#F5F0EE] p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
