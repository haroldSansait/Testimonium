import type { ChatSource } from '../../providers/types';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'caloy';
  text: string;
  timestamp: string;
  fallback?: boolean;
  sources?: ChatSource[];
  isError?: boolean;
  responseType?: 'RAG' | 'FALLBACK' | 'SOCIAL' | 'CLARIFICATION' | 'LIVE_DATA';
  clarificationType?: 'PARISH' | 'DOCUMENT_TYPE' | 'SCHEDULE_EVENT' | 'DATE' | null;
  clarificationOptions?: Array<{ label: string; value: string | number }>;
  structuredClarification?: {
    originalQuestion?: string;
    toolId: string;
    collected?: Record<string, any>;
    nextRequired?: string;
  } | null;
  liveData?: {
    label: string;
    asOf: string;
    parishId?: number | null;
  };
  isRestored?: boolean;
}

export const CALOY_STORAGE_KEYS = {
  messages: 'testimonium_caloy_messages',
  sessionId: 'testimonium_caloy_session_id',
  parishId: 'testimonium_caloy_parish_id',
  pendingQuestion: 'testimonium_caloy_pending_question',
  structuredClarification: 'testimonium_caloy_structured_clarification',
  conversationContext: 'testimonium_caloy_conversation_context',
} as const;

interface CaloyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): CaloyStorage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isValidSource(value: unknown): value is ChatSource {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'number' || !Number.isInteger(value.id) || value.id <= 0) return false;
  if (typeof value.title !== 'string' || value.title.length === 0) return false;
  if (typeof value.sourceType !== 'string' || value.sourceType.length === 0) return false;
  if (typeof value.authority !== 'string' || value.authority.length === 0) return false;
  if (typeof value.scope !== 'string' || value.scope.length === 0) return false;
  if (!isOptionalString(value.sourceReference)) return false;
  if (value.parishId !== undefined && value.parishId !== null && (
    typeof value.parishId !== 'number' || !Number.isInteger(value.parishId) || value.parishId <= 0
  )) {
    return false;
  }
  return true;
}

export function isValidChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.length === 0) return false;
  if (value.sender !== 'user' && value.sender !== 'caloy') return false;
  if (typeof value.text !== 'string') return false;
  if (typeof value.timestamp !== 'string' || Number.isNaN(Date.parse(value.timestamp))) return false;
  if (value.fallback !== undefined && typeof value.fallback !== 'boolean') return false;
  if (value.isError !== undefined && typeof value.isError !== 'boolean') return false;
  if (value.sources !== undefined && (!Array.isArray(value.sources) || !value.sources.every(isValidSource))) return false;
  if (value.responseType !== undefined && !['RAG', 'FALLBACK', 'SOCIAL', 'CLARIFICATION', 'LIVE_DATA'].includes(value.responseType as string)) return false;
  if (value.clarificationType !== undefined && value.clarificationType !== null && !['PARISH', 'DOCUMENT_TYPE', 'SCHEDULE_EVENT', 'DATE'].includes(value.clarificationType as string)) return false;
  if (value.isRestored !== undefined && typeof value.isRestored !== 'boolean') return false;
  return true;
}

export function parseCaloyMessages(rawValue: string): ChatMessage[] | null {
  try {
    const parsed: unknown = JSON.parse(rawValue);
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidChatMessage)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function readCaloyMessages(storage: CaloyStorage | null = defaultStorage()): ChatMessage[] | null {
  if (!storage) return null;
  try {
    const rawValue = storage.getItem(CALOY_STORAGE_KEYS.messages);
    if (!rawValue) return null;
    const messages = parseCaloyMessages(rawValue);
    if (!messages) {
      storage.removeItem(CALOY_STORAGE_KEYS.messages);
      return null;
    }
    // Mark restored messages so animation doesn't replay
    return messages.map((m) => ({ ...m, isRestored: true }));
  } catch {
    return null;
  }
}

export function writeCaloyMessages(messages: ChatMessage[], storage: CaloyStorage | null = defaultStorage()): boolean {
  if (!storage || messages.length === 0 || !messages.every(isValidChatMessage)) return false;
  try {
    storage.setItem(CALOY_STORAGE_KEYS.messages, JSON.stringify(messages));
    return true;
  } catch {
    return false;
  }
}

export function clearCaloySessionStorage(storage: CaloyStorage | null = defaultStorage()): void {
  if (!storage) return;
  for (const key of Object.values(CALOY_STORAGE_KEYS)) {
    try {
      storage.removeItem(key);
    } catch {
      // Best-effort cleanup must not prevent logout.
    }
  }
}

export function getPendingQuestion(storage: CaloyStorage | null = defaultStorage()): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CALOY_STORAGE_KEYS.pendingQuestion);
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
  } catch {
    return null;
  }
}

export function setPendingQuestion(question: string, storage: CaloyStorage | null = defaultStorage()): boolean {
  if (!storage || !question || typeof question !== 'string') return false;
  try {
    storage.setItem(CALOY_STORAGE_KEYS.pendingQuestion, question.trim());
    return true;
  } catch {
    return false;
  }
}

export function clearPendingQuestion(storage: CaloyStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(CALOY_STORAGE_KEYS.pendingQuestion);
  } catch {}
}

export function getStructuredClarification(storage: CaloyStorage | null = defaultStorage()): any | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CALOY_STORAGE_KEYS.structuredClarification);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStructuredClarification(data: any, storage: CaloyStorage | null = defaultStorage()): boolean {
  if (!storage || !data || typeof data !== 'object') return false;
  try {
    storage.setItem(CALOY_STORAGE_KEYS.structuredClarification, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearStructuredClarification(storage: CaloyStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(CALOY_STORAGE_KEYS.structuredClarification);
  } catch {}
}

export function getConversationContext(storage: CaloyStorage | null = defaultStorage()): any | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CALOY_STORAGE_KEYS.conversationContext);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setConversationContext(data: any, storage: CaloyStorage | null = defaultStorage()): boolean {
  if (!storage || !data || typeof data !== 'object') return false;
  try {
    storage.setItem(CALOY_STORAGE_KEYS.conversationContext, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearConversationContext(storage: CaloyStorage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(CALOY_STORAGE_KEYS.conversationContext);
  } catch {}
}
