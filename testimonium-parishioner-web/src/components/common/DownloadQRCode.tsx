import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export const APK_DOWNLOAD_ENDPOINT_URL = 'https://testimonium.site/download/android';

export interface DownloadQRCodeProps {
  url?: string;
  size?: number;
  className?: string;
  showUrlLabel?: boolean;
  quietZone?: boolean;
}

export const DownloadQRCode: React.FC<DownloadQRCodeProps> = ({
  url = APK_DOWNLOAD_ENDPOINT_URL,
  size = 176,
  className = '',
  showUrlLabel = true,
  quietZone = true
}) => {
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-border shadow-sm flex items-center justify-center">
        <QRCodeSVG
          value={url}
          size={size}
          level="H"
          bgColor="#FFFFFF"
          fgColor="#1A1A1A"
          includeMargin={quietZone}
          title="QR code to download TESTIMONIUM Android APK directly"
        />
      </div>
      {showUrlLabel && (
        <div className="mt-2.5 space-y-1">
          <p className="text-[11px] sm:text-xs text-text-muted">
            Scan with phone camera to download APK directly:
          </p>
          <a
            href={url}
            className="inline-block text-xs sm:text-sm font-semibold text-crimson hover:underline focus-ring rounded font-mono break-all"
            aria-label={`Direct APK download endpoint: ${url}`}
          >
            testimonium.site/download/android
          </a>
        </div>
      )}
    </div>
  );
};

export default DownloadQRCode;
