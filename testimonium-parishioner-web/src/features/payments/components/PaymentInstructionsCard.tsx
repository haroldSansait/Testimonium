import React, { useState } from 'react';
import { usePaymentConfiguration } from '../../../hooks/useService';
import { CreditCard, QrCode, AlertCircle, Smartphone, ZoomIn } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/ui/Modal';

interface PaymentInstructionsCardProps {
  parishId?: string;
  amount?: number | null;
}

export const PaymentInstructionsCard: React.FC<PaymentInstructionsCardProps> = ({ parishId, amount }) => {
  const { data: config, loading, error } = usePaymentConfiguration(parishId);
  const [activeTab, setActiveTab] = useState<'gcash' | 'maya'>('gcash');
  const [imageError, setImageError] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Derive configured availability from authoritative fields (non-empty account details or QR)
  const hasGCash = Boolean(
    config?.gcash &&
    (config.gcash.accountNumber?.trim() || config.gcash.accountName?.trim() || config.gcash.qrCodeUrl?.trim())
  );

  const hasMaya = Boolean(
    config?.maya &&
    (config.maya.accountNumber?.trim() || config.maya.accountName?.trim() || config.maya.qrCodeUrl?.trim())
  );

  // Sync active tab with available methods
  React.useEffect(() => {
    setImageError(false);
    if (!hasGCash && hasMaya) {
      setActiveTab('maya');
    } else if (hasGCash) {
      setActiveTab('gcash');
    }
  }, [hasGCash, hasMaya, config]);

  if (loading) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <Skeleton className="h-5 w-48 rounded" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full rounded" />
          <Skeleton className="h-32 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error || !config || (!hasGCash && !hasMaya)) {
    return (
      <Card className="border-red-200 bg-red-50/20">
        <CardContent className="pt-6 flex items-start space-x-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
          <div className="text-left">
            <h4 className="font-semibold">Unable to load payment instructions</h4>
            <p className="mt-1 text-xs text-red-700">Please contact the parish office directly for bank transfer or alternative payment options.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selected = (activeTab === 'maya' && hasMaya) ? config.maya : config.gcash;

  const formattedAmount = amount !== undefined && amount !== null && !isNaN(amount)
    ? `₱${Number(amount).toFixed(2)}`
    : null;

  const getMethodInstructionText = () => {
    if (hasGCash && hasMaya) return 'using GCash or PayMaya';
    if (hasMaya) return 'using PayMaya';
    return 'using GCash';
  };

  return (
    <>
      <Card className="shadow-md overflow-hidden border-border/80">
        <CardHeader className="bg-app-page border-b border-border/40 py-3.5">
          <div className="flex justify-between items-center w-full">
            <CardTitle className="text-xs sm:text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-crimson" />
              <span>Payment Instructions</span>
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-4 text-left">
          {/* Prominent Amount Due Section */}
          {formattedAmount && (
            <div className="bg-red-50/60 border border-crimson/20 rounded-card p-4 text-center space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                Amount Due
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold text-crimson tracking-tight">
                {formattedAmount}
              </div>
              <p className="text-[11px] text-text-muted">Official sacramental certificate processing fee</p>
            </div>
          )}

          <p className="text-xs text-text-muted font-normal leading-relaxed">
            Please settle the document fee {getMethodInstructionText()}. After completing the transfer, save a screenshot of your payment confirmation for receipt upload.
          </p>          {/* Payment Method Switcher (when both methods are configured) */}
          {hasGCash && hasMaya && (
            <div className="flex bg-app-page p-1 rounded-lg border border-border" role="group" aria-label="Payment method">
              <button
                type="button"
                onClick={() => setActiveTab('gcash')}
                aria-pressed={activeTab === 'gcash'}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 focus-ring ${
                  activeTab === 'gcash'
                    ? 'bg-white text-blue-600 shadow-xs border border-blue-200'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                GCash
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('maya')}
                aria-pressed={activeTab === 'maya'}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 focus-ring ${
                  activeTab === 'maya'
                    ? 'bg-white text-green-700 shadow-xs border border-green-200'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                PayMaya
              </button>
            </div>
          )}

          {/* Selected Account Info Panel */}
          <div className="space-y-3.5">
            <div className="bg-app-page p-3.5 rounded-card border border-border space-y-2 text-left">
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Account Name</span>
                <span className="text-xs font-bold text-text-primary">{selected.accountName}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Account Number</span>
                <span className="text-sm font-mono font-bold text-text-primary select-all">{selected.accountNumber}</span>
              </div>
            </div>


            {/* QR Code Display with Tap to Enlarge */}
            {selected.qrCodeUrl && !imageError && (
              <div className="flex flex-col items-center justify-center p-4 border border-dashed border-border/80 rounded-card bg-white space-y-2 relative group">
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-crimson" /> Scan QR to Pay
                </span>

                <button
                  type="button"
                  className="bg-white p-2 rounded-xl border border-border shadow-xs cursor-pointer relative focus-ring"
                  onClick={() => setIsQrModalOpen(true)}
                  aria-label="Enlarge QR Code"
                >
                  <img
                    src={selected.qrCodeUrl}
                    alt={`${activeTab === 'gcash' ? 'GCash' : 'PayMaya'} QR Code`}
                    className="w-40 h-40 sm:w-48 sm:h-48 object-contain"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1 pointer-events-none">
                    <ZoomIn size={16} />
                    <span>Enlarge</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="text-[11px] font-semibold text-crimson hover:underline flex items-center gap-1 pt-0.5 focus-ring rounded px-1"
                >
                  <ZoomIn size={12} />
                  <span>Tap to Enlarge QR Code</span>
                </button>
              </div>
            )}
          </div>

          {/* Reference Number Note */}
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-card text-xs text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Keep Your Reference Number</span>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-normal">
                Make sure the reference or transaction number is clearly legible on your receipt screenshot for automatic matching.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Enlargement Modal */}
      {selected.qrCodeUrl && (
        <Modal
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          title={`${activeTab === 'gcash' ? 'GCash' : 'PayMaya'} Payment QR Code`}
          size="sm"
        >
          <div className="flex flex-col items-center justify-center p-2 sm:p-4 space-y-4 text-center">
            <div className="bg-white p-3 rounded-2xl border border-border shadow-md max-w-full">
              <img
                src={selected.qrCodeUrl}
                alt={`${activeTab === 'gcash' ? 'GCash' : 'PayMaya'} QR Code Full View`}
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain max-w-full"
              />
            </div>
            <div className="text-xs space-y-1">
              <p className="font-bold text-text-primary">{selected.accountName}</p>
              <p className="font-mono text-sm text-text-muted select-all">{selected.accountNumber}</p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default PaymentInstructionsCard;
