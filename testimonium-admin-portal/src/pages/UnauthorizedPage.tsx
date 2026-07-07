import { useNavigate } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';

/**
 * UnauthorizedPage — rendered when a user navigates to a route that
 * requires a permission their role does not have.
 *
 * Instead of producing a backend error, ProtectedRoute redirects here
 * so the user receives a clear, friendly explanation.
 */
export function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F5F0EE] flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 max-w-md w-full p-10 text-center">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-50 mx-auto mb-6">
          <ShieldOff className="w-8 h-8 text-crimson-700" />
        </div>

        {/* Heading */}
        <h1
          className="text-2xl font-bold text-gray-900 mb-2"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Access Denied
        </h1>

        {/* Subtext */}
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          You do not have permission to view this page.
          If you believe this is an error, please contact your Diocese Coordinator.
        </p>

        {/* Back button */}
        <button
          id="unauthorized-back-btn"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-crimson-700 text-white text-sm font-medium rounded-md hover:bg-crimson-800 transition-colors duration-150"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
