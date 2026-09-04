import { prisma } from "../config/db.js";

export class ParishCouncilRepository {
  /**
   * Retrieves a single parish by its ID.
   * @param {number} parishId
   * @param {object} [tx] Optional transaction client
   * @returns {Promise<object|null>}
   */
  async findParishById(parishId, tx = null) {
    const client = tx || prisma;
    return client.parish.findUnique({
      where: { id: parishId },
    });
  }

  /**
   * Retrieves council configuration and members for a parish.
   * @param {number} parishId
   * @param {object} [tx] Optional transaction client
   * @returns {Promise<object|null>}
   */
  async findConfigByParishId(parishId, tx = null) {
    const client = tx || prisma;
    return client.parishCouncilConfiguration.findUnique({
      where: { parishId },
      include: {
        members: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });
  }

  /**
   * Retrieves active parishes for selector dropdown.
   * Only returns display-safe fields (id and name).
   * @param {object} [where] Filter criteria
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async getParishesForSelector(where = {}) {
    const parishes = await prisma.parish.findMany({
      where: {
        isActive: true,
        ...where,
      },
      select: {
        id: true,
        parishName: true,
      },
      orderBy: {
        parishName: "asc",
      },
    });

    return parishes.map((p) => ({
      id: String(p.id),
      name: p.parishName,
    }));
  }

  /**
   * Retrieves a council member by ID including its councilConfiguration.
   * @param {number} memberId
   * @param {object} [tx] Optional transaction client
   * @returns {Promise<object|null>}
   */
  async findMemberById(memberId, tx = null) {
    const client = tx || prisma;
    return client.parishCouncilMember.findUnique({
      where: { id: memberId },
      include: {
        councilConfiguration: true,
      },
    });
  }

  /**
   * Updates a council member's fields.
   * @param {number} memberId
   * @param {object} data
   * @param {object} [tx] Optional transaction client
   * @returns {Promise<object>}
   */
  async updateMember(memberId, data, tx = null) {
    const client = tx || prisma;
    return client.parishCouncilMember.update({
      where: { id: memberId },
      data,
    });
  }

  /**
   * Locks and retrieves a council member by ID within a transaction.
   * Uses FOR UPDATE to serialize concurrent mutations.
   * @param {number} memberId
   * @param {object} tx Transaction client
   * @returns {Promise<object|null>}
   */
  async lockMemberForUpdate(memberId, tx) {
    if (typeof tx?.$queryRaw === "function") {
      try {
        const rows = await tx.$queryRaw`
          SELECT "member_id" AS id, "council_configuration_id" AS "councilConfigurationId", "council_type" AS "councilType",
                 "position_title" AS "positionTitle", "member_name" AS "memberName", "sort_order" AS "sortOrder",
                 "photo_url" AS "photoUrl", "photo_object_key" AS "photoObjectKey"
          FROM "parish_council_members"
          WHERE "member_id" = ${memberId}
          FOR UPDATE
        `;
        return rows && rows.length > 0 ? rows[0] : null;
      } catch {
        if (tx.parishCouncilMember?.findUnique) {
          return tx.parishCouncilMember.findUnique({
            where: { id: memberId },
            include: { councilConfiguration: true },
          });
        }
      }
    }

    if (tx?.parishCouncilMember?.findUnique) {
      return tx.parishCouncilMember.findUnique({
        where: { id: memberId },
        include: { councilConfiguration: true },
      });
    }

    return null;
  }

  /**
   * Locks and retrieves all council members for a configuration within a transaction in deterministic ascending ID order.
   * Uses FOR UPDATE to serialize concurrent mutations with photo replace/remove.
   * @param {number} configId
   * @param {object} tx Transaction client
   * @returns {Promise<Array<object>|null>}
   */
  async lockCouncilMembersForUpdate(configId, tx) {
    if (typeof tx?.$queryRaw === "function") {
      try {
        const rows = await tx.$queryRaw`
          SELECT "member_id" AS id, "council_configuration_id" AS "councilConfigurationId", "council_type" AS "councilType",
                 "position_title" AS "positionTitle", "member_name" AS "memberName", "sort_order" AS "sortOrder",
                 "photo_url" AS "photoUrl", "photo_object_key" AS "photoObjectKey"
          FROM "parish_council_members"
          WHERE "council_configuration_id" = ${configId}
          ORDER BY "member_id" ASC
          FOR UPDATE
        `;
        return Array.isArray(rows) ? rows : [];
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Checks whether a photoObjectKey is referenced by any surviving member across all councils.
   * @param {string} photoObjectKey
   * @param {object} [tx] Optional transaction client
   * @returns {Promise<boolean>}
   */
  async isPhotoKeyReferenced(photoObjectKey, tx = null) {
    if (!photoObjectKey) return false;
    const client = tx || prisma;
    if (!client.parishCouncilMember?.count) return false;
    const count = await client.parishCouncilMember.count({
      where: { photoObjectKey },
    });
    return count > 0;
  }

  /**
   * Executes a photo pointer mutation serialized with a row lock.
   * Authoritatively checks ownership, captures the previous photo key,
   * updates the row, and returns the result.
   * @param {number} memberId
   * @param {number} parishId
   * @param {object} updateData
   * @returns {Promise<{ updatedMember: object, oldKey: string|null }>}
   */
  async executeLockedPhotoUpdate(memberId, parishId, updateData) {
    return prisma.$transaction(async (tx) => {
      const lockedMember = await this.lockMemberForUpdate(memberId, tx);
      if (!lockedMember) {
        const err = new Error("Council member was not found or was removed by another session.");
        err.statusCode = 404;
        err.code = "COUNCIL_MEMBER_STALE";
        throw err;
      }

      if (lockedMember.councilConfigurationId) {
        const config = await tx.parishCouncilConfiguration.findUnique({
          where: { id: lockedMember.councilConfigurationId },
        });
        if (!config || config.parishId !== parishId) {
          const err = new Error("Council member does not belong to this parish.");
          err.statusCode = 404;
          err.code = "COUNCIL_MEMBER_STALE";
          throw err;
        }
      }

      const oldKey = lockedMember.photoObjectKey || null;
      const updated = await tx.parishCouncilMember.update({
        where: { id: memberId },
        data: updateData,
      });

      return { updatedMember: updated, oldKey };
    });
  }
}
