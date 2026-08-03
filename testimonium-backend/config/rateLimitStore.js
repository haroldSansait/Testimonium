import { MemoryStore } from "express-rate-limit";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * FailSafeMemoryStore extends express-rate-limit's MemoryStore class
 * while adding fail-open error handling for custom store implementations.
 */
class FailSafeMemoryStore extends MemoryStore {
  constructor(prefix = "rl:") {
    super();
    this.prefix = prefix;
  }

  async increment(key) {
    try {
      return await super.increment(key);
    } catch (err) {
      logger.error({ err, key, prefix: this.prefix }, "[RateLimitStore] Store error in increment — failing open");
      return { totalHits: 1, resetTime: new Date(Date.now() + 60000) };
    }
  }

  async decrement(key) {
    try {
      return await super.decrement(key);
    } catch (err) {
      logger.error({ err, key, prefix: this.prefix }, "[RateLimitStore] Store error in decrement — failing open");
    }
  }

  async resetKey(key) {
    try {
      return await super.resetKey(key);
    } catch (err) {
      logger.error({ err, key, prefix: this.prefix }, "[RateLimitStore] Store error in resetKey — failing open");
    }
  }
}

/**
 * Factory function for creating rate limiter stores.
 * Default is FailSafeMemoryStore, extensible to RedisStore when Redis environment is active.
 */
export function createRateLimitStore(prefix = "rl:") {
  const storeType = env.rateLimits?.storeType || "memory";

  if (storeType === "redis") {
    logger.info({ prefix }, "[RateLimitStore] Redis store requested — falling back to MemoryStore until Redis connection is initialized");
  }

  return new FailSafeMemoryStore(prefix);
}
