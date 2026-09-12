export type CaloyResponseType = "LIVE_DATA" | "RAG" | "SOCIAL" | "CLARIFICATION" | "FALLBACK";

export interface CaloySource {
  id: number;
  title: string;
  sourceType?: string | null;
  sourceReference?: string | null;
  authority?: string | null;
  scope?: string | null;
  parishId?: number | null;
}

export interface CaloyLiveData {
  label: string;
  asOf?: string | null;
  parishId?: number | null;
  [key: string]: unknown;
}

export interface CaloyClarificationOption {
  label: string;
  value: string;
}

export interface CaloyClarificationData {
  id?: string;
  originalQuestion?: string;
  originalIntent?: string;
  toolId?: string;
  collected?: Record<string, unknown>;
  missing?: string;
  nextRequired?: string;
  clarificationType?: "PARISH" | "DOCUMENT_TYPE" | "SCHEDULE_EVENT" | "DATE" | "TIME" | "PRIEST" | string;
  clarificationOptions?: CaloyClarificationOption[];
  selectedValue?: string | number | null;
  isButtonSelection?: boolean;
}

export interface CaloyMessage {
  id: string;
  sender: "user" | "caloy";
  text: string;
  timestamp: number;
  responseType?: CaloyResponseType;
  sources?: CaloySource[];
  liveData?: CaloyLiveData;
  structuredClarification?: CaloyClarificationData;
  isError?: boolean;
  isRevealing?: boolean;
}

export interface CaloyPersistedState {
  version: 2;
  sessionId: string;
  selectedParishId: number | null;
  selectedParishName: string | null;
  conversationContext: Record<string, unknown> | null;
  structuredClarification: CaloyClarificationData | null;
  updatedAt: number;
}

export interface CaloyQueryRequest {
  question: string;
  sessionId?: string | null;
  selectedParishId?: number | null;
  structuredClarification?: CaloyClarificationData | null;
  conversationContext?: Record<string, unknown> | null;
}

export interface CaloyQueryResponse {
  answer: string;
  fallback: boolean;
  fallbackReason: string | null;
  responseType: CaloyResponseType;
  sessionId: string;
  category: string | null;
  sources: CaloySource[];
  liveData?: CaloyLiveData;
  structuredClarification?: CaloyClarificationData;
  conversationContext?: Record<string, unknown>;
  clarificationType?: string;
  clarificationOptions?: CaloyClarificationOption[];
}
