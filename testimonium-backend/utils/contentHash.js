import crypto from "node:crypto";

/**
 * Computes a deterministic SHA-256 hash of UTF-8 content.
 * Returns a lowercase 64-character hex string.
 *
 * @param {string} content
 * @returns {string}
 */
export function computeContentHash(content) {
  if (content === null || content === undefined) {
    return "";
  }
  const clean = String(content);
  return crypto.createHash("sha256").update(clean, "utf8").digest("hex").toLowerCase();
}
