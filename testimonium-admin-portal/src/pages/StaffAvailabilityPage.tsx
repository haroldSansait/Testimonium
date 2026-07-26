import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StaffAvailabilityService } from '@/services/StaffAvailabilityService';
import { UserManagementService } from '@/services/UserManagementService';
import { useAuth } from '@/hooks/useAuth';
import type { ParishAvailability } from '@/providers/interfaces';
import { Calendar, Trash2, Check, AlertTriangle, User } from 'lucide-react';

export function StaffAvailabilityPage() {
  const { applicationUser } = useAuth();
  const parishId = applicationUser?.parishId;
  const currentUserId = applicationUser?.id;
  const userRole = applicationUser?.role;

  const [availabilities, setAvailabilities] = useState<ParishAvailability[]>([]);
  const [priests, setPriests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<'PARISH_CLOSED' | 'SECRETARY_LEAVE' | 'PRIEST_LEAVE' | 'FULLY_BOOKED'>('PARISH_CLOSED');
  const [targetPriestId, setTargetPriestId] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
          ? 'Manage your personal unavailable dates and leave periods.' 
          : 'Configure parish closures, office leaves, and priest leave periods.'
        }
      />

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
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none bg-white text-gray-800 font-medium"
                  >
                    <option value="PARISH_CLOSED">Parish Office Closed</option>
                    <option value="SECRETARY_LEAVE">Parish Secretary Leave</option>
                    <option value="PRIEST_LEAVE">Priest Leave / Vacation</option>
                    <option value="FULLY_BOOKED">Fully Booked / Blocked Date</option>
                  </select>
                </div>
              )}

              {userRole === 'SECRETARY' && type === 'PRIEST_LEAVE' && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <label className="block uppercase tracking-wider">Select Priest</label>
                  <select
                    value={targetPriestId}
                    onChange={e => setTargetPriestId(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none bg-white text-gray-800 font-medium"
                    required
                  >
                    <option value="">Choose Priest...</option>
                    {priests.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.isAssistant ? '(Assistant)' : '(Primary)'}
                      </option>
                    ))}
                  </select>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700 bg-white"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-lg outline-none text-gray-800 font-medium focus:border-crimson-700 bg-white"
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
                      <button
                        onClick={() => void handleDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer mt-0.5 opacity-0 group-hover:opacity-100"
                        title="Delete leave block"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
