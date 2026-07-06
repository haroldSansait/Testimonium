import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { setupInterceptors } from '@/api/interceptors';
import { AppRouter } from '@/routes/AppRouter';
import '@/index.css';

// Initialize Axios interceptors once at startup.
// The onUnauthorized callback will be wired to AuthContext.logout
// after the tree is mounted — for now, a page reload on 401 is safe.
setupInterceptors();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
