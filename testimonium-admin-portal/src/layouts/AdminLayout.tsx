import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { Outlet } from 'react-router-dom';

export function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-page">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 bg-[#F5F0EE]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
