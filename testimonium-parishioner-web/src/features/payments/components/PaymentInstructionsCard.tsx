import React, { useEffect, useState } from 'react';
import { usePaymentConfiguration } from '../../../hooks/useService';
import { CreditCard, QrCode, AlertCircle, ZoomIn } from 'lucide-react';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Modal } from '../../../components/ui/Modal';

interface PaymentInstructionsCardProps {
  requestId: string;
  amount?: number | null;
}

export const PaymentInstructionsCard: React.FC<PaymentInstructionsCardProps> = ({ requestId, amount }) => {
  const { data: config, loading, error } = usePaymentConfiguration(requestId);
  const [imageError, setImageError] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const imageUrl = config?.qrCode?.imageUrl ?? null;
  const isConfigured = Boolean(config?.configured && config.qrCode?.enabled && imageUrl);

  useEffect(() => {
    setImageError(false);
    setIsQrModalOpen(false);
  }, [imageUrl]);

  if (loading) {
    return (
      <div className="bg-white rounded-card border border-border/80 shadow-sm overflow-hidden p-5 space-y-4">
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-card border border-red-200 bg-red-50/20 p-5 flex items-start space-x-3 text-red-800 text-sm shadow-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
        <div className="text-left">
          <h4 className="font-semibold">Unable to load payment instructions</h4>
          <p className="mt-1 text-xs text-red-700">Please contact the parish office directly before submitting a payment receipt.</p>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="bg-white rounded-card border border-amber-200 bg-amber-50/30 p-5 flex items-start space-x-3 text-amber-900 text-sm shadow-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <div className="text-left">
          <h4 className="font-semibold">Payment details are not configured</h4>
          <p className="mt-1 text-xs text-amber-800">{config?.message || 'Please contact the parish office directly before submitting a payment receipt.'}</p>
        </div>
      </div>
    );
  }

  const qrImageUrl = imageUrl || '';
  const formattedAmount =
    amount !== undefined && amount !== null && !isNaN(amount) ? `\u20B1${Number(amount).toFixed(2)}` : null;

  return (
    <>
      <div className="bg-white rounded-card border border-border/80 shadow-sm overflow-hidden flex flex-col">
        {/* Full-width seamless header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-red-50/70 via-red-50/40 to-transparent border-b border-crimson/10 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-red-100/80 border border-crimson/15 flex items-center justify-center flex-shrink-0 text-crimson">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
              Payment Instructions
            </h3>
          </div>
        </div>

        {/* Card Content Body */}
        <div className="p-5 space-y-4 text-left flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            {formattedAmount && (
              <div className="bg-gradient-to-br from-red-50/80 to-amber-50/40 border border-crimson/20 rounded-xl p-4 text-center space-y-0.5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Amount Due</span>
                <div className="text-2xl sm:text-3xl font-extrabold text-crimson tracking-tight">{formattedAmount}</div>
                <p className="text-[11px] text-text-muted font-medium">Official sacramental certificate processing fee</p>
              </div>
            )}

            <p className="text-xs text-text-muted font-normal leading-relaxed">
              Scan this parish payment QR, then save a screenshot of your payment confirmation for receipt upload.
            </p>

            {!imageError ? (
              <div className="flex flex-col items-center justify-center p-4 border border-dashed border-border/80 rounded-xl bg-app-base space-y-2 relative group">
                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-crimson" /> Scan QR to Pay
                </span>
                <button
                  type="button"
                  className="bg-white p-2.5 rounded-xl border border-border shadow-xs cursor-pointer relative focus-ring transition-transform group-hover:scale-[1.02]"
                  onClick={() => setIsQrModalOpen(true)}
                  aria-label="Enlarge parish payment QR code"
                >
                  <img
                    src={qrImageUrl}
                    alt="Parish payment QR code"
                    className="w-40 h-40 sm:w-44 sm:h-44 object-contain rounded-lg"
                    onError={() => setImageError(true)}
                  />
                  <div className="absolute inset-0 bg-black/35 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5 pointer-events-none backdrop-blur-[1px]">
                    <ZoomIn size={16} />
                    <span>Enlarge</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="text-[11px] font-semibold text-crimson hover:underline flex items-center gap-1 focus-ring rounded px-1.5 py-0.5 cursor-pointer"
                >
                  <ZoomIn size={12} />
                  <span>Tap to Enlarge QR Code</span>
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p>The parish payment QR could not be displayed. Please contact the parish office before submitting your receipt.</p>
              </div>
            )}
          </div>

          <div className="flex items-start gap-2.5 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-900 mt-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-amber-950">Keep Your Reference Number</span>
              <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-normal">
                Make sure the reference or transaction number is clearly legible on your receipt screenshot for automatic matching.
              </p>
            </div>
          </div>
        </div>
      </div>

      {!imageError && (
        <Modal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title="Parish Payment QR Code" size="sm">
          <div className="flex flex-col items-center justify-center p-2 sm:p-4">
            <div className="bg-white p-3 rounded-2xl border border-border shadow-md max-w-full">
              <img src={qrImageUrl} alt="Parish payment QR code full view" className="w-56 h-56 sm:w-64 sm:h-64 object-contain max-w-full" />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default PaymentInstructionsCard;
