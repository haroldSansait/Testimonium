import { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Eye, Image, BookOpen, AlertCircle, X } from 'lucide-react';
import { ImageUploader } from './ImageUploader';
import type { Parish } from '@/types';
import { Tooltip } from '@/components/ui/Tooltip';


interface ParishSettingsPanelProps {
  parish: Parish;
  draft: Partial<Parish>;
  onFieldChange: (field: keyof Parish, value: any) => void;
  uploadImageFn: (type: 'cover' | 'logo', file: File) => Promise<{ url: string }>;
  onClose?: () => void;
}

const CURATED_COLORS = [
  { name: 'Maroon', value: '#7B1C2A' },
  { name: 'Crimson', value: '#dc2626' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#0d9488' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' }
];

export function ParishSettingsPanel({
  parish,
  draft,
  onFieldChange,
  uploadImageFn,
  onClose
}: ParishSettingsPanelProps) {
  // Collapsible section states
  const [openSections, setOpenSections] = useState({
    basic: true,
    images: true,
    map: true,
    directory: true
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Get current working values (merge original + drafts)
  const currentLatitude = draft.latitude !== undefined ? draft.latitude : parish.latitude;
  const currentLongitude = draft.longitude !== undefined ? draft.longitude : parish.longitude;
  const currentZoom = draft.mapZoom !== undefined ? draft.mapZoom : (parish.mapZoom ?? 13);
  const currentPinColor = draft.pinColor !== undefined ? draft.pinColor : (parish.pinColor ?? '#7B1C2A');
  const currentShowLabel = draft.showLabel !== undefined ? draft.showLabel : (parish.showLabel ?? true);
  const currentDescription = draft.directoryDescription !== undefined ? draft.directoryDescription : (parish.directoryDescription ?? '');
  const currentContact = draft.contactNumber !== undefined ? draft.contactNumber : (parish.contactNumber ?? '');
  const currentEmail = draft.email !== undefined ? draft.email : (parish.email ?? '');

  const hasUnsavedCoords = draft.latitude !== undefined || draft.longitude !== undefined;

  return (
    <div className="w-full h-full bg-white/90 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-xl flex flex-col overflow-hidden select-none">
      {/* Panel Header */}
      <div className="p-4 border-b border-gray-150 bg-gray-50/75 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <MapPin className="w-4 h-4 text-crimson-700 flex-shrink-0" />
          <div className="overflow-hidden">
            <h2 className="text-xs font-bold text-gray-800">Parish Settings</h2>
            <p className="text-[10px] text-gray-500 truncate max-w-[200px]" title={parish.name}>
              {parish.name}
            </p>
          </div>
        </div>
        {onClose && (
          <Tooltip content="Close settings panel" side="bottom">
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-200/50 active:scale-95 text-gray-400 hover:text-gray-700 rounded-lg transition-all"
              aria-label="Close settings panel"
            >
              <X className="w-4 h-4" />
            </button>
          </Tooltip>
        )}
      </div>


      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {/* SECTION 1: Basic Info */}
        <div className="p-4 space-y-3">
          <button
            onClick={() => toggleSection('basic')}
            className="w-full flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wide"
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-gray-400" />
              Basic Information
            </span>
            {openSections.basic ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openSections.basic && (
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1">Church Name</label>
                <input
                  type="text"
                  value={parish.name}
                  disabled
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-500 font-medium cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Vicariate</label>
                  <input
                    type="text"
                    value={parish.vicariate || 'Vicariate of Canlaon'}
                    disabled
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-500 font-medium cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Status</label>
                  <span className={`inline-flex items-center px-2.5 py-1.5 rounded text-xs font-semibold ${
                    parish.status === 'Active' 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                  }`}>
                    {parish.status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Images */}
        <div className="p-4 space-y-3">
          <button
            onClick={() => toggleSection('images')}
            className="w-full flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wide"
          >
            <span className="flex items-center gap-1.5">
              <Image className="w-4 h-4 text-gray-400" />
              Images & Media
            </span>
            {openSections.images ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openSections.images && (
            <div className="space-y-4 pt-1">
              <ImageUploader
                label="Parish Cover Image (16:9)"
                currentUrl={parish.coverImage}
                aspectRatio="cover"
                onUploadSuccess={(url) => onFieldChange('coverImage', url)}
                uploadFn={(file) => uploadImageFn('cover', file)}
              />
              <ImageUploader
                label="Parish Logo Image (1:1)"
                currentUrl={parish.logoImage}
                aspectRatio="logo"
                onUploadSuccess={(url) => onFieldChange('logoImage', url)}
                uploadFn={(file) => uploadImageFn('logo', file)}
              />
            </div>
          )}
        </div>

        {/* SECTION 3: Map Settings */}
        <div className="p-4 space-y-3">
          <button
            onClick={() => toggleSection('map')}
            className="w-full flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wide"
          >
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-gray-400" />
              Map Configuration
            </span>
            {openSections.map ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openSections.map && (
            <div className="space-y-4 pt-1 text-xs">
              {/* Coordinates fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Latitude</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={currentLatitude !== null && currentLatitude !== undefined ? currentLatitude.toFixed(6) : 'Not set'}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700 font-mono text-[11px] focus:outline-none"
                    />
                    {hasUnsavedCoords && (
                      <span className="absolute right-2 top-2.5 h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-400 block mb-1">Longitude</label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      value={currentLongitude !== null && currentLongitude !== undefined ? currentLongitude.toFixed(6) : 'Not set'}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-700 font-mono text-[11px] focus:outline-none"
                    />
                    {hasUnsavedCoords && (
                      <span className="absolute right-2 top-2.5 h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Map Zoom slider */}
              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-[11px] font-medium text-gray-400">Map Zoom Level</label>
                  <span className="text-[11px] font-bold text-crimson-700">{currentZoom}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={currentZoom ?? 13}
                  onChange={(e) => onFieldChange('mapZoom', parseInt(e.target.value, 10))}
                  className="w-full accent-crimson-700"
                />
              </div>

              {/* Pin Color Predefined Palette */}
              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1.5">Pin Color</label>
                <div className="grid grid-cols-8 gap-2">
                  {CURATED_COLORS.map((col) => (
                    <Tooltip key={col.value} content={`${col.name} pin`} side="top">
                      <button
                        type="button"
                        onClick={() => onFieldChange('pinColor', col.value)}
                        aria-label={`Select ${col.name} pin color`}
                        className={`w-6 h-6 rounded-full border shadow-sm transition-all focus:outline-none ${
                          currentPinColor === col.value
                            ? 'ring-2 ring-offset-2 ring-crimson-700 scale-110 border-transparent'
                            : 'border-gray-200 hover:scale-105'
                        }`}
                        style={{ backgroundColor: col.value }}
                      />
                    </Tooltip>
                  ))}

                </div>
              </div>


              {/* Label visibility toggle */}
              <div className="flex items-center justify-between py-1.5">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block">Show Pin Label</label>
                  <span className="text-[10px] text-gray-400">Display parish name on map</span>
                </div>
                <button
                  type="button"
                  onClick={() => onFieldChange('showLabel', !currentShowLabel)}
                  className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    currentShowLabel ? 'bg-crimson-700' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      currentShowLabel ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: Directory Settings */}
        <div className="p-4 space-y-3">
          <button
            onClick={() => toggleSection('directory')}
            className="w-full flex items-center justify-between text-xs font-bold text-gray-700 uppercase tracking-wide"
          >
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-gray-400" />
              Directory Settings
            </span>
            {openSections.directory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {openSections.directory && (
            <div className="space-y-3 pt-1 text-xs">
              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1">
                  Directory Description
                </label>
                <textarea
                  rows={4}
                  value={currentDescription}
                  onChange={(e) => onFieldChange('directoryDescription', e.target.value)}
                  placeholder="Introduce your parish to the public..."
                  className="w-full px-3 py-2 border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-crimson-700 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1">Contact Number</label>
                <input
                  type="text"
                  value={currentContact}
                  onChange={(e) => onFieldChange('contactNumber', e.target.value)}
                  placeholder="e.g. 09171234567"
                  className="w-full px-3 py-2 border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-crimson-700 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1">Public Email</label>
                <input
                  type="email"
                  value={currentEmail}
                  onChange={(e) => onFieldChange('email', e.target.value)}
                  placeholder="e.g. support@parish.org"
                  className="w-full px-3 py-2 border border-gray-200 rounded text-gray-700 focus:outline-none focus:border-crimson-700 font-medium"
                />
              </div>

              {/* Informational audit trail footer */}
              {parish.locationUpdatedAt && (
                <div className="pt-2 text-[10px] text-gray-400 border-t border-gray-50 flex items-start gap-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-300" />
                  <span>
                    Last updated on {new Date(parish.locationUpdatedAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
