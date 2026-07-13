import { prisma } from "../config/db.js";

/**
 * Resolves notification recipients by role and parish context.
 * All methods accept an optional Prisma transaction client (tx) so that
 * queries run inside the caller's existing transaction boundary.
 */
export class RecipientResolver {
  /**
   * Returns the user IDs of all active SECRETARY users assigned to a given parish.
   * @param {number} parishId
   * @param {object|null} tx - Prisma transaction client (optional)
   * @returns {Promise<number[]>}
   */
  static async getParishSecretaries(parishId, tx = null) {
    const client = tx || prisma;

    const users = await client.user.findMany({
      where: {
        parishId,
        status: "ACTIVE",
        role: { roleName: "SECRETARY" },
      },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }

  /**
   * Returns the user IDs of all active DIOCESE_COORDINATOR users.
   * Per confirmed architecture: there is only one active coordinator in the
   * system. No vicariate/diocese filtering is applied.
   * @param {object|null} tx - Prisma transaction client (optional)
   * @returns {Promise<number[]>}
   */
  static async getDioceseCoordinators(tx = null) {
    const client = tx || prisma;

    const users = await client.user.findMany({
      where: {
        status: "ACTIVE",
        role: { roleName: "DIOCESE_COORDINATOR" },
      },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }

  /**
   * Resolves all administrative recipients (Secretary + Diocese Coordinator)
   * for a given parish, deduplicated.
   * @param {number} parishId
   * @param {object|null} tx - Prisma transaction client (optional)
   * @returns {Promise<number[]>}
   */
  static async getAdminRecipients(parishId, tx = null) {
    const [secretaries, coordinators] = await Promise.all([
      RecipientResolver.getParishSecretaries(parishId, tx),
      RecipientResolver.getDioceseCoordinators(tx),
    ]);

    // Deduplicate using a Set (guards against edge cases like role overlap)
    return [...new Set([...secretaries, ...coordinators])];
  }
}
