import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { ParishManagementService } from '@/services/ParishManagementService';
import { UserManagementService } from '@/services/UserManagementService';
import { useAuth } from '@/hooks/useAuth';
import type { MassScheduleTemplate } from '@/providers/interfaces';
import { Plus, Trash2, Edit2, RotateCcw, Check, X, Clock, AlertTriangle, User } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';


export function MassSchedulePage() {
  const { applicationUser } = useAuth();
  const parishId = applicationUser?.parishId;

  const [templates, setTemplates] = useState<MassScheduleTemplate[]>([]);
  const [priests, setPriests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MassScheduleTemplate | null>(null);
  const [dayType, setDayType] = useState<string>('WEDNESDAY');
  const [timeSlot, setTimeSlot] = useState('06:00 AM');
  const [label, setLabel] = useState('');
  const [assignedPriestId, setAssignedPriestId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSchedule = async () => {
    if (!parishId) {
      setError('No parish associated with your staff account.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await ParishManagementService.getMassSchedule(parishId);
      setTemplates(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load Mass schedule templates.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPriests = async () => {
    if (parishId) {
      try {
        const list = await UserManagementService.getUsers({ role: 'PRIEST', parishId });
        setPriests(list);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    void fetchSchedule();
    void fetchPriests();
  }, [parishId]);

  const handleOpenAdd = () => {
    setEditingTemplate(null);
    setDayType('WEDNESDAY');
    setTimeSlot('06:00 AM');
    setLabel('');
    setAssignedPriestId('');
    setShowModal(true);
  };

  const handleOpenEdit = (t: MassScheduleTemplate) => {
    setEditingTemplate(t);
    setDayType(t.dayType);
    setTimeSlot(t.timeSlot);
    setLabel(t.label);
    setAssignedPriestId(t.assignedPriestId || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parishId) return;
    setSubmitting(true);
    try {
      await ParishManagementService.upsertMassSchedule(parishId, {
        id: editingTemplate?.id,
        dayType,
        timeSlot,
        label,
        assignedPriestId: assignedPriestId || undefined,
      });
      setSuccessMessage(editingTemplate ? 'Mass slot updated successfully.' : 'New Mass slot added successfully.');
      setShowModal(false);
      void fetchSchedule();
    } catch (err: any) {
      setError(err.message || 'Error saving Mass template.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Mass time slot?')) return;
    try {
      await ParishManagementService.deleteMassSchedule(id);
      setSuccessMessage('Mass slot deleted successfully.');
      void fetchSchedule();
    } catch (err: any) {
      setError(err.message || 'Error deleting template.');
    }
  };

  const handleRestoreDefaults = async () => {
    if (!parishId) return;
    if (!confirm('Are you sure you want to restore standard canonical times? This will overwrite current custom schedules.')) return;
    setLoading(true);
    try {
      await ParishManagementService.resetMassSchedule(parishId);
      setSuccessMessage('Canonical default Mass schedules successfully restored.');
      void fetchSchedule();
    } catch (err: any) {
      setError(err.message || 'Error resetting defaults.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 3500);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  const dayNames = ['SUNDAY', 'WEDNESDAY', 'FRIDAY', 'MONDAY', 'TUESDAY', 'THURSDAY', 'SATURDAY', 'WEEKDAY'];
  const dayLabels: Record<string, string> = {
    SUNDAY: 'Sunday Masses',
    MONDAY: 'Monday Masses',
    TUESDAY: 'Tuesday Masses',
    WEDNESDAY: 'Wednesday Masses',
    THURSDAY: 'Thursday Masses',
    FRIDAY: 'Friday Masses',
    SATURDAY: 'Saturday Masses',
    WEEKDAY: 'Weekday Fallback (Wednesday & Friday)',
  };

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-crimson-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader
          title="Mass Schedule Settings"
          subtitle="Configure recurring weekday and Sunday Mass times slots for your parish calendar."
        />
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRestoreDefaults}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-xs font-semibold bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restore Canonical Defaults
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-crimson-700 hover:bg-crimson-800 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Mass Slot
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-sm font-semibold animate-in fade-in duration-200">
          <Check className="w-4 h-4" />
          {successMessage}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-sm font-semibold">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {dayNames.map(day => {
          const daySlots = templates.filter(t => t.dayType === day);
          if (daySlots.length === 0) return null;

          return (
            <div key={day} className="border border-gray-200 shadow-sm rounded-2xl bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-[#7B1C2A] text-white flex items-center justify-between">
                <h3 className="font-serif font-bold text-sm tracking-wide">{dayLabels[day]}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full">
                  {daySlots.length} Slots
                </span>
              </div>
              <div className="p-6">
                <div className="divide-y divide-gray-100">
                  {daySlots.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-[#7B1C2A]">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{item.timeSlot}</p>
                          <p className="text-[10px] text-gray-400 font-semibold">{item.label}</p>
                          {item.assignedPriest && (
                            <span className="flex items-center gap-1 text-[9px] text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded mt-1 w-max">
                              <User className="w-2.5 h-2.5" />
                              Priest: {item.assignedPriest.fullName} {item.assignedPriest.isAssistant ? '(Assistant)' : '(Primary)'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                        <Tooltip content="Edit Mass schedule" side="top">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors cursor-pointer"
                            aria-label="Edit Mass schedule"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Remove Mass time slot" side="top">
                          <button
                            onClick={() => void handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            aria-label="Remove Mass time slot"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Tooltip>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 bg-[#7B1C2A] text-white">
              <h3 className="font-bold text-sm tracking-wide">
                {editingTemplate ? 'Edit Mass Slot' : 'Add New Mass Slot'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-4 text-xs font-semibold text-gray-500">
              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider">Day Category</label>
                <CustomSelect
                  value={dayType}
                  onChange={setDayType}
                  options={[
                    { value: 'SUNDAY', label: 'Sunday' },
                    { value: 'WEDNESDAY', label: 'Wednesday' },
                    { value: 'FRIDAY', label: 'Friday' },
                    { value: 'MONDAY', label: 'Monday' },
                    { value: 'TUESDAY', label: 'Tuesday' },
                    { value: 'THURSDAY', label: 'Thursday' },
                    { value: 'SATURDAY', label: 'Saturday' },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider">Time Slot</label>
                <input
                  type="text"
                  value={timeSlot}
                  onChange={e => setTimeSlot(e.target.value)}
                  placeholder="e.g. 06:00 AM or 05:15 PM"
                  className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider">Label / Description</label>
                <input
                  type="text"
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Early Mass or Parish Solemn High Mass"
                  className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block uppercase tracking-wider">Assigned Priest (Optional)</label>
                <CustomSelect
                  value={assignedPriestId}
                  onChange={setAssignedPriestId}
                  placeholder="Unassigned / TBD"
                  allowClear
                  options={[
                    { value: '', label: 'Unassigned / TBD' },
                    ...priests.map((p) => ({
                      value: String(p.id),
                      label: `${p.name} ${p.isAssistant ? '(Assistant)' : '(Primary)'}`,
                    })),
                  ]}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-gray-100 bg-gray-50 -mx-6 -mb-6 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 font-bold text-gray-600 bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-crimson-700 hover:bg-crimson-800 text-white rounded-lg font-bold"
                >
                  {submitting ? 'Saving...' : 'Save time slot'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
