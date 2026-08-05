import { useState, useEffect } from 'react';
import { Save, Check, AlertCircle, Clock, FileText, CalendarDays, QrCode, Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import { ParishManagementService } from '@/services/ParishManagementService';
import type { Parish } from '@/types';

// Default Document Types and Requirements
const DOC_TYPES = [
  { id: 'BAPTISMAL_CERTIFICATE', label: 'Baptismal Certificate', defaultPrice: 100, requirements: [{ id: 'valid_id', label: 'Valid ID' }] },
  { id: 'CONFIRMATION_CERTIFICATE', label: 'Confirmation Certificate', defaultPrice: 100, requirements: [{ id: 'valid_id', label: 'Valid ID' }] },
  { id: 'MARRIAGE_CERTIFICATE', label: 'Marriage Certificate', defaultPrice: 150, requirements: [{ id: 'valid_id', label: 'Valid ID' }] },
  { id: 'FIRST_COMMUNION_CERTIFICATE', label: 'First Communion Certificate', defaultPrice: 75, requirements: [{ id: 'valid_id', label: 'Valid ID' }] },
  { id: 'MARRIAGE_BANNS', label: 'Marriage Banns', defaultPrice: 200, requirements: [{ id: 'valid_id', label: 'Valid ID' }, { id: 'baptismal_cert', label: 'Baptismal Certificate' }, { id: 'confirmation_cert', label: 'Confirmation Certificate' }, { id: 'marriage_license', label: 'Civil Marriage License' }, { id: 'precana_proof', label: 'Pre-Cana Seminar Certificate' }, { id: 'cenomar', label: 'PSA CENOMAR' }, { id: 'banns_clearance', label: 'Banns Clearance Form' }] },
  { id: 'PERMIT_TO_MARRY', label: 'Permit to Marry', defaultPrice: 150, requirements: [{ id: 'valid_id', label: 'Valid Government ID' }, { id: 'baptismal_cert', label: 'Baptismal Certificate' }, { id: 'confirmation_cert', label: 'Confirmation Certificate' }, { id: 'marriage_license', label: 'Civil Marriage License' }, { id: 'precana_proof', label: 'Pre-Cana Seminar Certificate' }, { id: 'cenomar', label: 'PSA CENOMAR' }, { id: 'canonical_interview', label: 'Canonical Interview Form' }, { id: 'banns_clearance', label: 'Banns Clearance' }] },
  { id: 'STATUS_OF_LIBERTY', label: 'Status of Liberty Certificate', defaultPrice: 150, requirements: [{ id: 'valid_id', label: 'Valid Government ID' }, { id: 'baptismal_cert', label: 'Baptismal Certificate' }, { id: 'cenomar', label: 'PSA CENOMAR' }, { id: 'canonical_interview', label: 'Canonical Interview Document' }] }
];

// Event types and possible requirements
const EVENT_TYPES = [
  { id: 'MARRIAGE_SPECIAL', label: 'Marriage (Special)', possibleReqs: [{ id: 'cenomar', label: 'CENOMAR' }, { id: 'marriage_license', label: 'Marriage License' }, { id: 'baptismal_cert', label: 'Baptismal Certificate' }] },
  { id: 'WAKE_MASS', label: 'Wake Mass', possibleReqs: [{ id: 'death_cert', label: 'Death Certificate' }] },
  { id: 'FUNERAL', label: 'Funeral', possibleReqs: [{ id: 'death_cert', label: 'Death Certificate' }] },
  { id: 'PRIVATE_MASS', label: 'Private Mass', possibleReqs: [] },
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

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export function SettingsPage() {
  const { role, applicationUser } = useAuth();
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [selectedParishId, setSelectedParishId] = useState<string>('');
  
  const [activeTab, setActiveTab] = useState<'documents' | 'events' | 'hours' | 'qr'>('documents');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Configuration States
  const [documentSettings, setDocumentSettings] = useState<any>({});
  const [eventSettings, setEventSettings] = useState<Record<string, { requirements: Record<string, boolean> }>>({});
  const [officeHours, setOfficeHours] = useState<Record<string, { openTime: string; closeTime: string; isClosed: boolean }>>({});
  const [paymentQrImage, setPaymentQrImage] = useState<string | null>(null);
  const [paymentQrEnabled, setPaymentQrEnabled] = useState<boolean>(false);
  const [availableDocuments, setAvailableDocuments] = useState<string[]>([
    'BAPTISMAL_CERTIFICATE',
    'CONFIRMATION_CERTIFICATE',
    'MARRIAGE_CERTIFICATE',
    'FIRST_COMMUNION_CERTIFICATE',
  ]);
  const [uploadingQr, setUploadingQr] = useState(false);

  // Initialize office hours default settings
  const initDefaultOfficeHours = () => {
    const hours: any = {};
    DAYS_OF_WEEK.forEach(day => {
      hours[day] = {
        openTime: '08:00 AM',
        closeTime: '05:00 PM',
        isClosed: day === 'Sunday'
      };
    });
    return hours;
  };

  const parseOfficeHours = (rawHours: any) => {
    const defaultHours = initDefaultOfficeHours();
    if (!rawHours) return defaultHours;
    let obj: any = rawHours;
    if (typeof rawHours === 'string') {
      try {
        obj = JSON.parse(rawHours);
      } catch (e) {
        return defaultHours;
      }
    }
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return { ...defaultHours, ...obj };
    }
    return defaultHours;
  };

  // Initialize document settings default configurations
  const initDefaultDocSettings = () => {
    const docs: any = {
      paymentMethods: { gcash: true, maya: false }
    };
    DOC_TYPES.forEach(doc => {
      const reqs: any = {};
      doc.requirements.forEach(r => {
        reqs[r.id] = true; // require all by default
      });
      docs[doc.id] = {
        price: doc.defaultPrice,
        requirements: reqs
      };
    });
    return docs;
  };

  // Initialize event settings default configurations
  const initDefaultEventSettings = () => {
    const evts: any = {};
    EVENT_TYPES.forEach(evt => {
      const reqs: any = {};
      evt.possibleReqs.forEach(r => {
        reqs[r.id] = true;
      });
      evts[evt.id] = {
        requirements: reqs
      };
    });
    return evts;
  };

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
    if (!selectedParishId) return;
    const parish = parishes.find(p => p.id === selectedParishId) || null;

    if (parish) {
      const docSettingsMerged = parish.documentSettings || initDefaultDocSettings();
      if (!docSettingsMerged.paymentMethods) {
        docSettingsMerged.paymentMethods = { gcash: true, maya: false };
      }
      setDocumentSettings(docSettingsMerged);
      setEventSettings(parish.eventSettings || initDefaultEventSettings());
      setOfficeHours(parseOfficeHours(parish.officeHours));
      setPaymentQrImage(parish.paymentQrImage || null);
      setPaymentQrEnabled(Boolean(parish.paymentQrEnabled));
      setAvailableDocuments(
        parish.availableDocuments && Array.isArray(parish.availableDocuments)
          ? parish.availableDocuments
          : ['BAPTISMAL_CERTIFICATE', 'CONFIRMATION_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'FIRST_COMMUNION_CERTIFICATE']
      );
    }
  }, [selectedParishId, parishes]);

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
      setPaymentQrEnabled(Boolean(updatedParish.paymentQrEnabled));
      setParishes((prev) => prev.map((p) => (p.id === selectedParishId ? updatedParish : p)));
      setToast({ message: 'Payment QR uploaded successfully.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setToast({ message: err?.message || 'Failed to upload Payment QR image.', type: 'error' });
    } finally {
      setUploadingQr(false);
    }
  };

  const handleDeleteQr = async () => {
    if (!selectedParishId) return;
    setUploadingQr(true);
    try {
      const updatedParish = await ParishManagementService.deletePaymentQr(selectedParishId);
      setPaymentQrImage(null);
      setPaymentQrEnabled(false);
      setParishes((prev) => prev.map((p) => (p.id === selectedParishId ? updatedParish : p)));
      setToast({ message: 'Payment QR deleted successfully.', type: 'success' });
    } catch (err: any) {
      console.error(err);
      setToast({ message: err?.message || 'Failed to delete Payment QR image.', type: 'error' });
    } finally {
      setUploadingQr(false);
    }
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

  const handleOfficeHoursChange = (day: string, field: 'openTime' | 'closeTime' | 'isClosed', value: any) => {
    setOfficeHours((prev: any) => {
      const baseObj = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : parseOfficeHours(prev);
      const dayConf = baseObj[day] || { openTime: '08:00 AM', closeTime: '05:00 PM', isClosed: false };
      return {
        ...baseObj,
        [day]: {
          ...dayConf,
          [field]: value
        }
      };
    });
  };

  const handleSaveSettings = async () => {
    if (!selectedParishId) return;
    setSaving(true);
    try {
      await ParishManagementService.editParishSettings(selectedParishId, {
        documentSettings,
        eventSettings,
        officeHours,
        availableDocuments,
        paymentQrEnabled,
      });
      // Update local cache
      setParishes(prev => prev.map(p => p.id === selectedParishId ? { ...p, documentSettings, eventSettings, officeHours, availableDocuments, paymentQrEnabled } : p));
      setToast({ message: 'Parish configuration saved successfully.', type: 'success' });
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setToast({ message: err?.message || 'Failed to update parish configurations.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Parish Settings" subtitle="Configure pricing, scheduling requirements, and office availability." />
        <div className="bg-white border border-gray-250 rounded-xl h-60 animate-pulse" />
      </div>
    );
  }

  const isCoordinator = role === 'DIOCESE_COORDINATOR';

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Parish Settings"
        subtitle="Manage configurations for sacraments, documents, fees, and office operating hours."
        actions={
          <button
            onClick={() => void handleSaveSettings()}
            disabled={saving || !selectedParishId}
            className="flex items-center gap-2 px-5 py-2.5 bg-crimson-700 hover:bg-crimson-800 text-white text-sm font-semibold rounded-lg shadow disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configurations'}
          </button>
        }
      />

      {/* Parish Selector (Diocese Coordinator Only) */}
      {isCoordinator && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-gray-900">Manage Parish Context</h3>
            <p className="text-xs text-gray-500">Select which parish's settings you want to modify.</p>
          </div>
          <select
            value={selectedParishId}
            onChange={(e) => setSelectedParishId(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700"
          >
            {parishes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Configurations Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-100 bg-gray-50">
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-crimson-700 text-crimson-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            Document Fees & Requirements
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'events'
                ? 'border-crimson-700 text-crimson-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Event Scheduling Requirements
          </button>
          <button
            onClick={() => setActiveTab('hours')}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'hours'
                ? 'border-crimson-700 text-crimson-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Office Operating Hours
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'qr'
                ? 'border-crimson-700 text-crimson-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100/50'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Payment QR Configuration
          </button>
        </div>

        {/* Configurations Body */}
        <div className="p-6">
          {/* Tab 1: Document settings */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-gray-900">Document Processing Fees & Requirements</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Set prices and check which attachments parishioners must upload to submit a request.
                </p>
              </div>

              {/* Configurable Document Availability */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 space-y-3">
                <div>
                  <span className="text-sm font-bold text-gray-900">Available Sacramental Documents</span>
                  <p className="text-xs text-gray-500 mt-0.5">Select which sacramental document requests are enabled for parishioners in this parish.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {[
                    { id: 'BAPTISMAL_CERTIFICATE', label: 'Baptismal Certificate' },
                    { id: 'CONFIRMATION_CERTIFICATE', label: 'Confirmation Certificate' },
                    { id: 'MARRIAGE_CERTIFICATE', label: 'Marriage Certificate' },
                    { id: 'FIRST_COMMUNION_CERTIFICATE', label: 'First Communion Certificate' },
                  ].map((doc) => {
                    const isEnabled = availableDocuments.includes(doc.id);
                    return (
                      <label key={doc.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={() => handleToggleAvailableDocument(doc.id)}
                          className="w-4 h-4 text-crimson-700 border-gray-300 rounded focus:ring-crimson-700"
                        />
                        <span className="text-xs font-semibold text-gray-800">{doc.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Supported Payment Channels */}
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-sm font-bold text-gray-900">Supported Payment Channels</span>
                  <p className="text-xs text-gray-500 mt-0.5">Toggle available payment options for parishioners. GCash is enabled by default.</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked disabled className="rounded text-crimson-700" />
                    <span className="text-xs font-semibold text-gray-700 uppercase">GCash (Default)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="toggle-maya"
                      checked={!!documentSettings.paymentMethods?.maya}
                      onChange={(e) => {
                        setDocumentSettings((prev: any) => {
                          const methods = prev.paymentMethods || { gcash: true, maya: false };
                          return {
                            ...prev,
                            paymentMethods: {
                              ...methods,
                              maya: e.target.checked
                            }
                          };
                        });
                      }}
                      className="rounded text-crimson-750 focus:ring-crimson-700 cursor-pointer"
                    />
                    <label htmlFor="toggle-maya" className="text-xs font-semibold text-gray-700 uppercase cursor-pointer">PayMaya</label>
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                {DOC_TYPES.map(doc => {
                  const docConf = documentSettings[doc.id] || { price: doc.defaultPrice, requirements: {} };
                  return (
                    <div key={doc.id} className="p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors bg-gray-50/30">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-gray-100/70">
                        <div>
                          <span className="text-sm font-bold text-gray-900">{doc.label}</span>
                          <span className="block text-[10px] font-mono text-gray-400 mt-0.5">{doc.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-gray-500 uppercase">Processing Fee:</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
                            <input
                              type="number"
                              value={docConf.price}
                              onChange={(e) => handlePriceChange(doc.id, parseFloat(e.target.value))}
                              className="pl-7 pr-3 py-1.5 w-28 border border-gray-200 rounded-md text-sm text-right focus:ring-1 focus:ring-crimson-700 focus:border-crimson-700 outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Requirements Checklist */}
                      <div className="pt-4">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Required Upload Attachments</label>
                        {doc.requirements.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No attachments supported for this request.</span>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {doc.requirements.map(req => {
                              const isChecked = !!docConf.requirements[req.id];
                              return (
                                <button
                                  key={req.id}
                                  onClick={() => handleDocRequirementToggle(doc.id, req.id)}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    isChecked
                                      ? 'bg-crimson-50 border-crimson-200 text-crimson-800'
                                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${isChecked ? 'bg-crimson-700' : 'bg-gray-300'}`} />
                                  {req.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Event Settings */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-gray-900">Event Scheduling Requirements</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Configure requirement rules that parishioners must upload before scheduling sacramental appointments.
                </p>
              </div>

              <div className="grid gap-5">
                {EVENT_TYPES.map(evt => {
                  const evtConf = eventSettings[evt.id] || { requirements: {} };
                  return (
                    <div key={evt.id} className="p-4 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors bg-gray-50/30">
                      <div className="pb-3 border-b border-gray-100/70">
                        <span className="text-sm font-bold text-gray-900">{evt.label}</span>
                        <span className="block text-[10px] font-mono text-gray-400 mt-0.5">{evt.id}</span>
                      </div>

                      {/* Requirements List */}
                      <div className="pt-3">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Required Files / Documents</label>
                        {evt.possibleReqs.length === 0 ? (
                          <span className="text-xs text-gray-400 italic">No scheduling attachments required.</span>
                        ) : (
                          <div className="flex flex-wrap gap-3">
                            {evt.possibleReqs.map(req => {
                              const isChecked = !!evtConf.requirements[req.id];
                              return (
                                <button
                                  key={req.id}
                                  onClick={() => handleEventRequirementToggle(evt.id, req.id)}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                    isChecked
                                      ? 'bg-crimson-50 border-crimson-200 text-crimson-800'
                                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${isChecked ? 'bg-crimson-700' : 'bg-gray-300'}`} />
                                  {req.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Office Hours */}
          {activeTab === 'hours' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-bold text-gray-900">Parish Office Operating Hours</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Define daily opening and closing hours. Toggling "Closed" will block document requests and bookings on those days.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-150 rounded-xl overflow-hidden divide-y divide-gray-200/60">
                {DAYS_OF_WEEK.map(day => {
                  const dayConf = officeHours[day] || { openTime: '08:00 AM', closeTime: '05:00 PM', isClosed: false };
                  return (
                    <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4 bg-white">
                      <div className="w-32 flex-shrink-0">
                        <span className="text-sm font-semibold text-gray-900">{day}</span>
                      </div>

                      <div className="flex-1 flex flex-wrap items-center gap-6">
                        {/* Status Toggle */}
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`hours-closed-${day}`}
                            checked={!dayConf.isClosed}
                            onChange={(e) => handleOfficeHoursChange(day, 'isClosed', !e.target.checked)}
                            className="w-4.5 h-4.5 text-crimson-700 border-gray-350 focus:ring-crimson-700 rounded"
                          />
                          <label htmlFor={`hours-closed-${day}`} className="text-xs font-semibold text-gray-700 uppercase">
                            {dayConf.isClosed ? 'Office Closed' : 'Office Open'}
                          </label>
                        </div>

                        {/* Open Time Dropdown */}
                        {!dayConf.isClosed && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-gray-400">Opens:</span>
                              <input
                                type="text"
                                placeholder="e.g. 08:00 AM"
                                value={dayConf.openTime}
                                onChange={(e) => handleOfficeHoursChange(day, 'openTime', e.target.value)}
                                className="px-2.5 py-1 border border-gray-200 rounded text-xs w-28 bg-white focus:ring-1 focus:ring-crimson-700 outline-none text-center font-mono"
                              />
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-medium text-gray-400">Closes:</span>
                              <input
                                type="text"
                                placeholder="e.g. 05:00 PM"
                                value={dayConf.closeTime}
                                onChange={(e) => handleOfficeHoursChange(day, 'closeTime', e.target.value)}
                                className="px-2.5 py-1 border border-gray-200 rounded text-xs w-28 bg-white focus:ring-1 focus:ring-crimson-700 outline-none text-center font-mono"
                              />
                            </div>
                          </div>
                        )}
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
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg transition-colors"
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

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in slide-in-from-bottom-4 ${
            toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          }`}
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
