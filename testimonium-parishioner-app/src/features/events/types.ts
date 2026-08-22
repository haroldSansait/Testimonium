export interface PublicEventDto {
  id: number | string;
  parishId: number;
  title: string;
  eventType: string;
  description: string | null;
  location: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  parish?: {
    id: number;
    parishName: string;
  };
}

export interface MonthParams {
  year: number;
  month: number;
}
