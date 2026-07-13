import type { IEventProvider } from '../types';
import type { Event } from '../../types';

import eventYouth from '../../assets/events/event-youth.png';
import eventFiesta from '../../assets/events/event-fiesta.png';
import eventSeminar from '../../assets/events/event-seminar.png';
import eventRetreat from '../../assets/events/event-retreat.png';
import eventCommunity from '../../assets/events/event-community.png';

export class DemoEventProvider implements IEventProvider {
  private events: Event[] = [];

  constructor() {
    this.initializeEvents();
  }

  private initializeEvents() {
    const today = new Date();
    const formatDate = (offsetDays: number): string => {
      const d = new Date(today);
      d.setDate(today.getDate() + offsetDays);
      return d.toISOString().split('T')[0];
    };

    this.events = [
      {
        id: 'ev-youth-day',
        title: 'Canlaon Diocesan Youth Assembly 2026',
        description: 'Join the annual gathering of Catholic youth across Negros Oriental parishes. A weekend filled with praise, fellowship workshops, spiritual guidance, and live musical worship.',
        category: 'Youth',
        parishId: 'p1',
        parishName: 'San Isidro Labrador Parish',
        coverImage: eventYouth,
        coverImageAlt: 'Christian youth assembly singing and raising hands in praise',
        startDate: formatDate(0), // Today
        endDate: formatDate(1),
        startTime: '08:00',
        endTime: '17:00',
        location: 'Parish Gymnasium, Canlaon City',
        organizer: 'Vicariate Youth Coordinating Council',
        contactPerson: 'Bro. Jeremy Alcantara',
        contactNumber: '+63 917 888 1234',
        featured: true,
        status: 'upcoming',
        registrationRequired: true,
        maxParticipants: 350,
        currentParticipants: 284
      },
      {
        id: 'ev-fiesta',
        title: 'Parish Fiesta Grand Procession & Solemnity',
        description: 'Celebrate our patronal feast day with a traditional street procession followed by a concelebrated Holy Mass and community shared lunch. Devotional activities start at dawn.',
        category: 'Fiesta',
        parishId: 'p1',
        parishName: 'San Isidro Labrador Parish',
        coverImage: eventFiesta,
        coverImageAlt: 'Solemn street procession decorated with fiesta banners',
        startDate: formatDate(2), // In 2 days
        endDate: formatDate(2),
        startTime: '04:30',
        endTime: '13:00',
        location: 'Main Sanctuary and Barangay Streets',
        organizer: 'Parish Pastoral Council',
        contactPerson: 'Mrs. Maria Santos',
        contactNumber: '+63 918 555 4321',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },
      {
        id: 'ev-precana',
        title: 'Pre-Cana Marriage Seminar',
        description: 'A mandatory seminar for couples preparing to receive the sacrament of Holy Matrimony. Covers communication, financial management, responsible parenthood, and family values.',
        category: 'Seminar',
        parishId: 'p2',
        parishName: 'St. Joseph the Worker Parish',
        coverImage: eventSeminar,
        coverImageAlt: 'Couples listening attentively during pre-cana lecture',
        startDate: formatDate(1), // Tomorrow
        endDate: formatDate(1),
        startTime: '09:00',
        endTime: '16:00',
        location: 'Parish Pastoral Center, Room A',
        organizer: 'Family Life Apostolate',
        contactPerson: 'Deacon Roberto Gomez',
        contactNumber: '+63 919 777 9900',
        featured: true,
        status: 'upcoming',
        registrationRequired: true,
        maxParticipants: 40,
        currentParticipants: 18
      },
      {
        id: 'ev-outreach',
        title: 'Barangay Community Food Share & Outreach',
        description: 'Bringing care and packages of basic necessities to families in remote mountainous sectors of our vicariate. Volunteers and dry goods donations are highly welcomed.',
        category: 'Outreach',
        parishId: 'p4',
        parishName: 'St. Vincent Ferrer Parish',
        coverImage: eventCommunity,
        coverImageAlt: 'Volunteers distributing food relief boxes to local families',
        startDate: formatDate(5), // In 5 days
        endDate: formatDate(5),
        startTime: '07:30',
        endTime: '12:00',
        location: 'Brgy. Upper Budlasan Covered Court',
        organizer: 'Social Action Center Office',
        contactPerson: 'Sis. Clara Lopez',
        contactNumber: '+63 908 123 4567',
        featured: false,
        status: 'upcoming',
        registrationRequired: false
      },
      {
        id: 'ev-retreat',
        title: 'Advent Spiritual Recollection & Retreat',
        description: 'A quiet day of recollection, meditation, and sacramental confession to prepare our hearts for the holy season. Includes guided spiritual talks and silent adoration periods.',
        category: 'Retreat',
        parishId: 'p5',
        parishName: 'Our Lady of Mount Carmel Parish',
        coverImage: eventRetreat,
        coverImageAlt: 'Quiet sanctuary garden overlooking mountains under sunset',
        startDate: formatDate(7), // In 7 days
        endDate: formatDate(7),
        startTime: '08:00',
        endTime: '17:00',
        location: 'Carmelite Monastery Retreat House',
        organizer: 'Apostleship of Prayer Committee',
        contactPerson: 'Fr. Thomas Aquinas, OCD',
        contactNumber: '+63 920 999 8888',
        featured: false,
        status: 'upcoming',
        registrationRequired: true,
        maxParticipants: 80,
        currentParticipants: 42
      },
      {
        id: 'ev-holy-mass',
        title: 'First Friday Devotional Mass & Adoration',
        description: 'Join the community in honoring the Sacred Heart of Jesus. Exposition of the Blessed Sacrament and confessions will start one hour prior to the Holy Mass.',
        category: 'Holy Mass',
        parishId: 'p3',
        parishName: 'Holy Child Parish',
        coverImage: eventRetreat, // Reusing retreat image for mass placeholder
        coverImageAlt: 'Altar sanctuary candlelit atmosphere',
        startDate: formatDate(3), // In 3 days
        endDate: formatDate(3),
        startTime: '18:00',
        endTime: '20:00',
        location: 'Main Altar Chapel',
        organizer: 'Liturgical Committee',
        contactPerson: 'Sis. Elena Cruz',
        contactNumber: '+63 930 222 1111',
        featured: false,
        status: 'upcoming',
        registrationRequired: false
      },
      {
        id: 'ev-completed-service',
        title: 'Summer Catechism for Children',
        description: 'A two-week spiritual education program for kids, teaching standard catechism, prayer recitation, and basic values. Concluded with a children choir performance.',
        category: 'Formation',
        parishId: 'p6',
        parishName: 'St. John the Baptist Parish',
        coverImage: eventYouth, // Reusing youth image
        coverImageAlt: 'Children in class raising hands',
        startDate: formatDate(-4), // 4 days ago
        endDate: formatDate(-1),
        startTime: '09:00',
        endTime: '11:30',
        location: 'Parish Catechetical Hall',
        organizer: 'Catechetical Ministry',
        contactPerson: 'Mrs. Dolores Pelaez',
        contactNumber: '+63 945 333 4444',
        featured: false,
        status: 'completed',
        registrationRequired: false
      },
      {
        id: 'ev-formation',
        title: 'Catholic Social Teachings Lecture',
        description: 'An open lecture explaining the application of Catholic Social Teachings in modern work environments, societal justice, and political participation.',
        category: 'Formation',
        parishId: 'p7',
        parishName: 'San Sebastian Parish',
        coverImage: eventSeminar, // Reusing seminar image
        coverImageAlt: 'Lecture meeting room setup',
        startDate: formatDate(10), // In 10 days
        endDate: formatDate(10),
        startTime: '14:00',
        endTime: '16:30',
        location: 'St. Sebastian Hall',
        organizer: 'Parish Intellectual Apostolate',
        contactPerson: 'Dr. Salvador Roxas',
        contactNumber: '+63 966 444 8888',
        featured: false,
        status: 'upcoming',
        registrationRequired: true,
        maxParticipants: 100,
        currentParticipants: 35
      }
    ];
  }

  private sortEvents(list: Event[]): Event[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return [...list].sort((a, b) => {
      const dateA = new Date(a.startDate);
      const dateB = new Date(b.startDate);

      const isPastA = dateA < today;
      const isPastB = dateB < today;

      // Completed / Past events go to the bottom
      if (isPastA && !isPastB) return 1;
      if (!isPastA && isPastB) return -1;

      // Otherwise chronological ascending
      return dateA.getTime() - dateB.getTime();
    });
  }

  async getEvents(): Promise<Event[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return this.sortEvents(this.events);
  }

  async getFeaturedEvents(): Promise<Event[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const featuredList = this.events.filter(e => e.featured);
    return this.sortEvents(featuredList);
  }

  async getEventById(id: string): Promise<Event | null> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const matched = this.events.find(e => e.id === id);
    return matched ? { ...matched } : null;
  }
}
