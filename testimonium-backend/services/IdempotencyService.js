import crypto from "crypto";
import { prisma } from "../config/db.js";

/**
 * Normalizes and hashes the canonical request payload for idempotent comparison.
 */
export function computeRequestPayloadHash(payload) {
  const canonical = {
    parishId: Number(payload.parishId),
    documentType: String(payload.documentType || "").trim().toUpperCase(),
    applicantName: String(payload.applicantName || "").trim(),
    relationship: String(payload.relationship || "Self").trim(),
    purpose: String(payload.purpose || "").trim(),
  };
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

export class IdempotencyService {
  /**
   * Validates idempotency key format.
   * @param {string} key
   * @returns {boolean}
   */
  static isValidKey(key) {
    if (!key || typeof key !== "string") return false;
    const trimmed = key.trim();
    return trimmed.length > 0 && trimmed.length <= 128;
  }

  /**
   * Checks whether an error is a database-level unique constraint collision.
   * @param {any} err
   * @returns {boolean}
   */
  static isUniqueConstraintError(err) {
    if (!err) return false;
    if (err.code === "P2002" || err.code === "23505") return true;
    const msg = String(err.message || "");
    return (
      msg.includes("Unique constraint failed") ||
      msg.includes("unique constraint") ||
      msg.includes("idempotency_keys_user_id_key_resource_type_key")
    );
  }

  /**
   * Finds an existing idempotency record within a transaction or default client.
   */
  static async findRecord(userId, key, resourceType, tx = prisma) {
    if (!key) return null;
    const trimmedKey = String(key).trim();
    return await tx.idempotencyKey.findUnique({
      where: {
        userId_key_resourceType: {
          userId: Number(userId),
          key: trimmedKey,
          resourceType,
        },
      },
    });
  }

  /**
   * Records an idempotency key within a transaction.
   * Throws on unique constraint violation so the caller can catch and recover the winning resource.
   */
  static async recordKey(
    { userId, key, resourceType, resourceId, payloadHash },
    tx = prisma
  ) {
    const trimmedKey = String(key).trim();
    return await tx.idempotencyKey.create({
      data: {
        key: trimmedKey,
        userId: Number(userId),
        resourceType,
        resourceId: Number(resourceId),
        payloadHash: String(payloadHash),
      },
    });
  }
}
