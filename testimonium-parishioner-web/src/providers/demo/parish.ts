import type { IParishProvider } from '../types';
import type { Parish } from '../../types';

// Import local placeholder images (temporary assets, to be replaced by actual parish photos)
import p1Img from '../../assets/parishes/p1.png';
import p2Img from '../../assets/parishes/p2.png';
import p3Img from '../../assets/parishes/p3.png';
import p4Img from '../../assets/parishes/p4.png';
import p5Img from '../../assets/parishes/p5.png';
import p6Img from '../../assets/parishes/p6.png';
import p7Img from '../../assets/parishes/p7.png';

const DEMO_PARISHES: Parish[] = [
  {
    id: 'p1',
    name: 'San Isidro Labrador Parish',
    address: 'National Highway, Poblacion, Canlaon City',
    city: 'Canlaon City',
    province: 'Negros Oriental',
    coordinates: { lat: 10.3837, lng: 123.1972 },
    coverImage: p1Img,
    gallery: [p1Img],
    phone: '+63 917 123 4567',
    email: 'sanisidro.canlaon@diocesesancarlos.org',
    facebookPage: 'https://facebook.com/sanisidrocanlaon',
    officeHours: 'Tuesday - Sunday: 8:00 AM - 12:00 PM, 1:30 PM - 5:00 PM',
    patronSaint: 'Saint Isidore the Laborer',
    feastDay: 'May 15',
    description: 'Serving the faithful in the heart of Canlaon City, the San Isidro Labrador Parish stands as a historical beacon of spiritual sanctuary and agricultural blessing in the diocese.',
    assignedPriest: 'Rev. Fr. Teodoro A. Villanueva',
    assignedSecretary: 'Maria Clara Santos',
    massSchedules: [
      'Sunday: 6:00 AM, 8:30 AM, 10:00 AM (Youth), 5:30 PM',
      'Monday - Saturday: 6:00 AM',
      'Wednesday & Friday: 5:30 PM'
    ],
    upcomingEvents: [
      'Parish Fiesta Celebrations - May 15',
      'Solemnity of Corpus Christi Procession - June 18',
      'Youth Camp and Recollection - July 22-25'
    ],
    services: ['Baptism', 'Confirmation', 'Marriage', 'Funeral Mass', 'Sick Call', 'Blessings']
  },
  {
    id: 'p2',
    name: 'St. Joseph the Worker Parish',
    address: 'Brgy. Malaiba, Canlaon City',
    city: 'Canlaon City',
    province: 'Negros Oriental',
    coordinates: { lat: 10.4200, lng: 123.2300 },
    coverImage: p2Img,
    gallery: [p2Img],
    phone: '+63 918 222 3333',
    email: 'stjoseph.malaiba@diocesesancarlos.org',
    facebookPage: 'https://facebook.com/stjosephmalaiba',
    officeHours: 'Monday - Saturday: 8:00 AM - 12:00 PM, 1:00 PM - 4:00 PM',
    patronSaint: 'Saint Joseph the Worker',
    feastDay: 'May 1',
    description: 'Located in the highlands of Malaiba, this parish serves a vibrant agricultural community. Our community works together in dedication under the patronage of St. Joseph.',
    assignedPriest: 'Rev. Fr. Emmanuel G. Cruz',
    assignedSecretary: 'Elena D. Reyes',
    massSchedules: [
      'Sunday: 7:00 AM, 9:30 AM, 4:00 PM',
      'Monday - Saturday: 6:30 AM'
    ],
    upcomingEvents: [
      'Feast of St. Joseph Celebration - May 1',
      'Livelihood Training Seminar - August 10'
    ],
    services: ['Baptism', 'Confirmation', 'Marriage', 'Funeral Mass', 'Blessings']
  },
  {
    id: 'p3',
    name: 'Our Lady of Mount Carmel Parish',
    address: 'Brgy. Masulog, Canlaon City',
    city: 'Canlaon City',
    province: 'Negros Oriental',
    coordinates: { lat: 10.3750, lng: 123.1850 },
    coverImage: p3Img,
    gallery: [p3Img],
    phone: '+63 920 444 5555',
    email: 'mtcarmel.masulog@diocesesancarlos.org',
    facebookPage: 'https://facebook.com/mtcarmelmasulog',
    officeHours: 'Tuesday - Saturday: 9:00 AM - 12:00 PM, 2:00 PM - 5:00 PM',
    patronSaint: 'Our Lady of Mount Carmel',
    feastDay: 'July 16',
    description: 'Nestled near the foothill of Mt. Kanlaon, this parish is a sanctuary of silence, prayer, and Marian devotion for pilgrims and parishioners alike.',
    assignedPriest: 'Rev. Fr. John Paul O. Lopez',
    assignedSecretary: 'Teresa Alcala',
    massSchedules: [
      'Sunday: 7:30 AM, 9:30 AM, 6:00 PM',
      'Tuesday - Saturday: 6:00 AM'
    ],
    upcomingEvents: [
      'Feast of Our Lady of Mount Carmel - July 16',
      'Marian Procession & Rosary Crusade - October 8'
    ],
    services: ['Baptism', 'Confirmation', 'Marriage', 'Blessings', 'Confession']
  },
  {
    id: 'p4',
    name: 'St. Francis Xavier Parish',
    address: 'Poblacion, Vallehermoso',
    city: 'Vallehermoso',
    province: 'Negros Oriental',
    coordinates: { lat: 10.3328, lng: 123.3278 },
    coverImage: p4Img,
    gallery: [p4Img],
    phone: '+63 919 987 6543',
    email: 'stfrancis.vallehermoso@diocesesancarlos.org',
    facebookPage: 'https://facebook.com/stfrancisvallehermoso',
    officeHours: 'Tuesday - Sunday: 8:30 AM - 12:00 PM, 1:30 PM - 4:30 PM',
    patronSaint: 'Saint Francis Xavier',
    feastDay: 'December 3',
    description: 'Vallehermoso\'s historical parish church dedicates itself to missionary outreach and spiritual education, following the footsteps of patron St. Francis Xavier.',
    assignedPriest: 'Rev. Fr. Mario S. Gabor',
    assignedSecretary: 'Juana Dela Cruz',
    massSchedules: [
      'Sunday: 6:30 AM, 8:30 AM, 5:00 PM',
      'Monday - Saturday: 6:00 AM'
    ],
    upcomingEvents: [
      'Fiesta & Thanksgiving Novena - November 24 - December 3',
      'Missionary Recollection Day - September 18'
    ],
    services: ['Baptism', 'Confirmation', 'Marriage', 'Funeral Mass', 'Sick Call', 'Blessings']
  },
  {
    id: 'p5',
    name: 'Our Lady of the Holy Rosary Parish',
    address: 'National Highway, Guihulngan City',
    city: 'Guihulngan City',
    province: 'Negros Oriental',
    coordinates: { lat: 10.1206, lng: 123.2725 },
    coverImage: p5Img,
    gallery: [p5Img],
    phone: '+63 939 111 2222',
    email: 'holyrosary.guihulngan@diocesesancarlos.org',
    facebookPage: 'https://facebook.com/holyrosaryguihulngan',
    officeHours: 'Tuesday - Sunday: 8:00 AM - 12:00 PM, 1:30 PM - 5:00 PM',
    patronSaint: 'Our Lady of the Holy Rosary',
    feastDay: 'October 7',
    description: 'Serving as the centerpiece of Guihulngan City, the parish is home to active rosary guilds and parish organizations dedicated to social and spiritual upliftment.',
    assignedPriest: 'Rev. Fr. Roberto C. Manuel',
    assignedSecretary: 'Lydia M. Perez',
    massSchedules: [
      'Sunday: 6:00 AM, 8:00 AM, 10:00 AM, 5:30 PM',
      'Monday - Saturday: 6:00 AM',
      'Wednesday: 5:30 PM'
    ],
    upcomingEvents: [
      'Parish Rosary Month Launch - October 1',
      'Feast Day Marian Procession - October 7'
    ],
    services: ['Baptism', 'Confirmation', 'Marriage', 'Funeral Mass', 'Blessings']
  },
  {
    id: 'p6',
    name: 'St. Vincent Ferrer Parish',
    address: 'Poblacion, La Libertad',
    city: 'La Libertad',
    province: 'Negros Oriental',
    coordinates: { lat: 10.0244, lng: 123.2306 },
    coverImage: p6Img,
    gallery: [p6Img],
    phone: '+63 947 555 6666',
    email: 'stvincent.lalibertad@diocesesancarlos.org',
    facebookPage: 'https://facebook.com/stvincentlalibertad',
    officeHours: 'Tuesday - Saturday: 8:00 AM - 12:00 PM, 1:00 PM - 4:00 PM',
    patronSaint: 'Saint Vincent Ferrer',
    feastDay: 'April 5',
    description: 'Focusing heavily on basic ecclesial communities (BEC), this parish has been a warm sanctuary of faith, love, and mission for the citizens of La Libertad.',
    assignedPriest: 'Rev. Fr. Nemesio T. Gomez',
    assignedSecretary: 'Cecilia B. Lopez',
    massSchedules: [
      'Sunday: 7:00 AM, 9:00 AM, 5:00 PM',
      'Tuesday - Saturday: 6:30 AM'
    ],
    upcomingEvents: [
      'BEC Annual Assembly - March 22',
      'Feast Day Celebrations - April 5'
    ],
    services: ['Baptism', 'Confirmation', 'Marriage', 'Funeral Mass', 'Blessings', 'Sick Call']
  },
  {
    id: 'p7',
    name: 'St. Augustine Parish',
    address: 'Poblacion, Jimalalud',
    city: 'Jimalalud',
    province: 'Negros Oriental',
    coordinates: { lat: 9.9880, lng: 123.2010 },
    coverImage: p7Img,
    gallery: [p7Img],
    phone: '+63 956 777 8888',
    email: 'staugustine.jimalalud@diocesesancarlos.org',
    facebookPage: 'https://facebook.com/staugustinejimalalud',
    officeHours: 'Tuesday - Sunday: 8:30 AM - 12:00 PM, 1:30 PM - 4:30 PM',
    patronSaint: 'Saint Augustine of Hippo',
    feastDay: 'August 28',
    description: 'Forming minds and hearts in Jimalalud, this coastal parish church stands as a historic monument to Augustinian history and spiritual guidance.',
    assignedPriest: 'Rev. Fr. Arnold F. Esteva',
    assignedSecretary: 'Grace S. Valencia',
    massSchedules: [
      'Sunday: 6:30 AM, 8:30 AM, 4:30 PM',
      'Monday - Saturday: 6:00 AM'
    ],
    upcomingEvents: [
      'Solemnity Feast of St. Augustine - August 28',
      'Catechism Teachers Workshop - June 15-17'
    ],
    services: ['Baptism', 'Confirmation', 'Marriage', 'Funeral Mass', 'Blessings']
  }
];

export class DemoParishProvider implements IParishProvider {
  async getParishes(): Promise<Parish[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return DEMO_PARISHES;
  }

  async getParishById(id: string): Promise<Parish | null> {
    await new Promise(resolve => setTimeout(resolve, 150));
    return DEMO_PARISHES.find(p => p.id === id) || null;
  }
}
