import React, { useEffect, useState } from 'react';
import { usePaymentConfiguration } from '../../../hooks/useService';
import { CreditCard, QrCode, AlertCircle, ZoomIn } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
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
    return <Card className="shadow-md"><CardHeader><Skeleton className="h-5 w-48 rounded" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full rounded" /><Skeleton className="h-32 w-full rounded" /></CardContent></Card>;
  }

  if (error) {
    return <Card className="border-red-200 bg-red-50/20"><CardContent className="pt-6 flex items-start space-x-3 text-red-800 text-sm"><AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" /><div className="text-left"><h4 className="font-semibold">Unable to load payment instructions</h4><p className="mt-1 text-xs text-red-700">Please contact the parish office directly before submitting a payment receipt.</p></div></CardContent></Card>;
  }

  if (!isConfigured) {
    return <Card className="border-amber-200 bg-amber-50/30"><CardContent className="pt-6 flex items-start space-x-3 text-amber-900 text-sm"><AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" /><div className="text-left"><h4 className="font-semibold">Payment details are not configured</h4><p className="mt-1 text-xs text-amber-800">{config?.message || 'Please contact the parish office directly before submitting a payment receipt.'}</p></div></CardContent></Card>;
  }

  const qrImageUrl = imageUrl || "";

  const formattedAmount = amount !== undefined && amount !== null && !isNaN(amount) ? `\u20B1${Number(amount).toFixed(2)}` : null;

  return <><Card className="shadow-md overflow-hidden border-border/80"><CardHeader className="bg-app-page border-b border-border/40 py-3.5"><CardTitle className="text-xs sm:text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2"><CreditCard className="w-4 h-4 text-crimson" /><span>Payment Instructions</span></CardTitle></CardHeader><CardContent className="p-5 space-y-4 text-left">{formattedAmount && <div className="bg-red-50/60 border border-crimson/20 rounded-card p-4 text-center space-y-0.5"><span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Amount Due</span><div className="text-2xl sm:text-3xl font-extrabold text-crimson tracking-tight">{formattedAmount}</div><p className="text-[11px] text-text-muted">Official sacramental certificate processing fee</p></div>}<p className="text-xs text-text-muted font-normal leading-relaxed">Scan this parish payment QR, then save a screenshot of your payment confirmation for receipt upload.</p>{!imageError ? <div className="flex flex-col items-center justify-center p-4 border border-dashed border-border/80 rounded-card bg-white space-y-2 relative group"><span className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center gap-1.5"><QrCode className="w-3.5 h-3.5 text-crimson" /> Scan QR to Pay</span><button type="button" className="bg-white p-2 rounded-xl border border-border shadow-xs cursor-pointer relative focus-ring" onClick={() => setIsQrModalOpen(true)} aria-label="Enlarge parish payment QR code"><img src={qrImageUrl} alt="Parish payment QR code" className="w-40 h-40 sm:w-48 sm:h-48 object-contain" onError={() => setImageError(true)} /><div className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1 pointer-events-none"><ZoomIn size={16} /><span>Enlarge</span></div></button><button type="button" onClick={() => setIsQrModalOpen(true)} className="text-[11px] font-semibold text-crimson hover:underline flex items-center gap-1 pt-0.5 focus-ring rounded px-1"><ZoomIn size={12} /><span>Tap to Enlarge QR Code</span></button></div> : <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-card text-xs text-amber-900"><AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /><p>The parish payment QR could not be displayed. Please contact the parish office before submitting your receipt.</p></div>}<div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-card text-xs text-amber-900"><AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /><div><span className="font-bold block">Keep Your Reference Number</span><p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed font-normal">Make sure the reference or transaction number is clearly legible on your receipt screenshot for automatic matching.</p></div></div></CardContent></Card>{!imageError && <Modal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} title="Parish Payment QR Code" size="sm"><div className="flex flex-col items-center justify-center p-2 sm:p-4"><div className="bg-white p-3 rounded-2xl border border-border shadow-md max-w-full"><img src={qrImageUrl} alt="Parish payment QR code full view" className="w-56 h-56 sm:w-64 sm:h-64 object-contain max-w-full" /></div></div></Modal>}</>;
};

export default PaymentInstructionsCard;
