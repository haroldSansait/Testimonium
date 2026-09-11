import { env } from "../../config/env.js";

/**
 * In-Memory Sliding Window AI Quota Tracker for Caloy
 *
 * Tracks substantive AI/RAG query consumption per user.
 * Zero-cost paths (social, capabilities, clarification, live tools) NEVER invoke this tracker.
 */
export class AiQuotaTracker {
  constructor({
    tenMinuteMax = null,
    dailyMax = null,
    tenMinuteWindowMs = null,
    dailyWindowMs = null,
  } = {}) {
    this.tenMinuteMax = tenMinuteMax ?? (env.chatbot?.rateLimits?.aiTenMinuteMax || 20);
    this.dailyMax = dailyMax ?? (env.chatbot?.rateLimits?.aiDailyMax || 50);
    this.tenMinuteWindowMs = tenMinuteWindowMs ?? (10 * 60 * 1000);
    this.dailyWindowMs = dailyWindowMs ?? (24 * 60 * 60 * 1000);

    // Map<identifier, Array<timestamp>>
    this.timestamps = new Map();
  }

  /**
   * Cleans timestamps older than the maximum window (24h).
   */
  prune(identifier, now) {
    const list = this.timestamps.get(identifier);
    if (!list) return [];
    const minTime = now - this.dailyWindowMs;
    const pruned = list.filter((t) => t > minTime);
    if (pruned.length === 0) {
      this.timestamps.delete(identifier);
      return [];
    }
    this.timestamps.set(identifier, pruned);
    return pruned;
  }

  /**
   * Checks whether the user's limit is currently exceeded without consuming quota.
   */
  isLimitExceeded(identifier, now = Date.now()) {
    const key = String(identifier || "anonymous");
    const history = this.prune(key, now);
    const tenMinStart = now - this.tenMinuteWindowMs;
    const hits10m = history.filter((t) => t > tenMinStart);
    if (hits10m.length >= this.tenMinuteMax) return true;
    if (history.length >= this.dailyMax) return true;
    return false;
  }

  /**
   * Checks whether the user can make an AI request and consumes 1 quota token if allowed.
   *
   * @param {string|number} identifier User ID or IP
   * @param {number} [now] Optional timestamp for deterministic testing
   * @returns {{ allowed: boolean, retryAfter?: number, code?: string, message?: string }}
   */
  consume(identifier, now = Date.now()) {
    const key = String(identifier || "anonymous");
    const history = this.prune(key, now);

    // 1. Check 10-minute window
    const tenMinStart = now - this.tenMinuteWindowMs;
    const hits10m = history.filter((t) => t > tenMinStart);

    if (hits10m.length >= this.tenMinuteMax) {
      const oldest10m = hits10m[0];
      const resetTime = oldest10m + this.tenMinuteWindowMs;
      const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));

      return {
        allowed: false,
        code: "CHATBOT_AI_LIMIT_REACHED",
        message: "You've reached Caloy's AI question limit for now. You can still use basic assistant features, or try again in a few minutes.",
        retryAfter,
      };
    }

    // 2. Check 24-hour daily window
    if (history.length >= this.dailyMax) {
      const oldestDaily = history[0];
      const resetTime = oldestDaily + this.dailyWindowMs;
      const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));

      return {
        allowed: false,
        code: "CHATBOT_AI_LIMIT_REACHED",
        message: "You've reached Caloy's daily AI question limit. You can still use basic assistant features, or try again tomorrow.",
        retryAfter,
      };
    }

    // Allowed -> record current invocation
    history.push(now);
    this.timestamps.set(key, history);

    return { allowed: true };
  }

  /**
   * Reset helper for unit testing
   */
  reset(identifier = null) {
    if (identifier) {
      this.timestamps.delete(String(identifier));
    } else {
      this.timestamps.clear();
    }
  }
}

export const defaultAiQuotaTracker = new AiQuotaTracker();
