import type { IChatProvider } from '../types';

export class DemoChatProvider implements IChatProvider {
  async sendMessage(message: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, 800));
    const lower = message.toLowerCase();
    
    if (lower.includes('schedule') || lower.includes('appointment') || lower.includes('book')) {
      return "To book an appointment for canonical interviews or seminars, please navigate to the 'Event & Appointment Scheduler' page from your dashboard menu.";
    }
    
    if (lower.includes('certificate') || lower.includes('baptism') || lower.includes('marriage') || lower.includes('document')) {
      return "You can request official sacrament certificates using our 'Sacramental Request Wizard'. Just go to the 'Request Document' section on your dashboard.";
    }
    
    return "Thank you for messaging Caloy. I am currently offline, but you can request certificates or scheduler bookings directly through the portal menu. For urgent concerns, please call the Parish office.";
  }
}
