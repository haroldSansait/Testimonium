import React from 'react';
import { FileText, X } from 'lucide-react';
import { UploadProgress } from './UploadProgress';

interface FileCardProps {
  name: string;
  size?: number;
  progress?: number;
  onRemove?: () => void;
}

export const FileCard: React.FC<FileCardProps> = ({ name, size, progress, onRemove }) => {
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col p-3 bg-app-page border border-border/50 rounded-button text-xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5 truncate">
          <FileText size={16} className="text-crimson flex-shrink-0" />
          <div className="truncate">
            <p className="font-medium text-text-primary truncate">{name}</p>
            {size !== undefined && <p className="text-[10px] text-text-muted mt-0.5">{formatSize(size)}</p>}
          </div>
        </div>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 text-text-muted hover:text-status-rejected rounded-full hover:bg-border/40 transition-colors focus-ring"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {progress !== undefined && progress < 100 && (
        <UploadProgress progress={progress} />
      )}
    </div>
  );
};
export default FileCard;
