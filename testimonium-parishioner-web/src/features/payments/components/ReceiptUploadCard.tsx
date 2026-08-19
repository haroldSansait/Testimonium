import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Trash2, RefreshCw, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import services from '../../../providers/factory';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

interface ReceiptUploadCardProps {
  requestId: string;
  existingTransaction?: any;
  onSuccess: (updatedRequest?: any) => void;
}

export const ReceiptUploadCard: React.FC<ReceiptUploadCardProps> = ({
  requestId,
  existingTransaction,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Processing states (only active when request is genuinely pending)
  const [isUploading, setIsUploading] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ referenceNumber?: string; amount?: string; confidenceScore?: number; autoVerified?: boolean } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const maxSizeBytes = 10 * 1024 * 1024; // 10 MB

  // Detect existing receipt upload
  const existingReceipt = existingTransaction?.receipts?.[0];
  const existingOcr = existingReceipt?.ocrResult;
  const existingReceiptUrl = existingReceipt
    ? `https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/${existingReceipt.r2ObjectKey}`
    : null;

  const handleFile = (selectedFile: File) => {
    setErrorMessage(null);

    if (!allowedTypes.includes(selectedFile.type)) {
      setErrorMessage("Unsupported file type. Please upload a PNG, JPG, JPEG, or WEBP image.");
      return;
    }

    if (selectedFile.size > maxSizeBytes) {
      setErrorMessage("File is too large. Maximum size allowed is 10 MB.");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewUrl(null);
    setOcrResult(null);
    setErrorMessage(null);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const uploadReceipt = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const result = await services.request.uploadReceipt(requestId, file);

      // Immediately render returned OCR results without artificial delays
      setIsUploading(false);
      setOcrResult({
        referenceNumber: result.ocrResult?.referenceNumber || undefined,
        amount: result.ocrResult?.amount || undefined,
        confidenceScore: result.ocrResult?.confidenceScore || undefined,
        autoVerified: result.autoVerified,
      });

      onSuccess(result.request);
    } catch (err: any) {
      setIsUploading(false);
      console.error(err);
      const msg = err.response?.data?.message || err.message || "Failed to upload receipt. Please check your network and try again.";
      setErrorMessage(msg);
    }
  };

  return (
    <Card className="shadow-md overflow-hidden border-border/80">
      <CardHeader className="bg-app-page border-b border-border/40 py-3.5">
        <CardTitle className="text-xs sm:text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-crimson" />
          <span>Receipt Upload</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-5 space-y-4 text-left">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-card flex items-start gap-2.5 text-xs text-red-900 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Existing uploaded receipt mode */}
        {existingReceiptUrl && !file && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-green-50/50 border border-green-200 rounded-card space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-green-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-green-700" />
                <span>Receipt Uploaded Successfully</span>
              </div>

              <div className="border border-border/60 rounded-xl overflow-hidden max-h-64 flex justify-center bg-gray-950 shadow-inner">
                <img src={existingReceiptUrl} alt="Uploaded receipt proof" className="object-contain max-h-64" />
              </div>

              {existingOcr && (
                <div className="text-left text-xs bg-white border border-border p-3.5 rounded-xl space-y-2 text-text-muted">
                  {existingOcr.referenceNumber && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Reference No:</span>
                      <span className="font-bold text-text-primary font-mono">{existingOcr.referenceNumber}</span>
                    </div>
                  )}
                  {existingOcr.amount && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Amount Detected:</span>
                      <span className="font-bold text-text-primary">₱{existingOcr.amount}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Verification Mode:</span>
                    <span className="font-bold text-text-primary text-[10px] bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded uppercase">
                      {existingTransaction.status === 'VERIFIED' ? 'Auto-Verified' : 'Manual Audit Pending'}
                    </span>
                  </div>
                  {existingTransaction.status !== 'VERIFIED' && (
                    <p className="text-[11px] text-text-muted mt-2 border-t border-border/50 pt-2 font-normal leading-relaxed">
                      Parish administrative staff are reviewing this transaction proof. Processing will resume immediately after validation.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <a
                href={existingReceiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 text-xs font-bold rounded-button border border-border text-text-primary bg-white hover:bg-app-page transition-all flex items-center justify-center gap-1.5 focus-ring"
              >
                <Eye className="w-3.5 h-3.5" /> View Receipt
              </a>
              <Button
                onClick={triggerFileInput}
                variant="outline"
                className="flex-1 text-xs border border-border text-text-primary hover:bg-app-page flex items-center justify-center gap-1.5 font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Replace Receipt
              </Button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
              aria-label="Replace receipt file"
            />
          </div>
        )}

        {/* OCR Result View immediately after upload */}
        {ocrResult && !isUploading && !existingReceiptUrl && (
          <div className="p-4 rounded-card border space-y-4 animate-in fade-in duration-200 text-left bg-white shadow-xs border-border">
            {ocrResult.autoVerified ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-800 text-xs font-bold">
                  <CheckCircle2 className="w-5 h-5 text-green-700" />
                  <span className="text-sm">Receipt Passed Automated Verification</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed font-normal">
                  Our system verified the payment details on your uploaded receipt.
                </p>
                <div className="bg-app-page border border-border p-3.5 rounded-xl space-y-1.5 text-xs text-text-muted">
                  {ocrResult.referenceNumber && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Reference Number:</span>
                      <span className="font-bold text-text-primary font-mono">{ocrResult.referenceNumber}</span>
                    </div>
                  )}
                  {ocrResult.amount && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Amount Detected:</span>
                      <span className="font-bold text-text-primary">₱{ocrResult.amount}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-800 text-xs font-bold">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  <span className="text-sm">Receipt Uploaded &amp; Awaiting Review</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed font-normal">
                  Your receipt proof was received successfully and is queued for parish audit.
                </p>
                <div className="bg-app-page border border-border p-3 rounded-xl text-xs text-text-muted space-y-1">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Status:</span>
                    <span className="font-semibold text-text-primary">Awaiting manual approval</span>
                  </div>
                </div>
              </div>
            )}

            <Button onClick={removeFile} variant="outline" className="w-full text-xs font-semibold">
              Upload a Different Receipt
            </Button>
          </div>
        )}

        {/* Upload State: Honest Indeterminate Progress while request is genuinely active */}
        {isUploading && (
          <div className="p-6 border border-border/80 rounded-card bg-app-page/50 text-center space-y-3" role="status">
            <span className="text-xs font-bold text-text-primary">Uploading &amp; Verifying Receipt…</span>
            <div className="w-full bg-border rounded-full h-2 overflow-hidden shadow-inner relative">
              <div className="bg-crimson h-2 rounded-full w-2/5 animate-pulse" />
            </div>
            <p className="text-[11px] text-text-muted">Encrypting and transferring file to secure ecclesiastical storage.</p>
          </div>
        )}

        {/* Drag & Drop Upload Area with Semantic Accessible Label */}
        {!file && !existingReceiptUrl && !ocrResult && !isUploading && (
          <label
            htmlFor="receipt-file-input"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-card p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2.5 focus-within:ring-2 focus-within:ring-crimson ${
              isDragging
                ? 'border-crimson bg-red-50/15'
                : 'border-border/80 hover:border-crimson hover:bg-red-50/5'
            }`}
          >
            <UploadCloud className="w-10 h-10 text-text-muted/60" />
            <div>
              <span className="text-xs font-bold text-text-primary block">Upload Payment Receipt</span>
              <p className="text-[11px] text-text-muted mt-0.5 font-normal">Drag &amp; drop or click to browse files</p>
            </div>
            <span className="text-[10px] text-text-muted bg-white px-2.5 py-0.5 rounded-full border border-border font-medium">
              Supports PNG, JPG, JPEG, WEBP (Max 10 MB)
            </span>
            <input
              id="receipt-file-input"
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="sr-only"
            />
          </label>
        )}

        {/* File Preview Area After Selection */}
        {file && previewUrl && !ocrResult && !isUploading && (
          <div className="border border-border rounded-card p-4 bg-app-page/40 space-y-4 animate-in fade-in duration-150 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-text-muted" /> Selected Preview
              </span>
              <button
                type="button"
                onClick={removeFile}
                className="p-1 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors focus-ring"
                aria-label="Remove selected file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-border/80 rounded-xl overflow-hidden max-h-64 flex justify-center bg-gray-950 shadow-inner">
              <img src={previewUrl} alt="Selected receipt preview" className="object-contain max-h-64" />
            </div>

            <div className="flex items-center justify-between text-[11px] text-text-muted font-normal bg-white p-2.5 rounded-lg border border-border/60">
              <span className="truncate max-w-[200px] font-medium" title={file.name}>{file.name}</span>
              <span className="font-mono font-bold text-text-primary">{formatBytes(file.size)}</span>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={uploadReceipt}
                className="flex-1 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                Submit Receipt
              </Button>
              <Button
                onClick={triggerFileInput}
                variant="outline"
                className="flex-1 text-xs border border-border text-text-primary hover:bg-app-page font-semibold"
              >
                Replace
              </Button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReceiptUploadCard;
