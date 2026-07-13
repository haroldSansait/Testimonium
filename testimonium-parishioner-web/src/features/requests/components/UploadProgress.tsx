import React from 'react';

interface UploadProgressProps {
  progress: number;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ progress }) => {
  return (
    <div className="w-full space-y-1">
      <div className="flex justify-between text-[10px] text-text-muted font-mono">
        <span>Uploading...</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-border rounded-full h-1 overflow-hidden">
        <div 
          className="bg-crimson h-full transition-all duration-300" 
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
export default UploadProgress;
