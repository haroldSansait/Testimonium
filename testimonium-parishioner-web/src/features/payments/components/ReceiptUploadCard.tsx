import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Trash2, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import services from '../../../providers/factory';
import { Button } from '../../../components/ui/Button';
import SecureFileActions from '../../../components/files/SecureFileActions';

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

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
  const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

  // Detect existing receipt upload
  const existingReceipt = existingTransaction?.receipts?.[0];
  const existingOcr = existingReceipt?.ocrResult;

  const handleFile = (selectedFile: File) => {
    setErrorMessage(null);

    if (!allowedTypes.includes(selectedFile.type)) {
      setErrorMessage("Unsupported file type. Please upload a PNG, JPG, or JPEG image.");
      return;
    }

    if (selectedFile.size > maxSizeBytes) {
      setErrorMessage("File is too large. Maximum size allowed is 5 MB.");
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
        autoVerified: false,
      });

      onSuccess(result.request);
    } catch (err: any) {
      setIsUploading(false);
      console.error(err);
      const code = err.response?.data?.code || err.code;
      if (code === 'PAYMENT_PROOF_INVALID_IMAGE' || code === 'INVALID_FILE_FORMAT') {
        setErrorMessage("The selected file is not a valid receipt image. Please upload a clear JPEG or PNG under 5 MB.");
      } else if (code === 'FILE_TOO_LARGE') {
        setErrorMessage("The selected file exceeds the 5 MB limit. Please select a smaller file.");
      } else {
        const msg = err.response?.data?.message || err.message || "Failed to upload receipt. Please check your network and try again.";
        setErrorMessage(msg);
      }
    }
  };

  return (
    <div className="bg-white rounded-card border border-border/80 shadow-sm overflow-hidden flex flex-col">
      {/* Full-width seamless header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-red-50/70 via-red-50/40 to-transparent border-b border-crimson/10 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-red-100/80 border border-crimson/15 flex items-center justify-center flex-shrink-0 text-crimson">
          <UploadCloud className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Receipt Upload
          </h3>
        </div>
      </div>

      <div className="p-5 space-y-4 text-left flex-1 flex flex-col justify-between">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-900 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Existing uploaded receipt mode */}
        {existingReceipt && !file && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-green-50/50 border border-green-200/80 rounded-xl space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-green-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-green-700" />
                <span>Receipt Uploaded Successfully</span>
              </div>

              <SecureFileActions
                endpoint={'/requests/' + requestId + '/receipts/' + existingReceipt.id + '/download'}
                fileName={existingReceipt.fileName}
                mimeType={existingReceipt.mimeType}
                autoPreview
              />

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
                      {existingTransaction.status === 'VERIFIED' ? 'Verified by Staff' : 'Manual Audit Pending'}
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
              accept="image/png, image/jpeg, image/jpg"
              className="hidden"
              aria-label="Replace receipt file"
            />
          </div>
        )}

        {/* OCR Result View immediately after upload */}
        {ocrResult && !isUploading && !existingReceipt && (
          <div className="p-4 rounded-xl border space-y-4 animate-in fade-in duration-200 text-left bg-white shadow-xs border-border">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-800 text-xs font-bold">
                <CheckCircle2 className="w-5 h-5 text-green-700" />
                <span className="text-sm">Receipt Submitted for Review</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed font-normal">
                Your payment proof passed readability checks and is waiting for manual verification by parish records staff.
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
                <div>
                  <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Verification:</span>
                  <span className="font-semibold text-text-primary">Manual staff review pending</span>
                </div>
              </div>
            </div>

            <Button onClick={removeFile} variant="outline" className="w-full text-xs font-semibold">
              Upload a Different Receipt
            </Button>
          </div>
        )}

        {/* Upload State: Honest Indeterminate Progress while request is genuinely active */}
        {isUploading && (
          <div className="p-6 border border-border/80 rounded-xl bg-app-page/50 text-center space-y-3" role="status">
            <span className="text-xs font-bold text-text-primary">Checking payment proof quality…</span>
            <div className="w-full bg-border rounded-full h-2 overflow-hidden shadow-inner relative">
              <div className="bg-crimson h-2 rounded-full w-2/5 animate-pulse" />
            </div>
            <p className="text-[11px] text-text-muted">Verifying readability and submitting to parish records office.</p>
          </div>
        )}

        {/* Drag & Drop Upload Area with Semantic Accessible Label */}
        {!file && !existingReceipt && !ocrResult && !isUploading && (
          <label
            htmlFor="receipt-file-input"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2.5 focus-within:ring-2 focus-within:ring-crimson ${
              isDragging
                ? 'border-crimson bg-red-50/20'
                : 'border-border/80 hover:border-crimson hover:bg-red-50/5 bg-app-base'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 border border-crimson/15 flex items-center justify-center text-crimson mb-1">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-text-primary block">Upload Payment Receipt</span>
              <p className="text-[11px] text-text-muted mt-0.5 font-normal">Drag &amp; drop or click to browse files</p>
            </div>
            <span className="text-[10px] text-text-muted bg-white px-3 py-1 rounded-full border border-border/80 font-medium shadow-2xs">
              Supports PNG, JPG, JPEG (Max 5 MB)
            </span>
            <input
              id="receipt-file-input"
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/png, image/jpeg, image/jpg"
              className="sr-only"
            />
          </label>
        )}

        {/* File Preview Area After Selection */}
        {file && previewUrl && !ocrResult && !isUploading && (
          <div className="border border-border rounded-xl p-4 bg-app-base space-y-3.5 animate-in fade-in duration-150 text-left">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-crimson" /> Selected Preview
              </span>
              <button
                type="button"
                onClick={removeFile}
                className="p-1 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors focus-ring cursor-pointer"
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
              accept="image/png, image/jpeg, image/jpg"
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptUploadCard;
