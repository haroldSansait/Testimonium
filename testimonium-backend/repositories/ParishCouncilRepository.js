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
}
