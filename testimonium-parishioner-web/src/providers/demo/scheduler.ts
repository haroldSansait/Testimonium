import type { ISchedulerProvider } from '../types';
import type { Appointment } from '../../types';

const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt1',
    parishId: 'p1',
    serviceName: 'Baptism Interview',
    date: '2026-07-15',
    timeSlot: '09:30 AM - 10:30 AM',
    status: 'confirmed',
    confirmationNumber: 'APT-15792'
  },
  {
    id: 'apt2',
    parishId: 'p2',
    serviceName: 'Marriage Canonical Interview',
    date: '2026-07-20',
    timeSlot: '02:00 PM - 03:00 PM',
    status: 'booked',
    confirmationNumber: 'APT-24681'
  }
];

export class DemoSchedulerProvider implements ISchedulerProvider {
  private appointments: Appointment[];

  constructor() {
    const cached = localStorage.getItem('testimonium_demo_appointments');
    if (cached) {
      try {
        this.appointments = JSON.parse(cached);
      } catch {
        this.appointments = INITIAL_APPOINTMENTS;
      }
    } else {
      this.appointments = INITIAL_APPOINTMENTS;
      localStorage.setItem('testimonium_demo_appointments', JSON.stringify(this.appointments));
    }
  }

  private save() {
    localStorage.setItem('testimonium_demo_appointments', JSON.stringify(this.appointments));
  }

  async getAppointments(): Promise<Appointment[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...this.appointments];
  }

  async getAvailableSlots(_parishId: string, date: string): Promise<string[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    const targetDate = new Date(date);
    const isSaturday = targetDate.getDay() === 6;
    const slots = isSaturday 
      ? [
          '06:00 AM',
          '08:30 AM - 09:30 AM',
          '09:30 AM - 10:30 AM',
          '10:30 AM - 11:30 AM',
          '01:30 PM - 02:30 PM',
          '02:30 PM - 03:30 PM',
          '03:30 PM - 04:30 PM'
        ]
      : [
          '08:30 AM - 09:30 AM',
          '09:30 AM - 10:30 AM',
          '10:30 AM - 11:30 AM',
          '01:30 PM - 02:30 PM',
          '02:30 PM - 03:30 PM',
          '03:30 PM - 04:30 PM'
        ];
    return slots;
  }

  async bookAppointment(appointment: {
    parishId: string;
    serviceName: string;
    date: string;
    timeSlot: string;
    location?: string;
  }): Promise<Appointment> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const confirmationNumber = `APT-${randomSuffix}`;
    const newAppointment: Appointment = {
      id: `apt_${Date.now()}`,
      parishId: appointment.parishId,
      serviceName: appointment.serviceName,
      date: appointment.date,
      timeSlot: appointment.timeSlot,
      status: 'booked',
      confirmationNumber
    };
    this.appointments.unshift(newAppointment);
    this.save();
    return newAppointment;
  }

  async respondReschedule(id: string, accept: boolean): Promise<Appointment> {
    this.appointments = this.appointments.map(a => {
      if (a.id === id) {
        return {
          ...a,
          status: accept ? 'confirmed' : 'cancelled',
          date: accept && a.proposedDate ? a.proposedDate : a.date,
          timeSlot: accept && a.proposedTime ? a.proposedTime : a.timeSlot,
        } as Appointment;
      }
      return a;
    });
    this.save();
    const match = this.appointments.find(a => a.id === id);
    if (!match) throw new Error(`Appointment ${id} not found`);
    return match;
  }
}
