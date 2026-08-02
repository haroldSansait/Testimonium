import { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Info, Church, Mail, Phone, Globe, Shield } from 'lucide-react';
import logoUrl from '@/assets/TESTIMONIUM_logo.png';
import packageJson from '../../../package.json';

// ─── Static system information ─────────────────────────────────────────────────

const SYSTEM_INFO = {
  name: 'TESTIMONIUM',
  subtitle: 'Parish Administration and Services Platform',
  version: packageJson.version || '0.0.0',
  buildDate: '2026',
  diocese: 'Diocese of San Carlos',
  vicariate: 'Canlaon Vicariate',
  contact: {
    name: 'Diocese of San Carlos — Canlaon Vicariate Office',
    email: 'vicariate.canlaon@dioceseofsancarlos.ph',
    phone: '+63 (034) 213-0001',
    website: 'https://dioceseofsancarlos.ph',
  },
  privacy:
    'All personal data collected through this platform is processed exclusively for the provision of sacramental and administrative services within the Canlaon Vicariate. Data is stored securely and is not shared with third parties outside of the diocesan administration. In accordance with the Data Privacy Act of 2012 (RA 10173), parishioners may request access to or deletion of their records by contacting the vicariate office.',
  technologies: [
    'React + TypeScript (Admin Portal)',
    'React + TypeScript (Parishioner Web)',
    'Node.js + Express (Backend API)',
    'PostgreSQL via Supabase',
    'Firebase Authentication',
  ],
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── AboutModal ───────────────────────────────────────────────────────────────

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="About TESTIMONIUM"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#7B1C2A] text-white flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Info className="w-5 h-5 opacity-90" />
            <h2 className="text-base font-bold tracking-wide">About TESTIMONIUM</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close about dialog"
            id="about-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Brand section */}
          <div className="flex flex-col items-center text-center px-6 pt-7 pb-5 border-b border-gray-100">
            <img
              src={logoUrl}
              alt="TESTIMONIUM Logo"
              className="w-16 h-16 rounded-full object-cover shadow-md mb-3"
            />
            <h3
              className="text-2xl font-bold text-[#7B1C2A]"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              {SYSTEM_INFO.name}
            </h3>
            <p className="text-xs text-gray-500 mt-1">{SYSTEM_INFO.subtitle}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                v{SYSTEM_INFO.version}
              </span>
              <span className="text-[10px] text-gray-400">•</span>
              <span className="text-[10px] text-gray-500">{SYSTEM_INFO.buildDate}</span>
            </div>
          </div>

          {/* Diocese info */}
          <div className="px-6 py-5 border-b border-gray-100 space-y-3">
            <div className="flex items-start gap-3">
              <Church className="w-4 h-4 text-[#7B1C2A] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Diocese</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{SYSTEM_INFO.diocese}</p>
                <p className="text-xs text-gray-500">{SYSTEM_INFO.vicariate}</p>
              </div>
            </div>
          </div>

          {/* Contact section */}
          <div className="px-6 py-5 border-b border-gray-100 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Vicariate Contact</p>
            <div className="flex items-center gap-3 text-xs text-gray-700">
              <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <a
                href={`mailto:${SYSTEM_INFO.contact.email}`}
                className="hover:text-[#7B1C2A] hover:underline transition-colors"
              >
                {SYSTEM_INFO.contact.email}
              </a>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-700">
              <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{SYSTEM_INFO.contact.phone}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-700">
              <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <a
                href={SYSTEM_INFO.contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#7B1C2A] hover:underline transition-colors"
              >
                {SYSTEM_INFO.contact.website}
              </a>
            </div>
          </div>

          {/* Privacy */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-[#7B1C2A]" />
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data Privacy</p>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">{SYSTEM_INFO.privacy}</p>
          </div>

          {/* Tech stack (collapsed info) */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Platform Stack</p>
            <ul className="space-y-1">
              {SYSTEM_INFO.technologies.map((tech) => (
                <li key={tech} className="flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7B1C2A]/40 flex-shrink-0" />
                  {tech}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 flex-shrink-0 text-center flex-shrink-0">
          <p className="text-[11px] text-gray-400">
            © {SYSTEM_INFO.buildDate} {SYSTEM_INFO.diocese} — {SYSTEM_INFO.vicariate}. All rights reserved.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
