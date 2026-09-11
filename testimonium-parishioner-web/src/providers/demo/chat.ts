import type { IChatProvider, ChatResponse } from '../types';

export class DemoChatProvider implements IChatProvider {
  async sendMessage(
    question: string,
    selectedParishId?: number | null,
    sessionId?: string
  ): Promise<ChatResponse> {
    await new Promise(resolve => setTimeout(resolve, 600));
    const lower = question.toLowerCase();

    let answer = "Thank you for messaging Caloy. I am currently offline, but you can request certificates or scheduler bookings directly through the portal menu. For urgent concerns, please call the Parish office.";
    let category = "GENERAL";

    if (lower.includes('schedule') || lower.includes('appointment') || lower.includes('book')) {
      answer = "To book an appointment for canonical interviews or seminars, please navigate to the 'Event & Appointment Scheduler' page from your dashboard menu.";
      category = "SCHEDULING";
    } else if (lower.includes('certificate') || lower.includes('baptism') || lower.includes('marriage') || lower.includes('document')) {
      answer = "You can request official sacrament certificates using our 'Sacramental Request Wizard'. Just go to the 'Request Document' section on your dashboard.";
      category = "DOCUMENT_REQUESTS";
    }

    return {
      answer,
      fallback: false,
      fallbackReason: null,
      sessionId: sessionId || 'demo_session',
      category,
      sources: [
        {
          id: 1,
          title: "TESTIMONIUM Portal Guide",
          sourceType: "SYSTEM_GUIDE",
          sourceReference: "https://testimonium.dioceseofbacolod.org",
          authority: "CONFIRMED",
          scope: selectedParishId ? "PARISH" : "DIOCESE",
          parishId: selectedParishId || null,
        },
      ],
    };
  }
}
