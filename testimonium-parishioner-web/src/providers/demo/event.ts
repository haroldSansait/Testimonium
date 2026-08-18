import type { IEventProvider } from '../types';
import type { Event } from '../../types';
import { getParishImage } from '../../utils/parishImages';
import { isEventUpcoming } from '../../utils/date';

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
      // ─── p1: San Isidro Labrador Parish ───
      {
        id: 'ev-p1-youth',
        title: 'Canlaon Diocesan Youth Assembly 2026',
        description: 'Join the annual gathering of Catholic youth across Negros Oriental parishes. A weekend filled with praise, fellowship workshops, spiritual guidance, and live musical worship.',
        category: 'Other',
        parishId: 'p1',
        parishName: 'San Isidro Labrador Parish',
        coverImage: getParishImage('San Isidro Labrador Parish'),
        coverImageAlt: 'Christian youth assembly singing and raising hands in praise',
        startDate: formatDate(0),
        endDate: formatDate(1),
        startTime: '08:00 AM',
        endTime: '05:00 PM',
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
        id: 'ev-p1-mass-1',
        title: 'Sunday Morning Mass',
        description: 'Regular Sunday celebration of the Holy Eucharist.',
        category: 'Holy Mass',
        parishId: 'p1',
        parishName: 'San Isidro Labrador Parish',
        coverImage: getParishImage('San Isidro Labrador Parish'),
        coverImageAlt: 'San Isidro Altar Sanctuary',
        startDate: formatDate(1),
        endDate: formatDate(1),
        startTime: '06:00 AM',
        endTime: '07:15 AM',
        location: 'Main Sanctuary',
        organizer: 'Liturgical Committee',
        contactPerson: 'Maria Clara Santos',
        contactNumber: '+63 917 123 4567',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },
      {
        id: 'ev-p1-mass-2',
        title: 'Sunday High Mass',
        description: 'Solemn community mass with the parish choir.',
        category: 'Holy Mass',
        parishId: 'p1',
        parishName: 'San Isidro Labrador Parish',
        coverImage: getParishImage('San Isidro Labrador Parish'),
        coverImageAlt: 'San Isidro Altar Sanctuary',
        startDate: formatDate(1),
        endDate: formatDate(1),
        startTime: '08:30 AM',
        endTime: '09:45 AM',
        location: 'Main Sanctuary',
        organizer: 'Liturgical Committee',
        contactPerson: 'Maria Clara Santos',
        contactNumber: '+63 917 123 4567',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },

      // ─── p2: St. Joseph the Worker Parish ───
      {
        id: 'ev-p2-precana',
        title: 'Pre-Cana Marriage Seminar',
        description: 'A mandatory seminar for couples preparing to receive the sacrament of Holy Matrimony. Covers communication, financial management, responsible parenthood, and family values.',
        category: 'Seminar',
        parishId: 'p2',
        parishName: 'St. Joseph the Worker Parish',
        coverImage: getParishImage('St. Joseph the Worker Parish'),
        coverImageAlt: 'Couples listening attentively during pre-cana lecture',
        startDate: formatDate(1),
        endDate: formatDate(1),
        startTime: '09:00 AM',
        endTime: '04:00 PM',
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
        id: 'ev-p2-mass',
        title: 'Sunday High Mass',
        description: 'Highland community Holy Eucharist in honor of St. Joseph the Worker.',
        category: 'Holy Mass',
        parishId: 'p2',
        parishName: 'St. Joseph the Worker Parish',
        coverImage: getParishImage('St. Joseph the Worker Parish'),
        coverImageAlt: 'Malaiba highland church sanctuary',
        startDate: formatDate(2),
        endDate: formatDate(2),
        startTime: '07:00 AM',
        endTime: '08:15 AM',
        location: 'Main Sanctuary',
        organizer: 'Liturgical Ministry',
        contactPerson: 'Elena D. Reyes',
        contactNumber: '+63 918 222 3333',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },

      // ─── p3: Our Lady of Peace and Good Voyage Parish ───
      {
        id: 'ev-p3-fiesta',
        title: 'Solemn Novena & Procession of Our Lady',
        description: 'Devotional novena prayers and solemn floral procession honoring Our Lady of Peace and Good Voyage with special blessing for travelers and overseas workers.',
        category: 'Fiesta',
        parishId: 'p3',
        parishName: 'Our Lady of Peace and Good Voyage Parish',
        coverImage: getParishImage('Our Lady of Peace and Good Voyage Parish'),
        coverImageAlt: 'Procession honoring Our Lady of Peace and Good Voyage',
        startDate: formatDate(2),
        endDate: formatDate(2),
        startTime: '05:00 PM',
        endTime: '07:30 PM',
        location: 'Parish Grounds & Coastal Highway',
        organizer: 'Confraternity of Our Lady',
        contactPerson: 'Sis. Remedios Tan',
        contactNumber: '+63 920 333 4444',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },
      {
        id: 'ev-p3-mass',
        title: 'First Friday Devotional Mass & Adoration',
        description: 'Join the community in honoring the Sacred Heart of Jesus. Exposition of the Blessed Sacrament and confessions will start one hour prior to the Holy Mass.',
        category: 'Holy Mass',
        parishId: 'p3',
        parishName: 'Our Lady of Peace and Good Voyage Parish',
        coverImage: getParishImage('Our Lady of Peace and Good Voyage Parish'),
        coverImageAlt: 'Altar sanctuary candlelit atmosphere',
        startDate: formatDate(3),
        endDate: formatDate(3),
        startTime: '06:00 PM',
        endTime: '08:00 PM',
        location: 'Main Altar Chapel',
        organizer: 'Liturgical Committee',
        contactPerson: 'Sis. Elena Cruz',
        contactNumber: '+63 930 222 1111',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },

      // ─── p4: St. Vincent Ferrer Parish ───
      {
        id: 'ev-p4-outreach',
        title: 'Barangay Community Food Share & Outreach',
        description: 'Bringing care and packages of basic necessities to families in remote mountainous sectors of our vicariate. Volunteers and dry goods donations are highly welcomed.',
        category: 'Other',
        parishId: 'p4',
        parishName: 'St. Vincent Ferrer Parish',
        coverImage: getParishImage('St. Vincent Ferrer Parish'),
        coverImageAlt: 'Volunteers distributing food relief boxes to local families',
        startDate: formatDate(3),
        endDate: formatDate(3),
        startTime: '07:30 AM',
        endTime: '12:00 PM',
        location: 'Brgy. Upper Budlasan Covered Court',
        organizer: 'Social Action Center Office',
        contactPerson: 'Sis. Clara / Secretary',
        contactNumber: '+63 908 123 4567',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },
      {
        id: 'ev-p4-mass',
        title: 'Sunday Healing & Thanksgiving Mass',
        description: 'Holy Eucharistic celebration with blessing of the sick and thanksgiving prayers.',
        category: 'Holy Mass',
        parishId: 'p4',
        parishName: 'St. Vincent Ferrer Parish',
        coverImage: getParishImage('St. Vincent Ferrer Parish'),
        coverImageAlt: 'St Vincent Ferrer Sanctuary',
        startDate: formatDate(1),
        endDate: formatDate(1),
        startTime: '08:00 AM',
        endTime: '09:30 AM',
        location: 'Main Church',
        organizer: 'Healing Ministry',
        contactPerson: 'Bro. Andres Rivera',
        contactNumber: '+63 919 444 5555',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },

      // ─── p5: Santa Catalina de Alejandria Parish ───
      {
        id: 'ev-p5-retreat',
        title: 'Spiritual Recollection & Healing Liturgy',
        description: 'A day of recollection, meditation, and sacramental confession to prepare our hearts for the diocesan jubilee. Includes guided spiritual talks and silent adoration periods.',
        category: 'Other',
        parishId: 'p5',
        parishName: 'Santa Catalina de Alejandria Parish',
        coverImage: getParishImage('Santa Catalina de Alejandria Parish'),
        coverImageAlt: 'Quiet sanctuary garden overlooking mountains under sunset',
        startDate: formatDate(4),
        endDate: formatDate(4),
        startTime: '08:00 AM',
        endTime: '04:00 PM',
        location: 'Parish Pastoral Hall',
        organizer: 'Apostleship of Prayer Committee',
        contactPerson: 'Fr. Thomas Aquinas',
        contactNumber: '+63 920 999 8888',
        featured: true,
        status: 'upcoming',
        registrationRequired: true,
        maxParticipants: 80,
        currentParticipants: 42
      },
      {
        id: 'ev-p5-mass',
        title: 'Sunday Misa Mayor',
        description: 'Principal Sunday Eucharistic sacrifice of the parish community.',
        category: 'Holy Mass',
        parishId: 'p5',
        parishName: 'Santa Catalina de Alejandria Parish',
        coverImage: getParishImage('Santa Catalina de Alejandria Parish'),
        coverImageAlt: 'Santa Catalina Altar',
        startDate: formatDate(2),
        endDate: formatDate(2),
        startTime: '06:30 AM',
        endTime: '07:45 AM',
        location: 'Main Sanctuary',
        organizer: 'Parish Liturgical Team',
        contactPerson: 'Teresa Morales',
        contactNumber: '+63 922 555 6666',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },

      // ─── p6: San Juan Nepomuceno Parish ───
      {
        id: 'ev-p6-catechism',
        title: 'Parish Catechetical & Bible Formation Workshop',
        description: 'Faith formation seminar for catechists, youth leaders, and parishioners focusing on the Gospel readings and practical Christian living.',
        category: 'Seminar',
        parishId: 'p6',
        parishName: 'San Juan Nepomuceno Parish',
        coverImage: getParishImage('San Juan Nepomuceno Parish'),
        coverImageAlt: 'Parishioners engaged in biblical study group',
        startDate: formatDate(3),
        endDate: formatDate(3),
        startTime: '09:00 AM',
        endTime: '12:00 PM',
        location: 'Parish Catechetical Hall',
        organizer: 'Catechetical Ministry',
        contactPerson: 'Mrs. Dolores Pelaez',
        contactNumber: '+63 945 333 4444',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },
      {
        id: 'ev-p6-mass',
        title: 'Sunday Community Mass',
        description: 'Weekly Eucharistic celebration uniting families in prayer.',
        category: 'Holy Mass',
        parishId: 'p6',
        parishName: 'San Juan Nepomuceno Parish',
        coverImage: getParishImage('San Juan Nepomuceno Parish'),
        coverImageAlt: 'San Juan Sanctuary',
        startDate: formatDate(1),
        endDate: formatDate(1),
        startTime: '07:30 AM',
        endTime: '08:45 AM',
        location: 'Main Church',
        organizer: 'Parish Pastoral Council',
        contactPerson: 'Bro. Philip Garcia',
        contactNumber: '+63 927 666 7777',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      },

      // ─── p7: Our Lady of the Pillar Parish ───
      {
        id: 'ev-p7-formation',
        title: 'Catholic Social Teachings & Ecology Forum',
        description: 'An open forum exploring the Laudato Si encyclical and environmental stewardship for mountain communities in the Canlaon biosphere.',
        category: 'Seminar',
        parishId: 'p7',
        parishName: 'Our Lady of the Pillar Parish',
        coverImage: getParishImage('Our Lady of the Pillar Parish'),
        coverImageAlt: 'Lecture meeting room setup',
        startDate: formatDate(5),
        endDate: formatDate(5),
        startTime: '02:00 PM',
        endTime: '04:30 PM',
        location: 'Pillar Multi-Purpose Center',
        organizer: 'Parish Intellectual Apostolate',
        contactPerson: 'Dr. Salvador Roxas',
        contactNumber: '+63 966 444 8888',
        featured: true,
        status: 'upcoming',
        registrationRequired: true,
        maxParticipants: 100,
        currentParticipants: 35
      },
      {
        id: 'ev-p7-mass',
        title: 'Sunday Evening Youth Mass',
        description: 'Youth-led musical Eucharistic liturgy with contemporary liturgical choir.',
        category: 'Holy Mass',
        parishId: 'p7',
        parishName: 'Our Lady of the Pillar Parish',
        coverImage: getParishImage('Our Lady of the Pillar Parish'),
        coverImageAlt: 'Pillar parish sanctuary at dusk',
        startDate: formatDate(1),
        endDate: formatDate(1),
        startTime: '05:00 PM',
        endTime: '06:15 PM',
        location: 'Main Sanctuary',
        organizer: 'Parish Youth Ministry',
        contactPerson: 'Bro. Marco Castillo',
        contactNumber: '+63 933 777 8888',
        featured: true,
        status: 'upcoming',
        registrationRequired: false
      }
    ];
  }

  private sortAndFilterEvents(list: Event[]): Event[] {
    return list
      .map(e => ({
        ...e,
        status: isEventUpcoming(e) ? 'upcoming' as const : 'completed' as const
      }))
      .sort((a, b) => {
        const isUpA = a.status === 'upcoming';
        const isUpB = b.status === 'upcoming';

        if (isUpA && !isUpB) return -1;
        if (!isUpA && isUpB) return 1;

        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
  }

  async getEvents(): Promise<Event[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.sortAndFilterEvents(this.events);
  }

  async getFeaturedEvents(): Promise<Event[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const featuredList = this.events.filter(e => e.featured);
    return this.sortAndFilterEvents(featuredList);
  }

  async getEventById(id: string): Promise<Event | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const matched = this.events.find(e => e.id === id);
    if (!matched) return null;
    return {
      ...matched,
      status: isEventUpcoming(matched) ? 'upcoming' : 'completed'
    };
  }
}
