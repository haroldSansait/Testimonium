/**
 * Ephemeral In-Memory Conversational Context Manager for Caloy
 *
 * Keeps lightweight, safe conversational context across turns so follow-ups
 * sound natural rather than unrelated commands.
 *
 * CRITICAL PRIVACY & ARCHITECTURE INVARIANTS:
 * 1. ZERO private operational data stored (no payment amounts, no OCR text, no remarks).
 * 2. ZERO database persistence (no ChatMessage table, no Prisma persistence).
 * 3. Session-scoped in-memory with automatic TTL expiration (30 minutes).
 * 4. Completely cleared upon session reset or user logout.
 */
export class ConversationContextManager {
  constructor({ ttlMs = 30 * 60 * 1000 } = {}) {
    this.ttlMs = ttlMs;
    // Map<sessionId, { context: object, updatedAt: number }>
    this.sessions = new Map();
  }

  getEmptyContext() {
    return {
      lastIntent: null,
      lastParishId: null,
      lastParishName: null,
      lastDocumentType: null,
      lastScheduleEvent: null,
      lastDatePhrase: null,
      lastTimePhrase: null,
      lastPriestName: null,
      lastPriestId: null,
      lastVicariateId: null,
      lastVicariateName: null,
      lastResponseType: null,
      pendingClarificationIntent: null,
      pendingMissingParam: null,
      pendingCollected: null,
      turnCount: 0,
    };
  }

  /**
   * Sanitizes raw context to allow only safe known fields.
   */
  sanitizeContext(raw) {
    if (!raw || typeof raw !== "object") {
      return this.getEmptyContext();
    }

    const parishId = Number(raw.lastParishId);
    const priestId = Number(raw.lastPriestId);

    let pendingCollected = null;
    if (raw.pendingCollected && typeof raw.pendingCollected === "object" && !Array.isArray(raw.pendingCollected)) {
      pendingCollected = { ...raw.pendingCollected };
    }

    const turnCount = Number.isInteger(raw.turnCount) && raw.turnCount >= 0
      ? raw.turnCount
      : (raw.lastIntent || raw.lastResponseType ? 1 : 0);

    return {
      lastIntent: typeof raw.lastIntent === "string" && raw.lastIntent.trim() ? raw.lastIntent.trim() : null,
      lastParishId: Number.isInteger(parishId) && parishId > 0 ? parishId : null,
      lastParishName: typeof raw.lastParishName === "string" && raw.lastParishName.trim() ? raw.lastParishName.trim() : null,
      lastDocumentType: typeof raw.lastDocumentType === "string" && raw.lastDocumentType.trim() ? raw.lastDocumentType.trim() : null,
      lastScheduleEvent: typeof raw.lastScheduleEvent === "string" && raw.lastScheduleEvent.trim() ? raw.lastScheduleEvent.trim() : null,
      lastDatePhrase: typeof raw.lastDatePhrase === "string" && raw.lastDatePhrase.trim() ? raw.lastDatePhrase.trim() : null,
      lastTimePhrase: typeof raw.lastTimePhrase === "string" && raw.lastTimePhrase.trim() ? raw.lastTimePhrase.trim() : null,
      lastPriestName: typeof raw.lastPriestName === "string" && raw.lastPriestName.trim() ? raw.lastPriestName.trim() : null,
      lastPriestId: Number.isInteger(priestId) && priestId > 0 ? priestId : null,
      lastVicariateId: raw.lastVicariateId !== undefined && raw.lastVicariateId !== null ? String(raw.lastVicariateId).trim() || null : null,
      lastVicariateName: typeof raw.lastVicariateName === "string" && raw.lastVicariateName.trim() ? raw.lastVicariateName.trim() : null,
      lastResponseType: typeof raw.lastResponseType === "string" && raw.lastResponseType.trim() ? raw.lastResponseType.trim() : null,
      pendingClarificationIntent: typeof raw.pendingClarificationIntent === "string" && raw.pendingClarificationIntent.trim() ? raw.pendingClarificationIntent.trim() : null,
      pendingMissingParam: typeof raw.pendingMissingParam === "string" && raw.pendingMissingParam.trim() ? raw.pendingMissingParam.trim() : null,
      pendingCollected,
      turnCount,
    };
  }

  /**
   * Retrieves context for a session, with preference for explicitly passed context.
   */
  getContext(sessionId, explicitContext = null) {
    if (explicitContext && typeof explicitContext === "object") {
      return this.sanitizeContext(explicitContext);
    }

    if (!sessionId || typeof sessionId !== "string") {
      return this.getEmptyContext();
    }

    const entry = this.sessions.get(sessionId);
    if (!entry) {
      return this.getEmptyContext();
    }

    if (Date.now() - entry.updatedAt > this.ttlMs) {
      this.sessions.delete(sessionId);
      return this.getEmptyContext();
    }

    return { ...entry.context };
  }

  /**
   * Updates context for a session.
   */
  updateContext(sessionId, newContext) {
    const existing = (sessionId && this.sessions.get(sessionId)?.context) || this.getEmptyContext();
    const merged = { ...existing, ...newContext };
    if (newContext.turnCount === undefined) {
      merged.turnCount = (existing.turnCount || 0) + 1;
    }
    const sanitized = this.sanitizeContext(merged);
    if (sessionId && typeof sessionId === "string") {
      this.sessions.set(sessionId, {
        context: sanitized,
        updatedAt: Date.now(),
      });
    }
    return sanitized;
  }

  /**
   * Clears context for a session (e.g. on logout or explicit reset).
   */
  clearSession(sessionId) {
    if (sessionId && typeof sessionId === "string") {
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Purges all expired sessions.
   */
  pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of this.sessions.entries()) {
      if (now - entry.updatedAt > this.ttlMs) {
        this.sessions.delete(key);
      }
    }
  }
}

export const defaultContextManager = new ConversationContextManager();
