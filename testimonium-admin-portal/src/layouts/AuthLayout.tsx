import { Outlet } from 'react-router-dom';
import mtKanlaonImage from '@/assets/Mt_Kanlaon.png';

export function AuthLayout() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(107, 15, 26, 0.88), rgba(74, 10, 18, 0.94)), url(${mtKanlaonImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <Outlet />
    </div>
  );
}

