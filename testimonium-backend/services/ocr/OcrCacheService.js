import crypto from "crypto";
import { env } from "../../config/env.js";

/**
 * OcrCacheService — In-memory, in-process cache for OCR results.
 * Prevents redundant OCR API requests when parishioners perform duplicate uploads
 * of the exact same receipt image (e.g. accidental double-submit).
 *
 * Caches OCR provider outputs based on the SHA-256 hash of the compressed image buffer.
 */
class OcrCacheServiceClass {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Generates a SHA-256 hash of a buffer.
   *
   * @param {Buffer} buffer
   * @returns {string} hex hash
   */
  hash(buffer) {
    if (!buffer) return "";
    return crypto.createHash("sha256").update(buffer).digest("hex");
  }

  /**
   * Gets cached OCR result for a given hash if it exists and hasn't expired.
   *
   * @param {string} hash
   * @returns {object|null}
   */
  get(hash) {
    if (!hash || !this.cache.has(hash)) return null;

    const entry = this.cache.get(hash);

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(hash);
      return null;
    }

    // Refresh position for LRU replacement
    this.cache.delete(hash);
    this.cache.set(hash, entry);

    return entry.result;
  }

  /**
   * Caches an OCR result for a given hash with TTL.
   *
   * @param {string} hash
   * @param {object} result
   */
  set(hash, result) {
    if (!hash || !result) return;

    const ttl = env.ocr.cacheTtlMs ?? 1800000; // 30 minutes default
    const maxEntries = env.ocr.cacheMaxEntries ?? 200;

    // Enforce max entry limit (LRU style - evict oldest first)
    if (this.cache.size >= maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(hash, {
      result,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Clears the entire cache.
   */
  clear() {
    this.cache.clear();
  }
}

export const OcrCacheService = new OcrCacheServiceClass();
