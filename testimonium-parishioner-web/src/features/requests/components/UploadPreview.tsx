import React from 'react';
import { FileCard } from './FileCard';

interface UploadPreviewProps {
  files: Array<{ name: string; size?: number; progress?: number; id: string }>;
  onRemove?: (id: string) => void;
}

export const UploadPreview: React.FC<UploadPreviewProps> = ({ files, onRemove }) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-xs font-bold text-text-primary">Selected Files:</span>
      <div className="space-y-2">
        {files.map((file) => (
          <FileCard
            key={file.id}
            name={file.name}
            size={file.size}
            progress={file.progress}
            onRemove={() => onRemove && onRemove(file.id)}
          />
        ))}
      </div>
    </div>
  );
};
export default UploadPreview;
