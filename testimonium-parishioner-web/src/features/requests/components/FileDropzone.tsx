import React, { useState, useId } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { UPLOAD_POLICIES, type UploadPolicy, validateUploadFile } from '../../../utils/uploadPolicy';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  policy?: UploadPolicy;
  accept?: string;
  multiple?: boolean;
  maxSizeMB?: number;
  disabled?: boolean;
  id?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  policy = UPLOAD_POLICIES.SUPPORTING_DOCUMENT,
  accept,
  multiple = true,
  maxSizeMB: _maxSizeMB = 5,
  disabled = false,
  id: customId,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const generatedId = useId();
  const inputId = customId || `file-dropzone-input-${generatedId}`;

  const effectiveAccept = accept || policy.acceptAttribute;

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

  const processFiles = (rawFiles: File[]) => {
    setErrorMessage(null);
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of rawFiles) {
      const res = validateUploadFile(file, policy);
      if (res.valid) {
        validFiles.push(file);
      } else if (res.error) {
        errors.push(`${file.name}: ${res.error}`);
      }
    }

    if (errors.length > 0) {
      setErrorMessage(errors.join(' | '));
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      processFiles(files);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && document.getElementById(inputId)?.click()}
        className={`border-2 border-dashed rounded-card p-8 text-center flex flex-col items-center justify-center transition-colors ${
          disabled ? 'bg-gray-50 border-border cursor-not-allowed opacity-60' :
          dragActive ? 'border-crimson bg-red-50/5 cursor-pointer' : 'border-border hover:border-gray-400 cursor-pointer'
        }`}
      >
        <Upload size={32} className="text-text-muted mb-2" />
        <span className="text-xs text-text-muted">
          Drag and drop files here, or click to upload. {policy.label}
        </span>
        <input
          id={inputId}
          type="file"
          multiple={multiple}
          accept={effectiveAccept}
          disabled={disabled}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {errorMessage && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700 animate-in fade-in duration-150" role="alert">
          <AlertCircle size={14} className="shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
export default FileDropzone;
