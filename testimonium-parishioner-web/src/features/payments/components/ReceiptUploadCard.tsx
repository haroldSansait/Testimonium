import React, { useState, useRef } from 'react';
import { UploadCloud, Image, Trash2, RefreshCw, CheckCircle, AlertCircle, Eye } from 'lucide-react';
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
  
  // Progress states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
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
    setUploadProgress(0);
    setErrorMessage(null);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + 15;
      });
    }, 150);

    try {
      // Execute the request provider uploadReceipt call
      const promise = services.request.uploadReceipt(requestId, file);
      
      // Wait for simulated progress to complete
      await new Promise(resolve => setTimeout(resolve, 800));
      clearInterval(interval);
      setUploadProgress(100);

      // Transition to OCR
      setIsUploading(false);
      setIsProcessingOcr(true);

      const result = await promise;
      
      setIsProcessingOcr(false);
      setOcrResult({
        referenceNumber: result.ocrResult?.referenceNumber || undefined,
        amount: result.ocrResult?.amount || undefined,
        confidenceScore: result.ocrResult?.confidenceScore || undefined,
        autoVerified: result.autoVerified,
      });

      onSuccess(result.request);
    } catch (err: any) {
      clearInterval(interval);
      setIsUploading(false);
      setIsProcessingOcr(false);
      console.error(err);
      const msg = err.response?.data?.message || err.message || "Failed to upload receipt. Please check your network and try again.";
      setErrorMessage(msg);
    }
  };

  return (
    <Card className="shadow-md overflow-hidden border-border/80">
      <CardHeader className="bg-app-page border-b border-border/40 py-4">
        <CardTitle className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-crimson" />
          Receipt Upload
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-5 space-y-4">
        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="font-normal">{errorMessage}</span>
          </div>
        )}

        {/* Existing uploaded receipt mode */}
        {existingReceiptUrl && !file && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-green-50/40 border border-green-200/50 rounded-xl space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-700 text-xs font-semibold">
                <CheckCircle className="w-4 h-4" />
                <span>Receipt Uploaded Successfully</span>
              </div>
              
              <div className="border border-border/60 rounded-lg overflow-hidden max-h-48 flex justify-center bg-gray-900 shadow-inner">
                <img src={existingReceiptUrl} alt="Receipt proof" className="object-contain max-h-48" />
              </div>

              {existingOcr && (
                <div className="text-left text-xs bg-white border border-border/20 p-3 rounded-lg space-y-1.5 font-normal text-text-muted">
                  {existingOcr.referenceNumber && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Reference No:</span>
                      <span className="font-semibold text-text-primary font-mono">{existingOcr.referenceNumber}</span>
                    </div>
                  )}
                  {existingOcr.amount && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Amount Detected:</span>
                      <span className="font-semibold text-text-primary">₱{existingOcr.amount}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Verification Mode:</span>
                    <span className="font-semibold text-text-primary font-mono text-[10px] bg-gray-50 border px-1.5 py-0.5 rounded uppercase">
                      {existingTransaction.status === 'VERIFIED' ? 'Auto-Verified' : 'Manual Audit Pending'}
                    </span>
                  </div>
                  {existingTransaction.status !== 'VERIFIED' && (
                    <p className="text-[10px] text-text-muted mt-2 border-t pt-1.5 font-normal leading-relaxed">
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
                className="flex-1 py-2 text-xs font-semibold rounded-button border border-border text-text-primary bg-white hover:bg-app-page transition-all flex items-center justify-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> View Receipt
              </a>
              <Button
                onClick={triggerFileInput}
                variant="outline"
                className="flex-1 text-xs border border-border text-text-primary hover:bg-app-page flex items-center justify-center gap-1.5"
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
            />
          </div>
        )}

        {/* OCR Result View immediately after upload */}
        {ocrResult && !isUploading && !isProcessingOcr && !existingReceiptUrl && (
          <div className="p-4 rounded-xl border space-y-4 animate-in fade-in zoom-in-95 duration-200 text-left bg-white shadow-sm border-border/80">
            {ocrResult.autoVerified ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-700 text-xs font-bold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Receipt Submitted & Verified</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed font-normal">
                  Our system auto-verified your payment details. Parish staff will now begin processing your requested document.
                </p>
                <div className="bg-app-page border border-border/20 p-3.5 rounded-lg space-y-1.5 text-xs font-normal text-text-muted">
                  {ocrResult.referenceNumber && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Reference Number:</span>
                      <span className="font-semibold text-text-primary font-mono">{ocrResult.referenceNumber}</span>
                    </div>
                  )}
                  {ocrResult.amount && (
                    <div>
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Amount Detected:</span>
                      <span className="font-semibold text-text-primary">₱{ocrResult.amount}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-blue-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span>Receipt Uploaded & Awaiting Review</span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed font-normal">
                  Your receipt proof was received successfully but requires a manual audit by parish staff (confidence check threshold).
                </p>
                <div className="bg-app-page border border-border/20 p-3.5 rounded-lg text-xs font-normal text-text-muted space-y-1.5">
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Next Steps:</span>
                    <span className="font-semibold text-text-primary">Awaiting manual approval</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider mr-1.5">Notification:</span>
                    <span className="font-semibold text-text-primary">You will be notified once verified</span>
                  </div>
                </div>
              </div>
            )}
            
            <Button onClick={removeFile} variant="outline" className="w-full text-xs">
              Upload Another Receipt
            </Button>
          </div>
        )}

        {/* Upload states: Progress bars */}
        {isUploading && (
          <div className="p-6 border border-border/40 rounded-xl bg-app-page/50 text-center space-y-4">
            <span className="text-xs font-semibold text-text-primary animate-pulse">Uploading Receipt...</span>
            <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden shadow-inner">
              <div
                className="bg-crimson h-2 rounded-full transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <span className="text-xs font-mono font-bold text-text-primary block">{uploadProgress}%</span>
          </div>
        )}

        {/* OCR running state */}
        {isProcessingOcr && (
          <div className="p-6 border border-border/40 rounded-xl bg-app-page/50 text-center space-y-4 flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-crimson animate-spin" />
            <span className="text-xs font-semibold text-text-primary animate-pulse mt-2">Running OCR Verification...</span>
            <p className="text-[10px] text-text-muted max-w-xs font-normal">
              Extracting transaction details, reference number, and amount proof.
            </p>
          </div>
        )}

        {/* Drag & drop upload area */}
        {!file && !existingReceiptUrl && !ocrResult && !isUploading && !isProcessingOcr && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={triggerFileInput}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center gap-2.5 ${
              isDragging
                ? 'border-crimson bg-red-50/10 scale-98'
                : 'border-border/80 hover:border-crimson hover:bg-red-50/5'
            }`}
          >
            <UploadCloud className="w-10 h-10 text-text-muted/60" />
            <div>
              <span className="text-xs font-semibold text-text-primary">Drag &amp; drop receipt here</span>
              <p className="text-[10px] text-text-muted mt-1 font-normal">or click to browse from files</p>
            </div>
            <span className="text-[9px] text-text-muted/80 bg-app-page px-2 py-0.5 rounded-full border border-border/20 font-normal">
              Supports PNG, JPG, JPEG, WEBP (Max 10 MB)
            </span>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
            />
          </div>
        )}

        {/* File Preview area after selection */}
        {file && previewUrl && !ocrResult && !isUploading && !isProcessingOcr && (
          <div className="border border-border/60 rounded-xl p-4 bg-app-page/30 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <Image className="w-4 h-4 text-text-muted" /> Selected Preview
              </span>
              <button
                onClick={removeFile}
                className="p-1 text-text-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                aria-label="Remove File"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="border border-border/60 rounded-lg overflow-hidden max-h-48 flex justify-center bg-gray-900 shadow-inner">
              <img src={previewUrl} alt="Receipt preview" className="object-contain max-h-48" />
            </div>

            <div className="flex items-center justify-between text-[10px] text-text-muted font-normal bg-white p-2 rounded-lg border border-border/20">
              <span className="truncate max-w-[200px]" title={file.name}>{file.name}</span>
              <span className="font-semibold font-mono">{formatBytes(file.size)}</span>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={uploadReceipt}
                className="flex-1 text-xs bg-crimson hover:bg-crimson-dark text-white font-semibold flex items-center justify-center gap-1.5"
              >
                Submit Receipt
              </Button>
              <Button
                onClick={triggerFileInput}
                variant="outline"
                className="flex-1 text-xs border border-border text-text-primary hover:bg-app-page"
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
