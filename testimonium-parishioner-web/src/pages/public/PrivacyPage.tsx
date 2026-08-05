import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Lock } from 'lucide-react';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';
import { PrivacyContent } from '../../components/legal/PrivacyContent';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-app-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/signup"
            className="inline-flex items-center space-x-2 text-sm font-medium text-crimson hover:underline focus-ring rounded-button px-3 py-1.5"
            aria-label="Back to Registration"
          >
            <ArrowLeft size={18} />
            <span>Back to Registration</span>
          </Link>
          
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-slate-700 bg-slate-100 px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm">
            <Lock size={14} className="text-emerald-700" />
            <span>Version 1.0 — Effective August 2026</span>
          </div>
        </div>

        {/* Hero Header Banner */}
        <div 
          className="relative rounded-2xl overflow-hidden shadow-xl p-8 sm:p-12 text-white"
          style={{
            backgroundImage: `linear-gradient(rgba(123, 28, 42, 0.92), rgba(123, 28, 42, 0.96)), url(${mtKanlaonImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center justify-center p-3 bg-white/15 rounded-xl backdrop-blur-md border border-white/20">
              <ShieldCheck size={32} className="text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-white">
              Privacy Policy
            </h1>
            <p className="text-sm sm:text-base text-white/90 leading-relaxed font-light">
              How the Roman Catholic Diocese of San Carlos protects your personal & sacramental information.
            </p>
          </div>
        </div>

        {/* Legal Content Body */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-10 shadow-sm space-y-8">
          <PrivacyContent />
          
          <div className="pt-4 flex justify-end">
            <Link
              to="/signup"
              className="px-4 py-2.5 bg-crimson text-white rounded-button font-medium text-xs hover:bg-crimson-dark transition-colors focus-ring shadow-sm"
            >
              Return to Registration
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrivacyPage;

