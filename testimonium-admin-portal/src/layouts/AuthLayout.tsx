import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#F5F0EE] flex items-center justify-center p-4">
      <Outlet />
    </div>
  );
}
