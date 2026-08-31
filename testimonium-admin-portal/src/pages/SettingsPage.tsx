import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Save,
  Check,
  AlertCircle,
  Clock,
  FileText,
  CalendarDays,
  QrCode,
  Upload,
  Trash2,
  Image as ImageIcon,
  RotateCcw,
  AlertTriangle,
  Plus,
  X,
  Sliders,
  Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { PageHeader } from '@/components/ui/PageHeader';
import { ParishManagementService } from '@/services/ParishManagementService';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  SchedulingAvailabilityEditor,
  type SchedulingAvailabilityEditorHandle,
} from '@/components/settings/SchedulingAvailabilityEditor';

import {
  CANONICAL_DOCUMENT_TYPES,
  DEFAULT_OFFERED_DOCUMENTS,
} from '@/config/documents';
import { cn } from '@/utils/cn';
import { CANONICAL_SCHEDULING_SERVICES } from '@/utils/schedulingAvailabilityHelpers';
import type { Parish } from '@/types';

// Event types and possible requirements
const EVENT_TYPES = [
  { id: 'WEDDING', label: 'Marriage (Canonical Interview)', possibleReqs: [{ id: 'cenomar', label: 'CENOMAR' }, { id: 'marriage_license', label: 'Marriage License' }, { id: 'baptismal_cert', label: 'Baptismal Certificate' }] },
  { id: 'MARRIAGE_SPECIAL', label: 'Marriage (Special)', possibleReqs: [{ id: 'cenomar', label: 'CENOMAR' }, { id: 'marriage_license', label: 'Marriage License' }, { id: 'baptismal_cert', label: 'Baptismal Certificate' }] },
  { id: 'WAKE_MASS', label: 'Wake Mass', possibleReqs: [{ id: 'death_cert', label: 'Death Certificate' }] },
  { id: 'FUNERAL', label: 'Funeral', possibleReqs: [{ id: 'death_cert', label: 'Death Certificate' }] },
  { id: 'PRIVATE_MASS', label: 'Private Mass', possibleReqs: [] },
  { id: 'MASS_INTENTION', label: 'Mass Intention', possibleReqs: [] },
  { id: 'ANOINTING_OF_THE_SICK', label: 'Anointing of the Sick', possibleReqs: [] },
  { id: 'FIESTA', label: 'Fiesta', possibleReqs: [] },
  { id: 'BLESSING', label: 'Blessing', possibleReqs: [] },
  { id: 'DELIVERANCE', label: 'Deliverance', possibleReqs: [] },
  { id: 'THANKSGIVING', label: 'Thanksgiving', possibleReqs: [] },
  { id: 'FIRST_COMMUNION', label: 'First Communion', possibleReqs: [] },
  { id: 'MASS_OF_HOLY_SPIRIT', label: 'Mass of the Holy Spirit', possibleReqs: [] },
  { id: 'CONFIRMATION', label: 'Confirmation', possibleReqs: [{ id: 'baptismal_cert', label: 'Baptismal Certificate' }] },
  { id: 'CONFESSION', label: 'Confession', possibleReqs: [] },
  { id: 'BAPTISM', label: 'Baptism', possibleReqs: [{ id: 'marriage_cert', label: 'Marriage Certificate' }, { id: 'birth_cert', label: 'Birth Certificate / Immunization Card' }] }
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Time conversion helpers
function to24Hour(time12h?: string): string {
  if (!time12h) return '08:00';
  const clean = time12h.trim().toUpperCase();
  const match = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return '08:00';
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const ampm = match[3];
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function to12Hour(time24h: string): string {
  if (!time24h) return '08:00 AM';
  const [hStr, mStr] = time24h.split(':');
  let hour = parseInt(hStr, 10);
  const minute = mStr || '00';
  if (isNaN(hour)) return '08:00 AM';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
}

function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

interface ParishConfigSnapshot {
  documentSettings: any;
  eventSettings: any;
  officeHours: any;
  availableDocuments: string[];
  paymentQrEnabled: boolean;
  paymentQrImage: string | null;
  venueCapacity: number | null;
}

export function SettingsPage() {
  const { role, applicationUser } = useAuth();
  const canEditScheduling = role === 'SECRETARY' || role === 'DIOCESE_COORDINATOR';
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [selectedParishId, setSelectedParishId] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'documents' | 'events' | 'hours' | 'qr'>('documents');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Configuration States
  const [documentSettings, setDocumentSettings] = useState<any>({});
  const [eventSettings, setEventSettings] = useState<any>({});
  const [officeHours, setOfficeHours] = useState<Record<string, { openTime: string; closeTime: string; isClosed: boolean }>>({});
  const [paymentQrImage, setPaymentQrImage] = useState<string | null>(null);
  const [paymentQrEnabled, setPaymentQrEnabled] = useState<boolean>(false);
  const [availableDocuments, setAvailableDocuments] = useState<string[]>([...DEFAULT_OFFERED_DOCUMENTS]);
  const [venueCapacity, setVenueCapacity] = useState<number | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [schedulingRulesDirty, setSchedulingRulesDirty] = useState(false);
  const schedulingEditorRef = useRef<SchedulingAvailabilityEditorHandle>(null);

  const handleSchedulingDirtyChange = useCallback((dirty: boolean) => {
    setSchedulingRulesDirty(dirty);
  }, []);

  const handleSchedulingToastMessage = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  // Original snapshot for change detection
  const [originalSnapshot, setOriginalSnapshot] = useState<ParishConfigSnapshot | null>(null);
  const [pendingParishId, setPendingParishId] = useState<string | null>(null);
  const [showSwitchConfirmModal, setShowSwitchConfirmModal] = useState(false);
  const loadedParishIdRef = useRef<string | null>(null);

  const parseOfficeHours = useCallback((rawHours: any) => {
    if (!rawHours) return {};
    let obj: any = rawHours;
    if (typeof rawHours === 'string') {
      try {
        obj = JSON.parse(rawHours);
      } catch {
        return {};
      }
    }
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return obj;
    }
    return {};
  }, []);

  // Initialize document settings default configurations
  const initDefaultDocSettings = useCallback(() => {
    const docs: any = {
      paymentMethods: { gcash: true, maya: false }
    };
    CANONICAL_DOCUMENT_TYPES.forEach(doc => {
      const reqs: any = {};
      doc.requirements.forEach(r => {
        reqs[r.id] = true;
      });
      docs[doc.id] = {
        price: doc.defaultPrice,
        requirements: reqs
      };
    });
    return docs;
  }, []);

  // Fetch parishes
  useEffect(() => {
    async function loadParishes() {
      setLoading(true);
      try {
        const list = await ParishManagementService.getParishes();
        setParishes(list);

        if (role === 'SECRETARY' && applicationUser?.parishId) {
          setSelectedParishId(String(applicationUser.parishId));
        } else if (list.length > 0) {
          setSelectedParishId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load parishes:', err);
        setToast({ message: 'Failed to load parishes directory.', type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    void loadParishes();
  }, [role, applicationUser]);

  // Load parish configurations when parish selection changes
  useEffect(() => {
    if (!selectedParishId || parishes.length === 0) return;
    if (loadedParishIdRef.current === selectedParishId) return;

    const parish = parishes.find(p => p.id === selectedParishId) || null;

    if (parish) {
      loadedParishIdRef.current = selectedParishId;
      const docSettingsMerged = parish.documentSettings || initDefaultDocSettings();
      if (!docSettingsMerged.paymentMethods) {
        docSettingsMerged.paymentMethods = { gcash: true, maya: false };
      }
      const evSettingsMerged = parish.eventSettings && typeof parish.eventSettings === 'object'
        ? parish.eventSettings
        : {};
      const parsedHours = parseOfficeHours(parish.officeHours);
      const parsedDocs = parish.availableDocuments && Array.isArray(parish.availableDocuments)
        ? parish.availableDocuments
        : [...DEFAULT_OFFERED_DOCUMENTS];
      const qrEnabled = Boolean(parish.paymentQrEnabled);
      const qrImage = parish.paymentQrImage || null;
      const capacity = parish.venueCapacity !== undefined && parish.venueCapacity !== null ? Number(parish.venueCapacity) : null;

      setDocumentSettings(docSettingsMerged);
      setEventSettings(evSettingsMerged);
      setOfficeHours(parsedHours);
      setPaymentQrImage(qrImage);
      setPaymentQrEnabled(qrEnabled);
      setAvailableDocuments(parsedDocs);
      setVenueCapacity(capacity);

      // Snapshot for unsaved changes detection
      setOriginalSnapshot({
        documentSettings: docSettingsMerged,
        eventSettings: evSettingsMerged,
        officeHours: parsedHours,
        availableDocuments: parsedDocs,
        paymentQrEnabled: qrEnabled,
        paymentQrImage: qrImage,
        venueCapacity: capacity,
      });
      (window as any).hasUnsavedSettingsChanges = false;
    }
  }, [selectedParishId, parishes, initDefaultDocSettings, parseOfficeHours]);

  // Determine dirty state using deep comparison
  const isDirty = useMemo(() => {
    if (!originalSnapshot) return false;
    const currentSnapshot: ParishConfigSnapshot = {
      documentSettings,
      eventSettings,
      officeHours,
      availableDocuments,
      paymentQrEnabled,
      paymentQrImage,
      venueCapacity,
    };
    return JSON.stringify(currentSnapshot) !== JSON.stringify(originalSnapshot) || schedulingRulesDirty;
  }, [originalSnapshot, documentSettings, eventSettings, officeHours, availableDocuments, paymentQrEnabled, paymentQrImage, venueCapacity, schedulingRulesDirty]);

  // Browser refresh/close guard & sync window flag
  useUnsavedChanges({ isDirty });

  // Clean up global window flag on unmount
  useEffect(() => {
    return () => {
      (window as any).hasUnsavedSettingsChanges = false;
    };
  }, []);

  // Discard changes
  const handleDiscardChanges = () => {
    if (!originalSnapshot) return;
    setDocumentSettings(JSON.parse(JSON.stringify(originalSnapshot.documentSettings)));
    setEventSettings(JSON.parse(JSON.stringify(originalSnapshot.eventSettings)));
    setOfficeHours(JSON.parse(JSON.stringify(originalSnapshot.officeHours)));
    setAvailableDocuments([...originalSnapshot.availableDocuments]);
    setPaymentQrEnabled(originalSnapshot.paymentQrEnabled);
    setPaymentQrImage(originalSnapshot.paymentQrImage);
    setVenueCapacity(originalSnapshot.venueCapacity ?? null);
    schedulingEditorRef.current?.reset();
    (window as any).hasUnsavedSettingsChanges = false;
    setToast({ message: 'Unsaved changes discarded.', type: 'success' });
  };

  // Parish selector switch with guard
  const handleParishSelectChange = (newParishId: string) => {
    if (newParishId === selectedParishId) return;
    if (isDirty) {
      setPendingParishId(newParishId);
      setShowSwitchConfirmModal(true);
    } else {
      loadedParishIdRef.current = null;
      setSelectedParishId(newParishId);
    }
  };

  const handleConfirmSwitchParish = () => {
    if (pendingParishId) {
      loadedParishIdRef.current = null;
      setSelectedParishId(pendingParishId);
      setPendingParishId(null);
    }
    setShowSwitchConfirmModal(false);
  };

  const handleToggleAvailableDocument = (docType: string) => {
    setAvailableDocuments((prev) => {
      if (prev.includes(docType)) {
        return prev.filter((d) => d !== docType);
      } else {
        return [...prev, docType];
      }
    });
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedParishId) return;

    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: 'File size exceeds 2 MB limit.', type: 'error' });
      return;
    }

    setUploadingQr(true);
    try {
      const updatedParish = await ParishManagementService.uploadPaymentQr(selectedParishId, file);
      setPaymentQrImage(updatedParish.paymentQrImage || null);
      setPaymentQrEnabled(true);
      // Update parish cache silently without resetting originalSnapshot so dirty state remains active
      setParishes((prev) => prev.map((p) => (p.id === selectedParishId ? { ...p, paymentQrImage: updatedParish.paymentQrImage, paymentQrEnabled: true } : p)));
      setToast({ message: 'Payment QR uploaded. Remember to save your settings to apply changes.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setToast({ message: err?.message || 'Failed to upload Payment QR image.', type: 'error' });
    } finally {
      setUploadingQr(false);
      e.target.value = '';
    }
  };

  const handleDeleteQr = () => {
    setPaymentQrImage(null);
    setPaymentQrEnabled(false);
    setToast({ message: 'Payment QR removed. Save your settings to apply changes.', type: 'success' });
  };

  // Dismiss Toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const handlePriceChange = (docId: string, price: number) => {
    setDocumentSettings((prev: any) => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        price: isNaN(price) ? 0 : price
      }
    }));
  };

  const handleDocRequirementToggle = (docId: string, reqId: string) => {
    setDocumentSettings((prev: any) => {
      const doc = prev[docId] || { price: 0, requirements: {} };
      const reqs = { ...doc.requirements };
      reqs[reqId] = !reqs[reqId];
      return {
        ...prev,
        [docId]: {
          ...doc,
          requirements: reqs
        }
      };
    });
  };

  const handleEventRequirementToggle = (evtId: string, reqId: string) => {
    setEventSettings((prev: any) => {
      const evt = prev[evtId] || { requirements: {} };
      const reqs = { ...evt.requirements };
      reqs[reqId] = !reqs[reqId];
      return {
        ...prev,
        [evtId]: {
          requirements: reqs
        }
      };
    });
  };

  const handleToggleAvailableEvent = (eventId: string) => {
    setEventSettings((prev: any) => {
      const currentList: string[] = Array.isArray(prev?.availableEvents) ? prev.availableEvents : EVENT_TYPES.map(e => e.id);
      const updated = currentList.includes(eventId)
        ? currentList.filter(id => id !== eventId)
        : [...currentList, eventId];
      return {
        ...prev,
        availableEvents: updated,
      };
    });
  };

  const handleCapacityChange = (field: 'slotCapacity' | 'dailyLimit', value: number) => {
    setEventSettings((prev: any) => ({
      ...prev,
      capacitySettings: {
        ...prev?.capacitySettings,
        [field]: Math.max(1, value || 1),
      }
    }));
  };

  const [newSlotInput, setNewSlotInput] = useState('');

  const handleTimeSlotAdd = () => {
    const clean = to12Hour(to24Hour(newSlotInput));
    if (!clean) return;
    setEventSettings((prev: any) => {
      const currentSlots: string[] = Array.isArray(prev?.timeSlots) ? prev.timeSlots : [];
      if (currentSlots.includes(clean)) return prev;
      return {
        ...prev,
        timeSlots: [...currentSlots, clean].sort((a, b) => (parseTimeToMinutes(a) || 0) - (parseTimeToMinutes(b) || 0)),
      };
    });
    setNewSlotInput('');
  };

  const handleTimeSlotRemove = (slotToRemove: string) => {
    setEventSettings((prev: any) => {
      const currentSlots: string[] = Array.isArray(prev?.timeSlots) ? prev.timeSlots : [];
      return {
        ...prev,
        timeSlots: currentSlots.filter(s => s !== slotToRemove),
      };
    });
  };

  const handleOfficeHoursChange = (day: string, field: 'openTime' | 'closeTime' | 'isClosed', value: any) => {
    setOfficeHours((prev: any) => {
      const baseObj = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : parseOfficeHours(prev);
      const dayConf = baseObj[day] || { openTime: '', closeTime: '', isClosed: true };
      return {
        ...baseObj,
        [day]: {
          ...dayConf,
          [field]: value
        }
      };
    });
  };

  // Validate Office Hours
  const validateOfficeHours = (): string | null => {
    for (const day of DAYS_OF_WEEK) {
      const conf = officeHours[day];
      if (conf && !conf.isClosed) {
        const openMin = parseTimeToMinutes(conf.openTime);
        const closeMin = parseTimeToMinutes(conf.closeTime);
        if (openMin === null || closeMin === null) {
          return `${day}: Please select valid opening and closing times.`;
        }
        if (openMin >= closeMin) {
          return `${day}: Opening time (${conf.openTime}) must be earlier than closing time (${conf.closeTime}).`;
        }
      }
    }
    return null;
  };

  const handleSaveSettings = async () => {
    if (!selectedParishId) return;
    if (canEditScheduling && !schedulingEditorRef.current) {
      setToast({ message: 'Scheduling availability is still loading. Wait for it to finish before saving.', type: 'error' });
      return;
    }

    if (canEditScheduling && schedulingEditorRef.current?.hasUnsavedDateException()) {
      setToast({
        message: 'You have an unsaved Date Exception draft. Please Save Exception or Cancel it before saving parish configurations.',
        type: 'error',
      });
      schedulingEditorRef.current.focusDateExceptionForm?.();
      return;
    }

    // Validate Office Hours
    const hoursError = validateOfficeHours();
    if (hoursError) {
      setToast({ message: hoursError, type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const updatedParish = await ParishManagementService.editParishSettings(selectedParishId, {
        documentSettings,
        availableDocuments,
        paymentQrEnabled,
        paymentQrImage,
        venueCapacity,
      });
      if (canEditScheduling) {
        await schedulingEditorRef.current!.save(eventSettings, officeHours);
      }

      const updatedDocs = updatedParish?.availableDocuments && Array.isArray(updatedParish.availableDocuments)
        ? updatedParish.availableDocuments
        : availableDocuments;

      // Update local cache
      setParishes(prev => prev.map(p => p.id === selectedParishId ? { 
        ...p, 
        documentSettings, 
        eventSettings, 
        officeHours, 
        availableDocuments: updatedDocs, 
        paymentQrEnabled,
        paymentQrImage,
        venueCapacity,
      } : p));
      
      // Update snapshot to establish clean baseline
      setOriginalSnapshot({
        documentSettings,
        eventSettings,
        officeHours,
        availableDocuments: updatedDocs,
        paymentQrEnabled,
        paymentQrImage,
        venueCapacity,
      });
      (window as any).hasUnsavedSettingsChanges = false;

      setToast({ message: 'Parish configuration saved successfully.', type: 'success' });
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      if (err?.status === 409 && err?.code === 'SCHEDULING_CONFIG_STALE') {
        try {
          const latestParishes = await ParishManagementService.getParishes();
          loadedParishIdRef.current = null;
          setParishes(latestParishes);
        } catch {
          // Keep the original conflict as the actionable error.
        }
      }
      setToast({ message: err?.message || 'Failed to update parish configurations.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Parish Settings" subtitle="Configure pricing, scheduling requirements, and office availability." />
        <div className="bg-white border border-gray-200 rounded-xl h-60 animate-pulse" />
      </div>
    );
  }

  const isCoordinator = role === 'DIOCESE_COORDINATOR';
  const selectedParish = parishes.find((p) => p.id === selectedParishId);
  const pendingParish = parishes.find((p) => p.id === pendingParishId);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Parish Settings"
        subtitle="Manage configurations for sacraments, documents, fees, and office operating hours."
        actions={
          <button
            onClick={() => void handleSaveSettings()}
            disabled={saving || !selectedParishId || !isDirty}
            className="flex items-center gap-2 px-5 py-2.5 bg-crimson-700 hover:bg-crimson-800 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configurations'}
          </button>
        }
      />

      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">You have unsaved changes</p>
              <p className="text-xs text-amber-700">
                Changes made to <span className="font-semibold">{selectedParish?.name || 'this parish'}</span> have not been saved yet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardChanges}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard
            </button>
            <button
              onClick={() => void handleSaveSettings()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Now'}
            </button>
          </div>
        </div>
      )}

      {/* Parish Selector (Diocese Coordinator Only) */}
      {isCoordinator && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-1">
              Active Configuration Target
            </span>
            <h3 className="text-lg font-bold text-gray-900 font-serif">
              {selectedParish?.name || 'Select a Parish'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Diocese Coordinators can configure fees, requirements, and office hours across all parishes.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="parish-selector" className="text-xs font-semibold text-gray-600 whitespace-nowrap">
              Switch Parish:
            </label>
            <select
              id="parish-selector"
              value={selectedParishId}
              onChange={(e) => handleParishSelectChange(e.target.value)}
              className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 font-medium min-w-[240px]"
            >
              {parishes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Settings Container */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('documents')}
            className={cn(
              'flex items-center gap-2 px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer',
              activeTab === 'documents'
                ? 'border-crimson-700 text-crimson-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
            )}
          >
            <FileText className="w-4 h-4" />
            Document Pricing & Requirements
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={cn(
              'flex items-center gap-2 px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer',
              activeTab === 'events'
                ? 'border-crimson-700 text-crimson-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
            )}
          >
            <CalendarDays className="w-4 h-4" />
            Sacramental Scheduling
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={cn(
              'flex items-center gap-2 px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer',
              activeTab === 'hours'
                ? 'border-crimson-700 text-crimson-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
            )}
          >
            <Clock className="w-4 h-4" />
            Office Operating Hours
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={cn(
              'flex items-center gap-2 px-6 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap cursor-pointer',
              activeTab === 'qr'
                ? 'border-crimson-700 text-crimson-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-white/50'
            )}
          >
            <QrCode className="w-4 h-4" />
            Payment QR Code
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {/* Tab 1: Document Pricing & Requirements */}
          {activeTab === 'documents' && (
            <div className="space-y-8">
              {/* 1. Offered Document Certificates */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900">Offered Document Certificates</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enable or disable specific document certificates issued by this parish. Disabled documents cannot be requested online.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {CANONICAL_DOCUMENT_TYPES.map((doc) => {
                    const isOffered = availableDocuments.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleToggleAvailableDocument(doc.id)}
                        className={cn(
                          'p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none',
                          isOffered
                            ? 'bg-white border-crimson-700/30 shadow-xs'
                            : 'bg-gray-50/70 border-gray-200 opacity-60'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={cn('text-xs font-bold block truncate', isOffered ? 'text-gray-900' : 'text-gray-400')}>
                            {doc.label}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">
                            {isOffered ? 'Offered for issuance' : 'Disabled'}
                          </span>
                        </div>
                        <div
                          className={cn(
                            'w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold transition-all',
                            isOffered ? 'bg-crimson-700 text-white' : 'bg-gray-200 text-transparent'
                          )}
                        >
                          ✓
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Certificate Pricing & Prerequisite Requirements */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div>
                  <h4 className="text-base font-bold text-gray-900">Certificate Pricing & Prerequisite Requirements</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Configure document issuance fees and required prerequisite documents for enabled certificates.
                  </p>
                </div>

                <div className="divide-y divide-gray-200 border border-gray-200 rounded-xl overflow-hidden">
                  {CANONICAL_DOCUMENT_TYPES.filter((doc) => availableDocuments.includes(doc.id)).map((doc) => {
                    const conf = documentSettings[doc.id] || { price: doc.defaultPrice, requirements: {} };
                    return (
                      <div key={doc.id} className="p-4 bg-white hover:bg-gray-50/40 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                          <span className="font-bold text-gray-900 text-sm">{doc.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">Fee (PHP):</span>
                            <input
                              type="number"
                              min="0"
                              step="10"
                              value={conf.price}
                              onChange={(e) => handlePriceChange(doc.id, parseFloat(e.target.value))}
                              className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
                            />
                          </div>
                        </div>

                        <div className="pl-2">
                          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                            Prerequisite Requirements
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {doc.requirements.map((req) => {
                              const isReq = conf.requirements?.[req.id] ?? true;
                              return (
                                <button
                                  key={req.id}
                                  type="button"
                                  onClick={() => handleDocRequirementToggle(doc.id, req.id)}
                                  className={cn(
                                    'px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer',
                                    isReq
                                      ? 'bg-red-50 text-crimson-700 border-crimson-700/20'
                                      : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600'
                                  )}
                                >
                                  {isReq ? '✓ ' : '+ '}
                                  {req.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Sacramental Scheduling */}
          {activeTab === 'events' && (
            <div className={cn('space-y-8', !canEditScheduling && 'pointer-events-none opacity-70')}>
              {/* 1. Offered Sacraments & Scheduling Availability */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-base font-bold text-gray-900">Offered Sacraments & Ceremonies</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enable or disable specific sacraments offered for parishioner online appointment booking. Disabled sacraments cannot be scheduled online.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {EVENT_TYPES.map((evt) => {
                    const availableList: string[] = Array.isArray(eventSettings?.availableEvents) ? eventSettings.availableEvents : [];
                    const isOffered = availableList.includes(evt.id);

                    return (
                      <div
                        key={evt.id}
                        onClick={() => handleToggleAvailableEvent(evt.id)}
                        className={cn(
                          'p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none',
                          isOffered
                            ? 'bg-white border-crimson-700/30 shadow-xs'
                            : 'bg-gray-50/70 border-gray-200 opacity-60'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <span className={cn('text-xs font-bold block truncate', isOffered ? 'text-gray-900' : 'text-gray-400')}>
                            {evt.label}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">
                            {isOffered ? 'Offered for scheduling' : 'Disabled'}
                          </span>
                        </div>
                        <div
                          className={cn(
                            'w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold transition-all',
                            isOffered ? 'bg-crimson-700 text-white' : 'bg-gray-200 text-transparent'
                          )}
                        >
                          ✓
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Concurrency & Capacity Controls */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-crimson-700" />
                  <h4 className="text-base font-bold text-gray-900">Capacity & Concurrency Limits</h4>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Protect parish schedules from overbooking. The backend strictly locks time slots and enforces daily appointment quotas atomically.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-2">
                    <label className="text-xs font-bold text-gray-900 block">
                      Slot Capacity (Per Time Slot)
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Maximum concurrent appointments allowed during the exact same time slot window.
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={eventSettings?.capacitySettings?.slotCapacity ?? ''}
                        onChange={(e) => handleCapacityChange('slotCapacity', parseInt(e.target.value, 10))}
                        className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 outline-none focus:border-crimson-700"
                      />
                      <span className="text-xs text-gray-400 font-medium">appointment(s) / slot</span>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-2">
                    <label className="text-xs font-bold text-gray-900 block">
                      Daily Appointment Limit
                    </label>
                    <p className="text-[11px] text-gray-500">
                      Maximum total confirmed/pending bookings accepted across the entire parish for a single day.
                    </p>
                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={eventSettings?.capacitySettings?.dailyLimit ?? ''}
                        onChange={(e) => handleCapacityChange('dailyLimit', parseInt(e.target.value, 10))}
                        className="w-28 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 outline-none focus:border-crimson-700"
                      />
                      <span className="text-xs text-gray-400 font-medium">appointments / day</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Parish Event & Venue Capacity */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-crimson-700" />
                  <h4 className="text-base font-bold text-gray-900">Parish Event & Venue Capacity</h4>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Maximum number of people the parish church / sanctuary can accommodate for a scheduled event or sacramental celebration.
                </p>

                <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-2 max-w-md">
                  <label className="text-xs font-bold text-gray-900 block">
                    Maximum Venue Capacity
                  </label>
                  <p className="text-[11px] text-gray-500">
                    Informational attendance capacity displayed to parishioners when scheduling appointments and ceremonies.
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      placeholder="e.g. 150"
                      value={venueCapacity ?? ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : Math.max(1, parseInt(e.target.value, 10) || 1);
                        setVenueCapacity(val);
                      }}
                      className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 outline-none focus:border-crimson-700"
                    />
                    <span className="text-xs text-gray-400 font-medium">people / attendees max</span>
                  </div>
                </div>
              </div>

              {/* 4. Configured Time Slots */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-crimson-700" />
                  <h4 className="text-base font-bold text-gray-900">Standard Scheduling Time Slots</h4>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configure the authoritative bookable time slots presented to parishioners on the date picker.
                </p>

                <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(eventSettings?.timeSlots) ? eventSettings.timeSlots : []).map((slot: string) => (
                      <span
                        key={slot}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 text-crimson-700 border border-crimson-700/20 rounded-lg text-xs font-bold"
                      >
                        {slot}
                        <Tooltip content="Remove this bookable time slot" side="top">
                          <button
                            type="button"
                            onClick={() => handleTimeSlotRemove(slot)}
                            className="hover:text-red-900 transition-colors p-0.5 rounded"
                            aria-label={`Remove ${slot} time slot`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </span>
                    ))}

                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="time"
                      step="900"
                      value={newSlotInput}
                      onChange={(e) => setNewSlotInput(e.target.value)}
                      placeholder="Add time slot"
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono outline-none focus:border-crimson-700"
                    />
                    <button
                      type="button"
                      onClick={handleTimeSlotAdd}
                      disabled={!newSlotInput}
                      className="flex items-center gap-1 px-3 py-1.5 bg-crimson-700 hover:bg-crimson-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Slot
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. Prerequisite Documentation Requirements */}
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div>
                  <h4 className="text-base font-bold text-gray-900">Prerequisite Documentation Requirements</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Set mandatory documentation required when parishioners schedule parish sacraments and special masses.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {EVENT_TYPES.map((evt) => {
                    const conf = eventSettings[evt.id] || { requirements: {} };
                    return (
                      <div key={evt.id} className="p-4 bg-white border border-gray-200 rounded-xl space-y-2.5">
                        <span className="font-bold text-gray-900 text-sm block">{evt.label}</span>
                        {evt.possibleReqs.length > 0 ? (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
                              Required Documents
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {evt.possibleReqs.map((req) => {
                                const isReq = conf.requirements?.[req.id] ?? false;
                                return (
                                  <button
                                    key={req.id}
                                    type="button"
                                    onClick={() => handleEventRequirementToggle(evt.id, req.id)}
                                    className={cn(
                                      'px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer',
                                      isReq
                                        ? 'bg-red-50 text-crimson-700 border-crimson-700/20'
                                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:text-gray-600'
                                    )}
                                  >
                                    {isReq ? '✓ ' : '+ '}
                                    {req.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No prerequisite files required for this sacrament.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className={activeTab === 'events' ? '' : 'hidden'}>
            <SchedulingAvailabilityEditor
              ref={schedulingEditorRef}
              parishId={selectedParishId}
              services={CANONICAL_SCHEDULING_SERVICES}
              readOnly={!canEditScheduling}
              onDirtyChange={handleSchedulingDirtyChange}
              onMessage={handleSchedulingToastMessage}
            />
          </div>

          {/* Tab 3: Office Operating Hours (Time Picker with Validation) */}
          {activeTab === 'hours' && (
            <div className={cn('space-y-6', !canEditScheduling && 'pointer-events-none opacity-70')}>
              <div>
                <h4 className="text-base font-bold text-gray-900">Parish Office Operating Hours</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Define daily opening and closing hours. Toggling &quot;Closed&quot; will block document requests and bookings on those days.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-200/60 shadow-sm">
                {DAYS_OF_WEEK.map((day) => {
                  const dayConf = officeHours[day] || { openTime: '', closeTime: '', isClosed: true };
                  return (
                    <div
                      key={day}
                      className={cn(
                        'flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 transition-colors',
                        dayConf.isClosed ? 'bg-gray-50/60' : 'bg-white'
                      )}
                    >
                      <div className="w-32 flex-shrink-0">
                        <span className={cn('text-sm font-bold', dayConf.isClosed ? 'text-gray-400' : 'text-gray-900')}>
                          {day}
                        </span>
                      </div>

                      <div className="flex-1 flex flex-wrap items-center gap-6">
                        {/* Status Checkbox */}
                        <label
                          htmlFor={`hours-closed-${day}`}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            id={`hours-closed-${day}`}
                            checked={!dayConf.isClosed}
                            onChange={(e) => handleOfficeHoursChange(day, 'isClosed', !e.target.checked)}
                            className="w-4.5 h-4.5 accent-crimson-700 text-crimson-700 border-gray-300 focus:ring-crimson-700 rounded cursor-pointer"
                          />
                          <span className={cn('text-xs font-semibold uppercase', dayConf.isClosed ? 'text-gray-400' : 'text-crimson-700')}>
                            {dayConf.isClosed ? 'Office Closed' : 'Office Open'}
                          </span>
                        </label>

                        {/* Open and Close Time Pickers (HTML5 Time Input with step=900) */}
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-xs font-medium', dayConf.isClosed ? 'text-gray-300' : 'text-gray-500')}>
                              Opens:
                            </span>
                            <input
                              type="time"
                              step="900"
                              disabled={dayConf.isClosed}
                              value={to24Hour(dayConf.openTime)}
                              onChange={(e) =>
                                handleOfficeHoursChange(day, 'openTime', to12Hour(e.target.value))
                              }
                              className={cn(
                                'px-3 py-1.5 border rounded-lg text-xs font-mono outline-none transition-all',
                                dayConf.isClosed
                                  ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-60'
                                  : 'bg-white border-gray-250 text-gray-800 focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700'
                              )}
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-xs font-medium', dayConf.isClosed ? 'text-gray-300' : 'text-gray-500')}>
                              Closes:
                            </span>
                            <input
                              type="time"
                              step="900"
                              disabled={dayConf.isClosed}
                              value={to24Hour(dayConf.closeTime)}
                              onChange={(e) =>
                                handleOfficeHoursChange(day, 'closeTime', to12Hour(e.target.value))
                              }
                              className={cn(
                                'px-3 py-1.5 border rounded-lg text-xs font-mono outline-none transition-all',
                                dayConf.isClosed
                                  ? 'bg-gray-100 border-gray-200 text-gray-300 cursor-not-allowed opacity-60'
                                  : 'bg-white border-gray-250 text-gray-800 focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700'
                              )}
                            />
                          </div>

                          {/* Display 12h label badge */}
                          {!dayConf.isClosed && (
                            <span className="text-[11px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                              {dayConf.openTime} – {dayConf.closeTime}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 4: Payment QR Configuration */}
          {activeTab === 'qr' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-gray-900">Parish Payment QR Code</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload a payment QR code image (GCash/Maya/Bank) to display on parishioner document request payment steps.
                </p>
              </div>

              {/* Enable / Disable Toggle */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-gray-900">Enable Payment QR Code</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    When enabled, parishioners will see this QR code during payment submission for document requests.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={paymentQrEnabled}
                    onChange={(e) => setPaymentQrEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-crimson-700"></div>
                </label>
              </div>

              {/* QR Upload & Preview */}
              <div className="p-6 border border-dashed border-gray-300 rounded-xl bg-white flex flex-col items-center justify-center text-center space-y-4">
                {paymentQrImage ? (
                  <div className="space-y-4 flex flex-col items-center">
                    <div className="relative group p-2 border border-gray-200 rounded-xl bg-white shadow-sm">
                      <img
                        src={paymentQrImage}
                        alt="Parish Payment QR"
                        className="w-48 h-48 object-contain rounded-lg"
                      />
                    </div>
                    <div className="flex flex-wrap gap-3 justify-center">
                      <label className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                        <Upload className="w-4 h-4" />
                        {uploadingQr ? 'Uploading...' : 'Replace QR Image'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={handleQrUpload}
                          disabled={uploadingQr}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleDeleteQr}
                        disabled={uploadingQr}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete QR Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 py-4 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-700">No Payment QR uploaded</span>
                      <p className="text-xs text-gray-400 mt-1">Upload a PNG, JPEG, or WEBP image file (Max 2 MB).</p>
                    </div>
                    <label className="flex items-center gap-2 px-5 py-2.5 bg-crimson-700 hover:bg-crimson-800 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors shadow">
                      <Upload className="w-4 h-4" />
                      {uploadingQr ? 'Uploading...' : 'Upload Payment QR'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleQrUpload}
                        disabled={uploadingQr}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Parish Switch Confirmation Modal */}
      {showSwitchConfirmModal && (
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowSwitchConfirmModal(false)}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                Leave without saving?
              </h3>
              <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                You have unsaved changes in <span className="font-semibold text-gray-800">{selectedParish?.name}</span>. Switching to <span className="font-semibold text-gray-800">{pendingParish?.name}</span> will discard your changes.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowSwitchConfirmModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
                >
                  Stay on Page
                </button>
                <button
                  onClick={handleConfirmSwitchParish}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer"
                >
                  Discard & Switch
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in slide-in-from-bottom-4',
            toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          )}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
