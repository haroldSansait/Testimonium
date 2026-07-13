import type { IAnnouncementProvider } from '../types';
import type { Announcement } from '../../types';

const DEMO_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1',
    title: 'Diocesan Synod 2026 Scheduled',
    content: 'All parishioners are invited to participate in the upcoming Diocesan Synod. Consultations will begin in local parishes starting next month.',
    date: '2026-07-09T08:00:00Z'
  },
  {
    id: 'a2',
    title: 'New Parish Priest Assignments',
    content: 'The Bishop has announced new assignments for parish priests in the Vicariate of Canlaon, effective August 1, 2026. Please check the parish page for details.',
    date: '2026-07-05T12:00:00Z'
  },
  {
    id: 'a3',
    title: 'Livelihood Program Launch',
    content: 'The Social Action Center is launching a new livelihood training program for local communities. Registration is open at the parish office.',
    date: '2026-06-28T09:30:00Z'
  }
];

export class DemoAnnouncementProvider implements IAnnouncementProvider {
  async getAnnouncements(): Promise<Announcement[]> {
    await new Promise(resolve => setTimeout(resolve, 250));
    return [...DEMO_ANNOUNCEMENTS];
  }
}
