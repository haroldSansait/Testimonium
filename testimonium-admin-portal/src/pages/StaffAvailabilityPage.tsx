import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { StaffAvailabilityService } from '@/services/StaffAvailabilityService';
import { UserManagementService } from '@/services/UserManagementService';
import { PriestPersonalScheduleService, type PriestPersonalScheduleItem } from '@/services/PriestPersonalScheduleService';
import { useAuth } from '@/hooks/useAuth';
import type { ParishAvailability } from '@/providers/interfaces';
import { Calendar, Trash2, Check, AlertTriangle, User, Lock, Clock, Pencil, X } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

const manilaLocalDateTimeToIso = (value: string): string => {
  const normalized = value.length === 16 ? value + ':00' : value;
  return new Date(normalized + '+08:00').toISOString();
};

const isoToManilaDateTimeInput = (value: string): string => {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '';
  return new Date(instant.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);
};

const formatManilaDateTime = (value: string): string =>
  new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });


export function StaffAvailabilityPage() {
  const { applicationUser } = useAuth();
  const parishId = applicationUser?.parishId;
  const currentUserId = applicationUser?.id;
  const userRole = applicationUser?.role;

  // Active Tab for Priest (Full-Day Leave vs Timed Personal Commitments)
  const [activeTab, setActiveTab] = useState<'LEAVE' | 'PERSONAL'>('LEAVE');

  const [availabilities, setAvailabilities] = useState<ParishAvailability[]>([]);
  const [priests, setPriests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Leave Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<'PARISH_CLOSED' | 'SECRETARY_LEAVE' | 'PRIEST_LEAVE' | 'FULLY_BOOKED'>('PARISH_CLOSED');
  const [targetPriestId, setTargetPriestId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Personal Timed Commitments State
  const [personalSchedules, setPersonalSchedules] = useState<PriestPersonalScheduleItem[]>([]);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalTitle, setPersonalTitle] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [personalStartAt, setPersonalStartAt] = useState('');
  const [personalEndAt, setPersonalEndAt] = useState('');
  const [personalSubmitting, setPersonalSubmitting] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [personalEditingId, setPersonalEditingId] = useState<number | null>(null);
  const [personalEditingVersion, setPersonalEditingVersion] = useState<number | null>(null);

  const fetchAvailabilities = async () => {
    if (!parishId) {
      setError('No parish associated with your staff account.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await StaffAvailabilityService.getAvailabilities(parishId);
      // Filter list: priests only see their own leaves, secretaries see all parish leaves
      if (userRole === 'PRIEST' && currentUserId) {
        setAvailabilities(data.filter(a => String(a.userId) === String(currentUserId)));
      } else {
        setAvailabilities(data);
      }
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load leave records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPriests = async () => {
    if (parishId && userRole === 'SECRETARY') {
      try {
        const list = await UserManagementService.getUsers({ role: 'PRIEST', parishId });
        setPriests(list);
      } catch (err) {
        console.error('Failed to fetch priests:', err);
      }
    }
  };

  useEffect(() => {
    void fetchAvailabilities();
    void fetchPriests();
    
    // Default type based on role
    if (userRole === 'PRIEST') {
      setType('PRIEST_LEAVE');
    }
  }, [parishId, userRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parishId) return;

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after end date.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const actualUserId = userRole === 'PRIEST' 
      ? currentUserId 
      : (type === 'PRIEST_LEAVE' ? targetPriestId : (type === 'SECRETARY_LEAVE' ? currentUserId : undefined));

    try {
      await StaffAvailabilityService.createAvailability({
        parishId,
        userId: actualUserId || null,
        type,
        startDate,
        endDate,
        title,
        description: description || undefined,
      });

      setSuccessMessage('Leave period created successfully.');
      setTitle('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      setTargetPriestId('');
      void fetchAvailabilities();
    } catch (err: any) {
      setError(err.message || 'Error creating leave record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this leave/unavailable block?')) return;
    try {
      await StaffAvailabilityService.deleteAvailability(id);
      setSuccessMessage('Leave block deleted.');
      void fetchAvailabilities();
    } catch (err: any) {
      setError(err.message || 'Error deleting block.');
    }
  };

  const fetchPersonalSchedules = async () => {
    if (userRole !== 'PRIEST') return;
    setPersonalLoading(true);
    try {
      const list = await PriestPersonalScheduleService.getPersonalSchedules();
      setPersonalSchedules(list);
      setPersonalError(null);
    } catch (err: any) {
      console.error(err);
      setPersonalError(err?.message || 'Failed to load personal commitments.');
    } finally {
      setPersonalLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === 'PRIEST') {
      void fetchPersonalSchedules();
    }
  }, [userRole]);

  const resetPersonalForm = () => {
    setPersonalTitle('');
    setPersonalNotes('');
    setPersonalStartAt('');
    setPersonalEndAt('');
    setPersonalEditingId(null);
    setPersonalEditingVersion(null);
  };

  const handlePersonalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalStartAt || !personalEndAt) {
      setPersonalError('Start and end date/time are required.');
      return;
    }
    if (personalStartAt >= personalEndAt) {
      setPersonalError('End date/time must be strictly after start date/time.');
      return;
    }

    setPersonalSubmitting(true);
    setPersonalError(null);

    try {
      const commonPayload = {
        title: personalTitle,
        notes: personalNotes || null,
        startAt: manilaLocalDateTimeToIso(personalStartAt),
        endAt: manilaLocalDateTimeToIso(personalEndAt),
      };

      if (personalEditingId !== null) {
        if (personalEditingVersion === null) {
          throw new Error('The commitment version is unavailable. Refresh and try again.');
        }
        await PriestPersonalScheduleService.updatePersonalSchedule(personalEditingId, {
          ...commonPayload,
          expectedVersion: personalEditingVersion,
        });
        setSuccessMessage('Personal commitment updated successfully.');
      } else {
        await PriestPersonalScheduleService.createPersonalSchedule(commonPayload);
        setSuccessMessage('Personal commitment added successfully.');
      }

      resetPersonalForm();
      await fetchPersonalSchedules();
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.message || err?.message || 'Failed to save personal commitment.';
      setPersonalError(msg);
      if (err?.response?.status === 409 || err?.response?.data?.code === 'PERSONAL_SCHEDULE_CONCURRENCY_CONFLICT') {
        await fetchPersonalSchedules();
      }
    } finally {
      setPersonalSubmitting(false);
    }
  };

  const handlePersonalEdit = (item: PriestPersonalScheduleItem) => {
    setPersonalEditingId(item.id);
    setPersonalEditingVersion(item.version);
    setPersonalTitle(item.title);
    setPersonalNotes(item.notes || '');
    setPersonalStartAt(isoToManilaDateTimeInput(item.startAt));
    setPersonalEndAt(isoToManilaDateTimeInput(item.endAt));
    setPersonalError(null);
  };

  const handlePersonalDelete = async (id: number, version: number) => {
    if (!confirm('Are you sure you want to delete this personal commitment?')) return;
    try {
      await PriestPersonalScheduleService.deletePersonalSchedule(id, version);
      if (personalEditingId === id) resetPersonalForm();
      setSuccessMessage('Personal commitment deleted.');
      await fetchPersonalSchedules();
    } catch (err: any) {
      console.error(err);
      setPersonalError(err?.response?.data?.message || err?.message || 'Failed to delete personal commitment.');
      await fetchPersonalSchedules();
    }
  };

  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  if (loading && availabilities.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-crimson-700 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave & Availability Management"
        subtitle={userRole === 'PRIEST'
          ? 'Manage your personal unavailable dates, leave periods, and timed commitments.'
          : 'Configure parish closures, office leaves, and priest leave periods.'
        }
      />

      {userRole === 'PRIEST' && (
        <div className="flex border-b border-gray-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('LEAVE')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'LEAVE'
                ? 'border-[#7B1C2A] text-[#7B1C2A]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Full-Day Leave (Parish Availability)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PERSONAL')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'PERSONAL'
                ? 'border-[#7B1C2A] text-[#7B1C2A]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Timed Personal Commitments (Private)
          </button>
        </div>
      )}

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

      {activeTab === 'PERSONAL' && userRole === 'PRIEST' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Create Personal Commitment */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-[#7B1C2A] text-white flex items-center justify-between">
                <h3 className="font-serif font-bold text-sm tracking-wide flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> {personalEditingId === null ? 'Record Personal Commitment' : 'Edit Personal Commitment'}
                </h3>
              </div>
              <form onSubmit={(e) => void handlePersonalSubmit(e)} className="p-6 space-y-4 text-xs font-semibold text-gray-500">
                {personalError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium">
                    {personalError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider">Commitment Title</label>
                  <input
                    type="text"
                    value={personalTitle}
                    onChange={(e) => setPersonalTitle(e.target.value)}
                    placeholder="e.g. Doctor Consultation, Family Gathering"
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700"
                    maxLength={150}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1.5">
                    <label className="block uppercase tracking-wider">Start Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={personalStartAt}
                      onChange={(e) => setPersonalStartAt(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block uppercase tracking-wider">End Date &amp; Time</label>
                    <input
                      type="datetime-local"
                      value={personalEndAt}
                      onChange={(e) => setPersonalEndAt(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block uppercase tracking-wider">Private Notes (Optional)</label>
                    <span className="text-[10px] text-gray-400 font-normal flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Visible only to you
                    </span>
                  </div>
                  <textarea
                    value={personalNotes}
                    onChange={(e) => setPersonalNotes(e.target.value)}
                    placeholder="Confidential notes or details (never exposed to parishioners or staff)..."
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700 min-h-[70px]"
                    maxLength={1000}
                  />
                </div>

                <div className="flex gap-2">
                  {personalEditingId !== null && (
                    <button
                      type="button"
                      onClick={resetPersonalForm}
                      disabled={personalSubmitting}
                      className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={personalSubmitting}
                    className="flex-1 py-2.5 bg-crimson-700 hover:bg-crimson-800 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {personalSubmitting
                      ? 'Validating Conflicts...'
                      : personalEditingId === null
                        ? 'Save Personal Commitment'
                        : 'Update Personal Commitment'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Side: Personal Commitments List */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-[#7B1C2A] text-white flex items-center justify-between">
                <h3 className="font-serif font-bold text-sm tracking-wide">
                  My Timed Commitments
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full">
                  {personalSchedules.length} Items
                </span>
              </div>
              <div className="p-6">
                {personalLoading ? (
                  <p className="text-xs text-gray-400 py-8 text-center">Loading commitments...</p>
                ) : personalSchedules.length === 0 ? (
                  <p className="text-xs text-gray-400 py-8 text-center">No personal timed commitments recorded.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {personalSchedules.map((item) => (
                      <div key={item.id} className="flex items-start justify-between py-4 first:pt-0 last:pb-0 group">
                        <div className="flex gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700 mt-0.5">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{item.title}</p>
                            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                              {formatManilaDateTime(item.startAt)} —{' '}
                              {formatManilaDateTime(item.endAt)}
                            </p>
                            {item.notes && (
                              <p className="text-[10px] text-gray-500 italic mt-1.5 flex items-center gap-1">
                                <Lock className="w-3 h-3 text-gray-400" />
                                {item.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {personalEditingId === item.id ? (
                            <button
                              type="button"
                              onClick={resetPersonalForm}
                              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                              title="Cancel editing"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handlePersonalEdit(item)}
                              className="p-1.5 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                              title="Edit personal commitment"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handlePersonalDelete(item.id, item.version)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete personal commitment"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Create Leave Form */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-[#7B1C2A] text-white">
                <h3 className="font-serif font-bold text-sm tracking-wide">
                  {userRole === 'PRIEST' ? 'Record My Leave' : 'Create Parish Block'}
                </h3>
              </div>
              <form onSubmit={e => void handleSubmit(e)} className="p-6 space-y-4 text-xs font-semibold text-gray-500">
                {userRole === 'SECRETARY' && (
                  <div className="space-y-1.5">
                    <label className="block uppercase tracking-wider">Unavailability Type</label>
                    <CustomSelect
                      value={type}
                      onChange={(val) => setType(val as any)}
                      options={[
                        { value: 'PARISH_CLOSED', label: 'Parish Office Closed' },
                        { value: 'SECRETARY_LEAVE', label: 'Parish Secretary Leave' },
                        { value: 'PRIEST_LEAVE', label: 'Priest Leave / Vacation' },
                        { value: 'FULLY_BOOKED', label: 'Fully Booked / Blocked Date' },
                      ]}
                    />
                  </div>
                )}

                {userRole === 'SECRETARY' && type === 'PRIEST_LEAVE' && (
                  <div className="space-y-1.5 animate-in fade-in duration-150">
                    <label className="block uppercase tracking-wider">Select Priest</label>
                    <CustomSelect
                      value={targetPriestId}
                      onChange={setTargetPriestId}
                      placeholder="Choose Priest..."
                      required
                      options={priests.map((p) => ({
                        value: String(p.id),
                        label: `${p.name} ${p.isAssistant ? '(Assistant)' : '(Primary)'}`,
                      }))}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider">Title / Purpose</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Personal Vacation or Office Maintenance"
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block uppercase tracking-wider">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block uppercase tracking-wider">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider">Additional Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Provide any additional leave or closure details..."
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700 min-h-[80px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-crimson-700 hover:bg-crimson-800 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Save Leave Block'}
                </button>
              </form>
            </div>
          </div>

          {/* Right Side: Leaves List */}
          <div className="lg:col-span-7">
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-[#7B1C2A] text-white flex items-center justify-between">
                <h3 className="font-serif font-bold text-sm tracking-wide">
                  {userRole === 'PRIEST' ? 'My Leave Periods' : 'Parish Availability Blocks'}
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full">
                  {availabilities.length} Records
                </span>
              </div>
              <div className="p-6">
                {availabilities.length === 0 ? (
                  <p className="text-xs text-gray-400 py-8 text-center">No leaves or unavailable blocks recorded.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {availabilities.map((item) => (
                      <div key={item.id} className="flex items-start justify-between py-4 first:pt-0 last:pb-0 group">
                        <div className="flex gap-3">
                          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-[#7B1C2A] mt-0.5">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800">{item.title}</p>
                            <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                              {item.startDate} to {item.endDate}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-bold rounded">
                                {item.type.replace('_', ' ')}
                              </span>
                              {item.user && (
                                <span className="text-[9px] text-gray-400 font-bold flex items-center gap-1">
                                  <User className="w-2.5 h-2.5" />
                                  {item.user.fullName}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-[10px] text-gray-400 italic mt-1.5">{item.description}</p>
                            )}
                          </div>
                        </div>
                        <Tooltip
                          content={item.type === 'PARISH_CLOSED' ? "Delete closure record" : "Delete leave record"}
                          side="top"
                        >
                          <button
                            onClick={() => void handleDelete(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer mt-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                            aria-label={item.type === 'PARISH_CLOSED' ? "Delete closure record" : "Delete leave record"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
