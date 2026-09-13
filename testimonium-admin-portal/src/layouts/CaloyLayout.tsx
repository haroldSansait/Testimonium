import { Outlet } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { CaloySubNav } from '@/components/caloy/CaloySubNav';

export function CaloyLayout() {
  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Top Caloy Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-crimson-700/10 border border-crimson-700/20 flex items-center justify-center text-crimson-700 shadow-sm flex-shrink-0">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1
              className="text-2xl sm:text-3xl font-bold text-crimson-700"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Caloy Control Center
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Centralized operational telemetry, runtime governance, Knowledge Base, and audit logs.
            </p>
          </div>
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
