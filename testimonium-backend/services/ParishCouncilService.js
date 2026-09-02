import { prisma } from "../config/db.js";
import { ParishCouncilRepository } from "../repositories/ParishCouncilRepository.js";
import { AuditLogService } from "./AuditLogService.js";
import { logger } from "../config/logger.js";

export class ParishCouncilService {
  constructor(parishCouncilRepository = new ParishCouncilRepository()) {
    this.repository = parishCouncilRepository;
  }

  /**
   * Retrieves the council configuration and members for Admin editor.
   * @param {string|number} parishId
   * @returns {Promise<object>}
   */
  async getCouncilConfig(parishId) {
    const numericParishId = parseInt(parishId, 10);
    if (isNaN(numericParishId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      err.code = "INVALID_COUNCIL_PAYLOAD";
      throw err;
    }

    const parish = await this.repository.findParishById(numericParishId);
    if (!parish) {
      const err = new Error("Parish not found.");
      err.statusCode = 404;
      err.code = "PARISH_NOT_FOUND";
      throw err;
    }

    const config = await this.repository.findConfigByParishId(numericParishId);
    if (!config) {
      const err = new Error(
        "Parish council configuration is missing for this parish. Please contact system administrator."
      );
      err.statusCode = 500;
      err.code = "COUNCIL_CONFIGURATION_MISSING";
      throw err;
    }

    return {
      parishId: String(config.parishId),
      version: config.version,
      financeCouncilEnabled: config.financeCouncilEnabled,
      pastoralCouncilMembers: (config.members || [])
        .filter((m) => m.councilType === "PASTORAL")
        .map((m) => ({
          id: String(m.id),
          positionTitle: m.positionTitle,
          memberName: m.memberName,
          sortOrder: m.sortOrder,
        })),
      financeCouncilMembers: (config.members || [])
        .filter((m) => m.councilType === "FINANCE")
        .map((m) => ({
          id: String(m.id),
          positionTitle: m.positionTitle,
          memberName: m.memberName,
          sortOrder: m.sortOrder,
        })),
    };
  }

  /**
   * Atomically saves council configuration, PPC snapshot, and conditionally PFC snapshot.
   * Uses optimistic concurrency control on version.
   * @param {string|number} parishId
   * @param {object} payload
   * @param {number} actorId
   * @returns {Promise<object>}
   */
  async saveCouncil(parishId, payload, actorId) {
    const numericParishId = parseInt(parishId, 10);
    if (isNaN(numericParishId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      err.code = "INVALID_COUNCIL_PAYLOAD";
      throw err;
    }

    const {
      expectedVersion,
      financeCouncilEnabled,
      pastoralCouncilMembers = [],
      financeCouncilMembers = [],
    } = payload;

    // Enforce PFC enable validation: at least 1 member required if enabled
    if (financeCouncilEnabled && (!financeCouncilMembers || financeCouncilMembers.length === 0)) {
      const err = new Error(
        "At least one Finance Council member is required when the Finance Council is enabled."
      );
      err.statusCode = 400;
      err.code = "FINANCE_COUNCIL_MEMBERS_REQUIRED";
      throw err;
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Validate parish existence and active status
      const parish = await tx.parish.findUnique({
        where: { id: numericParishId },
      });
      if (!parish) {
        const err = new Error("Parish not found.");
        err.statusCode = 404;
        err.code = "PARISH_NOT_FOUND";
        throw err;
      }

      if (!parish.isActive) {
        const err = new Error(
          "Cannot modify council configuration for an archived or inactive parish."
        );
        err.statusCode = 409;
        err.code = "PARISH_NOT_EDITABLE";
        throw err;
      }

      // 2. Validate configuration exists
      const existingConfig = await tx.parishCouncilConfiguration.findUnique({
        where: { parishId: numericParishId },
        include: { members: { orderBy: { sortOrder: "asc" } } },
      });

      if (!existingConfig) {
        const err = new Error(
          "Parish council configuration is missing for this parish."
        );
        err.statusCode = 500;
        err.code = "COUNCIL_CONFIGURATION_MISSING";
        throw err;
      }

      // 3. Conditional version claim (first mutating write)
      const updateResult = await tx.parishCouncilConfiguration.updateMany({
        where: {
          parishId: numericParishId,
          version: expectedVersion,
        },
        data: {
          version: { increment: 1 },
          financeCouncilEnabled: Boolean(financeCouncilEnabled),
        },
      });

      if (updateResult.count === 0) {
        const err = new Error(
          "This parish council information was updated by another session. Reload the latest information before saving your changes."
        );
        err.statusCode = 409;
        err.code = "COUNCIL_CONFIGURATION_STALE";
        throw err;
      }

      // 4. Atomic PPC snapshot replacement (normalized 0..N-1 sortOrder)
      await tx.parishCouncilMember.deleteMany({
        where: {
          councilConfigurationId: existingConfig.id,
          councilType: "PASTORAL",
        },
      });

      const pastoralMembersToInsert = pastoralCouncilMembers.map((m, index) => ({
        councilConfigurationId: existingConfig.id,
        councilType: "PASTORAL",
        positionTitle: m.positionTitle.trim(),
        memberName: m.memberName.trim(),
        sortOrder: index,
      }));

      if (pastoralMembersToInsert.length > 0) {
        await tx.parishCouncilMember.createMany({
          data: pastoralMembersToInsert,
        });
      }

      // 5. PFC snapshot handling:
      // If financeCouncilEnabled == true: replace Finance members snapshot
      // If financeCouncilEnabled == false: PRESERVE existing Finance members!
      let finalFinanceCount = existingConfig.members.filter(
        (m) => m.councilType === "FINANCE"
      ).length;

      if (financeCouncilEnabled) {
        await tx.parishCouncilMember.deleteMany({
          where: {
            councilConfigurationId: existingConfig.id,
            councilType: "FINANCE",
          },
        });

        const financeMembersToInsert = financeCouncilMembers.map((m, index) => ({
          councilConfigurationId: existingConfig.id,
          councilType: "FINANCE",
          positionTitle: m.positionTitle.trim(),
          memberName: m.memberName.trim(),
          sortOrder: index,
        }));

        await tx.parishCouncilMember.createMany({
          data: financeMembersToInsert,
        });

        finalFinanceCount = financeMembersToInsert.length;
      }

      // 6. Write Audit Log within transaction
      const existingPpcCount = existingConfig.members.filter(
        (m) => m.councilType === "PASTORAL"
      ).length;
      const existingPfcCount = existingConfig.members.filter(
        (m) => m.councilType === "FINANCE"
      ).length;

      await AuditLogService.log(
        actorId,
        "Parish Council Information Updated",
        tx,
        false,
        {
          affectedTable: "parish_council_configurations",
          affectedRecordId: existingConfig.id,
          parishId: numericParishId,
          previousValues: {
            financeCouncilEnabled: existingConfig.financeCouncilEnabled,
            pastoralMemberCount: existingPpcCount,
            financeMemberCount: existingPfcCount,
          },
          newValues: {
            financeCouncilEnabled: Boolean(financeCouncilEnabled),
            pastoralMemberCount: pastoralMembersToInsert.length,
            financeMemberCount: finalFinanceCount,
          },
          metadata: {
            parishId: numericParishId,
          },
        }
      );

      // 7. Return updated snapshot
      const updatedConfig = await tx.parishCouncilConfiguration.findUnique({
        where: { parishId: numericParishId },
        include: {
          members: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });

      return {
        parishId: String(updatedConfig.parishId),
        version: updatedConfig.version,
        financeCouncilEnabled: updatedConfig.financeCouncilEnabled,
        pastoralCouncilMembers: (updatedConfig.members || [])
          .filter((m) => m.councilType === "PASTORAL")
          .map((m) => ({
            id: String(m.id),
            positionTitle: m.positionTitle,
            memberName: m.memberName,
            sortOrder: m.sortOrder,
          })),
        financeCouncilMembers: (updatedConfig.members || [])
          .filter((m) => m.councilType === "FINANCE")
          .map((m) => ({
            id: String(m.id),
            positionTitle: m.positionTitle,
            memberName: m.memberName,
            sortOrder: m.sortOrder,
          })),
      };
    });
  }

  /**
   * Retrieves parishes for the Admin selector according to the caller's role.
   * DIOCESE_COORDINATOR -> All active parishes
   * SECRETARY -> Only their active assigned parish
   * PRIEST / PARISHIONER -> Forbidden (403)
   * @param {object} user req.user object
   * @returns {Promise<Array<{id: string, name: string}>>}
   */
  async getSelectorParishes(user) {
    if (!user) {
      const err = new Error("Authentication is required.");
      err.statusCode = 401;
      throw err;
    }

    const role = user.role;

    if (role === "DIOCESE_COORDINATOR") {
      return await this.repository.getParishesForSelector();
    }

    if (role === "SECRETARY") {
      const parishId = user.parish?.id || user.parishId;
      if (!parishId) {
        return [];
      }
      return await this.repository.getParishesForSelector({
        id: parseInt(parishId, 10),
      });
    }

    const err = new Error(
      "You do not have permission to access the Parish Councils selector."
    );
    err.statusCode = 403;
    throw err;
  }
}
