import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useLegalPolicies } from '../../services/legalPolicyService';

interface TermsContentProps {
  content?: string;
}

export const TermsContent: React.FC<TermsContentProps> = ({ content }) => {
  const { policies, loading, error, refetch } = useLegalPolicies();

  const displayContent = content || policies?.termsOfService?.content;

  if (loading && !displayContent) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3 text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin text-crimson" />
        <p className="text-xs">Loading authoritative Terms of Service...</p>
      </div>
    );
  }

  if (error && !displayContent) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
        <div className="flex items-center space-x-2 text-xs text-red-800">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
        <button
          onClick={() => void refetch()}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="whitespace-pre-wrap font-sans text-gray-800 text-xs sm:text-sm leading-relaxed">
      {displayContent}
    </div>
  );
};
