import { ApiSchedulerProvider } from '../../src/providers/api/scheduler';

export const auth = { currentUser: { uid: 'scheduler-test' } };
export const useAuth = () => ({ appProfile: { isGovernmentIdVerified: true } });
export const useProfileRequirement = () => ({ isProfileIncomplete: false, openProfileModal() {} });
const parishes = [{ id: '51', name: 'First Parish' }, { id: '52', name: 'Second Parish' }];
export const useParishes = () => ({ data: parishes, loading: false, error: null, refetch() {} });
export class ApiError extends Error {
  constructor(message: string, public statusCode: number, public errors: unknown[] = [], public code?: string) { super(message); }
}
const definitions = {
  WEDDING: [{ id: 'cenomar', label: 'CENOMAR' }, { id: 'marriage_license', label: 'Marriage License' }, { id: 'baptismal_cert', label: 'Baptismal Certificate' }],
  BAPTISM: [{ id: 'birth_cert', label: 'Birth Certificate / Immunization Card' }],
};
const fixture = {
  bookings: [] as any[], nextError: null as string | null, hold: false,
  configs: { '51': { ...definitions }, '52': { WEDDING: [], BAPTISM: [] } } as Record<string, Record<string, Array<{ id: string; label: string }>>>,
};
Object.assign(window, { fixture });
const today = new Date();
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
export const client = {
  async get(endpoint: string, params?: any) {
    if (endpoint.endsWith('/configuration')) return { parishId: Number(params.parishId), schedulingAvailable: true,
      services: Object.entries(fixture.configs[params.parishId]).map(([eventType, requirements]) => ({ eventType, label: eventType === 'WEDDING' ? 'Marriage (Canonical Interview)' : 'Baptism', requirements: structuredClone(requirements) })),
      timeSlots: ['08:00 AM'], capacity: { dailyLimit: 20, slotCapacity: 20 } };
    if (endpoint.endsWith('/availability-dates')) return { serviceAvailable: true, dates: [date] };
    if (endpoint.endsWith('/available-slots')) return ['08:00 AM'];
    return [];
  },
  async post(endpoint: string, body: any, options?: any) {
    if (endpoint.endsWith('/recommendations')) return { recommendations: [] };
    const booking = JSON.parse(body.get('booking'));
    fixture.bookings.push({ endpoint, booking, ids: JSON.parse(body.get('requirementIds')),
      files: body.getAll('files').map((f: File) => f.name), key: options.headers['Idempotency-Key'] });
    while (fixture.hold) await new Promise((resolve) => setTimeout(resolve, 20));
    if (fixture.nextError) {
      const code = fixture.nextError; fixture.nextError = null;
      throw new ApiError('Requirements changed. Please review and retry.', 409, [], code);
    }
    return { id: 1, parishId: booking.parishId, eventType: booking.eventType, requestedDate: booking.date,
      remarks: `Time Slot: ${booking.timeSlot}.`, status: 'PENDING' };
  },
};
export default { scheduler: new ApiSchedulerProvider() };
