import React, { useState } from 'react';
import { Upload } from 'lucide-react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  disabled?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  accept = '.png,.jpg,.jpeg,.pdf',
  multiple = true,
  maxSizeMB = 5,
  disabled = false,
}) => {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFilesSelected(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
      onClick={() => !disabled && document.getElementById('file-upload-input')?.click()}
      className={`border-2 border-dashed rounded-card p-8 text-center flex flex-col items-center justify-center transition-colors ${
        disabled ? 'bg-gray-50 border-border cursor-not-allowed opacity-60' :
        dragActive ? 'border-crimson bg-red-50/5 cursor-pointer' : 'border-border hover:border-gray-400 cursor-pointer'
      }`}
    >
      <Upload size={32} className="text-text-muted mb-2" />
      <span className="text-sm font-semibold text-text-primary">Drag & drop files here</span>
      <span className="text-xs text-text-muted mt-1">or click to browse files (Max {maxSizeMB}MB)</span>
      <input
        id="file-upload-input"
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
export default FileDropzone;
