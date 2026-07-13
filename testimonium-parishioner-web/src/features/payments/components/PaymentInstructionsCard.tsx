import React, { useState } from 'react';
import { usePaymentConfiguration } from '../../../hooks/useService';
import { CreditCard, QrCode, AlertCircle, Smartphone } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';

interface PaymentInstructionsCardProps {
  parishId?: string;
}

export const PaymentInstructionsCard: React.FC<PaymentInstructionsCardProps> = ({ parishId }) => {
  const { data: config, loading, error } = usePaymentConfiguration(parishId);
  const [activeTab, setActiveTab] = useState<'gcash' | 'maya'>('gcash');

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

  if (error || !config) {
    return (
      <Card className="border-red-200 bg-red-50/10">
        <CardContent className="pt-6 flex items-start space-x-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <div>
            <h4 className="font-semibold">Unable to load payment instructions</h4>
            <p className="mt-1 text-xs text-red-700">Please contact the parish office directly for bank transfer or alternative payments.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selected = activeTab === 'gcash' ? config.gcash : config.maya;

  return (
    <Card className="shadow-md overflow-hidden border-border/80">
      <CardHeader className="bg-app-page border-b border-border/40 py-4">
        <CardTitle className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-crimson" />
          Payment Instructions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        <p className="text-xs text-text-muted font-normal leading-relaxed">
          Please settle the document fee using GCash or Maya. Ensure you capture a screenshot of your receipt after transaction.
        </p>

        {/* Tab Buttons */}
        <div className="flex bg-app-page p-1 rounded-lg border border-border/40">
          <button
            onClick={() => setActiveTab('gcash')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
              activeTab === 'gcash'
                ? 'bg-white text-blue-600 shadow-sm border border-blue-100'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            GCash
          </button>
          <button
            onClick={() => setActiveTab('maya')}
            className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2 ${
              activeTab === 'maya'
                ? 'bg-white text-green-700 shadow-sm border border-green-100'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            PayMaya
          </button>
        </div>

        {/* Selected Account Info */}
        <div className="space-y-4">
          <div className="bg-app-page p-4 rounded-xl border border-border/20 space-y-3">
            <div>
              <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Account Name</span>
              <span className="text-xs font-semibold text-text-primary">{selected.accountName}</span>
            </div>
            <div>
              <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Account Number</span>
              <span className="text-sm font-mono font-bold text-text-primary select-all">{selected.accountNumber}</span>
            </div>
          </div>

          {/* QR Code Display */}
          {selected.qrCodeUrl && (
            <div className="flex flex-col items-center justify-center p-4 border border-dashed border-border/60 rounded-xl bg-white space-y-2">
              <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5" /> Scan QR to Pay
              </span>
              <div className="bg-gray-50 p-2.5 rounded-lg border border-border/40">
                <img
                  src={selected.qrCodeUrl}
                  alt={`${activeTab === 'gcash' ? 'GCash' : 'Maya'} QR Code`}
                  className="w-32 h-32 object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Warning Reminder */}
        <div className="flex items-start gap-2.5 p-3.5 bg-amber-50/50 border border-amber-200/50 rounded-xl text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Enter Reference Number</span>
            <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed font-normal">
              When uploading your receipt, make sure the reference number is clear. It is used to match your payment automatically.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
export default PaymentInstructionsCard;
