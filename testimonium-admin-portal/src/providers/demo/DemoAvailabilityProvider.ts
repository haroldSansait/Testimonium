import type { AvailabilityProvider, ParishAvailability } from '../interfaces';

let demoAvailabilities: ParishAvailability[] = [
  {
    id: 'demo-av-1',
    parishId: '2',
    userId: '1',
    type: 'PRIEST_LEAVE',
    startDate: '2026-10-01',
    endDate: '2026-10-07',
    title: 'Annual Priest Leave',
    description: 'Priest annual pastoral commitment leave.',
  }
];

export const DemoAvailabilityProvider: AvailabilityProvider = {
  async getAvailabilities(parishId?: string, _startDate?: string, _endDate?: string): Promise<ParishAvailability[]> {
    let list = demoAvailabilities;
    if (parishId) {
      list = list.filter(a => a.parishId === parishId);
    }
    return list;
  },

  async createAvailability(data: Omit<ParishAvailability, 'id'>): Promise<ParishAvailability> {
    const newItem: ParishAvailability = {
      ...data,
      id: `demo-av-${Date.now()}`,
    };
    demoAvailabilities.push(newItem);
    return newItem;
  },

  async deleteAvailability(id: string): Promise<void> {
    demoAvailabilities = demoAvailabilities.filter(a => a.id !== id);
  },
};
