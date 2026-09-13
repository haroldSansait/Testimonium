import { Outlet } from 'react-router-dom';
import { CaloySubNav } from '@/components/caloy/CaloySubNav';

export function CaloyLayout() {
  return (
    <div className="max-w-7xl mx-auto space-y-3">
      {/* Top Caloy Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold text-crimson-700"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            Caloy Control Center
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 font-medium">
            Centralized operational telemetry, runtime governance, Knowledge Base, and audit logs.
          </p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <CaloySubNav />

      {/* Active Tab Content */}
      <div className="min-h-[400px]">
        <Outlet />
      </div>
    </div>
  );
}
