import { prisma as defaultPrisma } from "../config/db.js";
import { logger } from "../config/logger.js";

/**
 * Service for acquiring and releasing cluster-wide distributed database leases.
 * Uses atomic INSERT ... ON CONFLICT DO UPDATE on system_leases table.
 */
export class SystemLeaseService {
  constructor(prismaClient = defaultPrisma) {
    this.prisma = prismaClient;
  }

  /**
   * Attempts to atomically acquire a lease for the given key and owner token.
   *
   * @param {string} leaseKey - e.g. "CALOY_TELEMETRY_RETENTION"
   * @param {string} ownerToken - UUID identifying this worker instance
   * @param {number} durationSeconds - Lease duration before expiry (e.g. 300s)
   * @returns {Promise<boolean>} true if lease acquired, false otherwise
   */
  async acquireLease(leaseKey, ownerToken, durationSeconds = 300) {
    try {
      const ttlSeconds = Number(durationSeconds);
      if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 172800) {
        throw new Error('Lease duration must be an integer between 1 and 172800 seconds');
      }
      const rows = await this.prisma.$queryRaw`
        INSERT INTO "system_leases" ("lease_key", "owner_token", "lease_expires_at", "updated_at")
        VALUES (${leaseKey}, ${ownerToken}, NOW() + (${ttlSeconds} * INTERVAL '1 second'), NOW())
        ON CONFLICT ("lease_key") DO UPDATE
        SET "owner_token" = EXCLUDED."owner_token",
            "lease_expires_at" = EXCLUDED."lease_expires_at",
            "updated_at" = NOW()
        WHERE "system_leases"."lease_expires_at" < NOW()
           OR "system_leases"."owner_token" = EXCLUDED."owner_token"
        RETURNING "lease_key", "owner_token", "lease_expires_at";
      `;

      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      logger.warn({ err }, `[SystemLeaseService] Failed to acquire lease "${leaseKey}": ${err.message}`);
      return false;
    }
  }

  /**
   * Renews a lease only while it is still owned by ownerToken. PostgreSQL time
   * is authoritative for both the ownership check and the new expiry.
   */
  async renewLease(leaseKey, ownerToken, durationSeconds = 300) {
    try {
      const ttlSeconds = Number(durationSeconds);
      if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 172800) {
        throw new Error('Lease duration must be an integer between 1 and 172800 seconds');
      }
      const rows = await this.prisma.$queryRaw`
        UPDATE "system_leases"
        SET "lease_expires_at" = NOW() + (${ttlSeconds} * INTERVAL '1 second'),
            "updated_at" = NOW()
        WHERE "lease_key" = ${leaseKey}
          AND "owner_token" = ${ownerToken}
          AND "lease_expires_at" > NOW()
        RETURNING "lease_key", "owner_token", "lease_expires_at";
      `;
      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      logger.warn({ err }, `[SystemLeaseService] Failed to renew lease "${leaseKey}": ${err.message}`);
      return false;
    }
  }

  /**
   * Releases a previously acquired lease if still owned by the given owner token.
   *
   * @param {string} leaseKey
   * @param {string} ownerToken
   * @returns {Promise<boolean>}
   */
  async releaseLease(leaseKey, ownerToken) {
    try {
      const rows = await this.prisma.$queryRaw`
        UPDATE "system_leases"
        SET "lease_expires_at" = NOW()
        WHERE "lease_key" = ${leaseKey} AND "owner_token" = ${ownerToken}
        RETURNING "lease_key";
      `;
      return Array.isArray(rows) && rows.length > 0;
    } catch (err) {
      logger.warn({ err }, `[SystemLeaseService] Failed to release lease "${leaseKey}": ${err.message}`);
      return false;
    }
  }
}

export const defaultSystemLeaseService = new SystemLeaseService();
