import { useState, useEffect } from 'react';
import { Save, Check, AlertCircle, Clock, FileText, CalendarDays } from 'lucide-react';
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
  
  const [activeTab, setActiveTab] = useState<'documents' | 'events' | 'hours'>('documents');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Configuration States
  const [documentSettings, setDocumentSettings] = useState<any>({});
  const [eventSettings, setEventSettings] = useState<Record<string, { requirements: Record<string, boolean> }>>({});
  const [officeHours, setOfficeHours] = useState<Record<string, { openTime: string; closeTime: string; isClosed: boolean }>>({});

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
      setOfficeHours(parish.officeHours || initDefaultOfficeHours());
    }
  }, [selectedParishId, parishes]);

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
      const dayConf = prev[day] || { openTime: '08:00 AM', closeTime: '05:00 PM', isClosed: false };
      return {
        ...prev,
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
        officeHours
      });
      // Update local cache
      setParishes(prev => prev.map(p => p.id === selectedParishId ? { ...p, documentSettings, eventSettings, officeHours } : p));
      setToast({ message: 'Parish configuration saved successfully.', type: 'success' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setToast({ message: 'Failed to update parish configurations.', type: 'error' });
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
