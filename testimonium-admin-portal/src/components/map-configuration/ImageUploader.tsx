import { useState, useRef, useEffect } from 'react';
import { Upload, ImageIcon, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ImageUploaderProps {
  label: string;
  currentUrl?: string;
  aspectRatio: 'cover' | 'logo'; // cover = 16:9, logo = 1:1
  onUploadSuccess: (url: string) => void;
  onUploadStart?: () => void;
  onUploadError?: (err: string) => void;
  uploadFn: (file: File) => Promise<{ url: string }>;
}

export function ImageUploader({
  label,
  currentUrl,
  aspectRatio,
  onUploadSuccess,
  onUploadStart,
  onUploadError,
  uploadFn
}: ImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state with prop updates (e.g. parish selection change)
  useEffect(() => {
    setPreviewUrl(currentUrl);
    setError(null);
    setSuccess(false);
  }, [currentUrl]);

  // Client-side image compression using canvas
  const compressImage = (file: File, width: number, height: number): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (e) => {
        const img = new Image();
        img.src = e.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context could not be created'));

          // Draw the image, scaling it to fill target dimensions
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Canvas toBlob generated null'));
              const newName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
              const compressedFile = new File([blob], newName, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            },
            'image/jpeg',
            0.82 // quality level
          );
        };
        img.onerror = () => reject(new Error('Failed to load image object'));
      };
      reader.onerror = () => reject(new Error('Failed to read file reader'));
    });
  };

  const handleFileChange = async (file: File) => {
    setError(null);
    setSuccess(false);

    // Initial validations
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      const msg = 'Invalid file type. Only JPEG, PNG, and WebP are allowed.';
      setError(msg);
      onUploadError?.(msg);
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      const msg = 'File is too large. Max size allowed is 5MB.';
      setError(msg);
      onUploadError?.(msg);
      return;
    }

    setIsUploading(true);
    onUploadStart?.();

    // Create a local blob URL for immediate preview
    const tempUrl = URL.createObjectURL(file);
    setPreviewUrl(tempUrl);

    try {
      // Determine compression target dimensions
      const width = aspectRatio === 'cover' ? 1600 : 512;
      const height = aspectRatio === 'cover' ? 900 : 512;

      // Compress client side
      const compressedFile = await compressImage(file, width, height);

      // Perform upload
      const result = await uploadFn(compressedFile);
      setPreviewUrl(result.url);
      setSuccess(true);
      onUploadSuccess(result.url);
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Upload failed.';
      setError(msg);
      // Reset preview to current if failed
      setPreviewUrl(currentUrl);
      onUploadError?.(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
        {label}
      </label>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative border-2 border-dashed rounded-lg overflow-hidden cursor-pointer flex flex-col items-center justify-center transition-all ${
          isUploading
            ? 'border-crimson-700/40 bg-red-50/10'
            : error
            ? 'border-rose-300 bg-rose-50/10 hover:border-rose-400'
            : 'border-gray-200 bg-gray-50/50 hover:border-crimson-700/40 hover:bg-red-50/5'
        }`}
        style={{ aspectRatio: aspectRatio === 'cover' ? '16/9' : '1/1' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
        />

        {previewUrl ? (
          <div className="absolute inset-0 w-full h-full">
            <img
              src={previewUrl}
              alt={label}
              className="w-full h-full object-cover"
            />
            {/* Hover overlay overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Upload className="w-6 h-6 text-white" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2 group-hover:bg-red-50 group-hover:text-crimson-700 transition-colors">
              <ImageIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-gray-600">
              No custom image uploaded
            </span>
            <span className="text-[10px] text-gray-400 mt-1.5 px-4 leading-relaxed">
              No image has been uploaded yet. The parishioner portal is currently using the default parish image. Upload an image to override it.
            </span>
            <span className="text-[10px] text-crimson-700 font-medium mt-2 group-hover:underline">
              Drag image here, or browse
            </span>
          </div>
        )}

        {/* Overlay statuses */}
        {isUploading && (
          <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center z-10">
            <Loader2 className="w-6 h-6 text-crimson-700 animate-spin mb-1" />
            <span className="text-xs font-medium text-crimson-900">Compressing & Uploading...</span>
          </div>
        )}

        {success && (
          <div className="absolute bottom-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow z-10 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-rose-500 bg-rose-50/50 p-1.5 rounded border border-rose-100">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
