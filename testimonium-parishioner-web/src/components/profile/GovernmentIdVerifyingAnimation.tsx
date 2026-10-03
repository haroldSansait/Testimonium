import React from 'react';
import { CheckCircle2, Shield, ShieldCheck, User } from 'lucide-react';

export const GovernmentIdVerifyingAnimation: React.FC = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Verifying Government ID"
      className="w-full max-w-sm mx-auto flex flex-col items-center justify-center text-center select-none py-2"
    >
      <style>{`
        @keyframes govIdScanSweep {
          0% {
            top: 2px;
            opacity: 0.85;
          }
          50% {
            top: calc(100% - 4px);
            opacity: 1;
          }
          100% {
            top: 2px;
            opacity: 0.85;
          }
        }
        @keyframes govIdFramePulse {
          0%, 100% {
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
        }
        .gov-id-scan-line {
          animation: govIdScanSweep 2.4s ease-in-out infinite;
        }
        .gov-id-frame-pulse {
          animation: govIdFramePulse 2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .gov-id-scan-line {
            animation: none !important;
            top: 50% !important;
            opacity: 0.6 !important;
          }
          .gov-id-frame-pulse {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* Card Silhouette Outer Frame */}
      <div className="relative p-1">
        {/* Scanner Corner Brackets */}
        <div className="absolute inset-0 pointer-events-none gov-id-frame-pulse">
          {/* Top-Left */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-600 rounded-tl-md" />
          {/* Top-Right */}
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-600 rounded-tr-md" />
          {/* Bottom-Left */}
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-600 rounded-bl-md" />
          {/* Bottom-Right */}
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-600 rounded-br-md" />
        </div>

        {/* Stylized ID Card Graphic */}
        <div className="w-[280px] h-[172px] relative rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-sm overflow-hidden flex flex-col justify-between">
          {/* Watermark Emblem */}
          <ShieldCheck
            aria-hidden="true"
            className="w-28 h-28 text-slate-100/90 absolute -right-3 -bottom-3 pointer-events-none"
          />

          {/* Card Header */}
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1 border-b border-slate-100 relative z-0">
            <Shield aria-hidden="true" className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[8px] font-bold text-slate-500 tracking-wider uppercase truncate">
              Republic of the Philippines • ID Card
            </span>
          </div>

          {/* Card Body */}
          <div className="flex gap-3 px-3 py-2 items-center relative z-0">
            {/* Silhouette Photo Area */}
            <div className="w-14 h-[70px] rounded-md bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
              <User aria-hidden="true" className="w-7 h-7 text-slate-300" />
            </div>

            {/* Simulated Data Rows */}
            <div className="flex-1 space-y-1.5 text-left">
              {/* Microchip */}
              <div className="w-6 h-4 rounded bg-amber-100 border border-amber-300 flex items-center justify-center mb-1 shadow-[inset_0_1px_1px_rgba(0,0,0,0.06)]">
                <div className="w-3 h-1.5 border-t border-b border-amber-400" />
              </div>
              <div className="h-2 bg-slate-300/80 rounded w-[85%]" />
              <div className="h-1.5 bg-slate-200 rounded w-[60%]" />
              <div className="h-1.5 bg-slate-200 rounded w-[45%]" />
              <div className="h-1.5 bg-slate-200 rounded w-[75%]" />
            </div>
          </div>

          {/* Card Bottom / Barcode */}
          <div className="px-3 pb-2 pt-1 flex items-center justify-between border-t border-slate-100/80 relative z-0">
            <div className="flex items-center gap-0.5">
              <div className="w-0.5 h-2.5 bg-slate-200 rounded-sm" />
              <div className="w-1 h-2.5 bg-slate-200 rounded-sm" />
              <div className="w-0.5 h-2.5 bg-slate-200 rounded-sm" />
              <div className="w-1.5 h-2.5 bg-slate-200 rounded-sm" />
              <div className="w-0.5 h-2.5 bg-slate-200 rounded-sm" />
              <div className="w-1 h-2.5 bg-slate-200 rounded-sm" />
              <div className="w-1.5 h-2.5 bg-slate-200 rounded-sm" />
            </div>
            <div className="flex items-center gap-1 text-[9px] font-medium text-slate-400">
              <CheckCircle2 aria-hidden="true" className="w-2.5 h-2.5 text-emerald-500" />
              <span>Official Card</span>
            </div>
          </div>

          {/* Animated Sweeping Scan Beam & Radiant Trail */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
            <div className="gov-id-scan-line absolute left-0 right-0 pointer-events-none">
              {/* Soft Radiant Trail */}
              <div className="h-8 -mt-8 bg-gradient-to-t from-emerald-500/15 to-transparent w-full" />
              {/* Scan Line */}
              <div className="h-[2px] bg-emerald-500 shadow-[0_0_8px_#10B981,0_0_3px_#34D399] w-full" />
              {/* Soft Leading Light */}
              <div className="h-2 bg-gradient-to-b from-emerald-500/15 to-transparent w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Status Typography */}
      <h3 className="text-sm font-semibold text-text-primary mt-3.5 tracking-tight">
        Verifying your Government ID
      </h3>
      <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-xs">
        Please wait while TESTIMONIUM checks the submitted ID.
      </p>
      <p className="text-[11px] text-slate-400 mt-0.5">
        Please keep this page open while we securely verify your details.
      </p>

      {/* Indeterminate Activity Badge */}
      <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-medium">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
        </span>
        <span>Securely checking ID details…</span>
      </div>
    </div>
  );
};
