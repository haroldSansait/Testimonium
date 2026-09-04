import { randomUUID } from "crypto";
import { prisma } from "../config/db.js";
import { ParishCouncilRepository } from "../repositories/ParishCouncilRepository.js";
import { AuditLogService } from "./AuditLogService.js";
import { R2Service } from "./R2Service.js";
import { FileValidator } from "../utils/fileValidator.js";
import { logger } from "../config/logger.js";

const validateMemberId = (id) => {
  if (id === undefined) return undefined;
  if (typeof id === "number" && Number.isInteger(id) && id > 0) {
    return id;
  }
  if (typeof id === "string" && /^[1-9]\d*$/.test(id)) {
    return Number(id);
  }
  const err = new Error(`Malformed council member ID: ${JSON.stringify(id)}`);
  err.statusCode = 400;
  err.code = "INVALID_COUNCIL_PAYLOAD";
  throw err;
};

export class ParishCouncilService {
  constructor(
    parishCouncilRepository = new ParishCouncilRepository(),
    r2Service = new R2Service()
  ) {
    this.repository = parishCouncilRepository;
    this.r2Service = r2Service;
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
          id: Number(m.id),
          positionTitle: m.positionTitle,
          memberName: m.memberName,
          sortOrder: m.sortOrder,
          photoUrl: m.photoUrl || null,
        })),
      financeCouncilMembers: (config.members || [])
        .filter((m) => m.councilType === "FINANCE")
        .map((m) => ({
          id: Number(m.id),
          positionTitle: m.positionTitle,
          memberName: m.memberName,
          sortOrder: m.sortOrder,
          photoUrl: m.photoUrl || null,
        })),
    };
  }

  /**
   * Atomically saves council configuration, PPC snapshot, and conditionally PFC snapshot.
   * Uses optimistic concurrency control on version.
   * Preserves officer photos of existing members.
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

    // Pre-transaction validation: reject malformed IDs and duplicate submitted persistent IDs
    const submittedIdSet = new Set();
    const checkDuplicateSubmittedId = (id) => {
      if (id !== undefined) {
        const numId = validateMemberId(id);
        if (submittedIdSet.has(numId)) {
          const err = new Error(`Duplicate council member ID ${numId} submitted.`);
          err.statusCode = 409;
          err.code = "COUNCIL_MEMBER_STALE";
          throw err;
        }
        submittedIdSet.add(numId);
      }
    };

    for (const m of pastoralCouncilMembers) {
      checkDuplicateSubmittedId(m.id);
    }
    if (financeCouncilEnabled) {
      for (const m of financeCouncilMembers) {
        checkDuplicateSubmittedId(m.id);
      }
    }

    const orphanedPhotoKeys = [];

    const result = await prisma.$transaction(async (tx) => {
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

      // 3. Conditional version claim (optimistic concurrency control)
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

      // 4. Lock current target council member rows in deterministic ascending ID order (FOR UPDATE)
      // and take authoritative state AFTER lock
      let lockedMembers = null;
      if (typeof this.repository?.lockCouncilMembersForUpdate === "function") {
        lockedMembers = await this.repository.lockCouncilMembersForUpdate(existingConfig.id, tx);
      }
      const existingMembers = Array.isArray(lockedMembers) ? lockedMembers : (existingConfig.members || []);
      const existingMemberMap = new Map(existingMembers.map((m) => [Number(m.id), m]));
      const existingPpc = existingMembers.filter((m) => m.councilType === "PASTORAL");
      const existingPfc = existingMembers.filter((m) => m.councilType === "FINANCE");

      // 5. Validate submitted persistent member IDs strictly against authoritative locked state
      for (const m of pastoralCouncilMembers) {
        if (m.id !== undefined) {
          const mId = validateMemberId(m.id);
          const found = existingMemberMap.get(mId);
          if (!found) {
            const err = new Error(
              `Council member ID ${mId} does not exist or does not belong to this parish council.`
            );
            err.statusCode = 409;
            err.code = "COUNCIL_MEMBER_STALE";
            throw err;
          }
          if (found.councilType !== "PASTORAL") {
            const err = new Error(
              `Council member ID ${mId} belongs to Finance Council, not Pastoral Council.`
            );
            err.statusCode = 409;
            err.code = "COUNCIL_MEMBER_STALE";
            throw err;
          }
        }
      }

      if (financeCouncilEnabled) {
        for (const m of financeCouncilMembers) {
          if (m.id !== undefined) {
            const mId = validateMemberId(m.id);
            const found = existingMemberMap.get(mId);
            if (!found) {
              const err = new Error(
                `Council member ID ${mId} does not exist or does not belong to this parish council.`
              );
              err.statusCode = 409;
              err.code = "COUNCIL_MEMBER_STALE";
              throw err;
            }
            if (found.councilType !== "FINANCE") {
              const err = new Error(
                `Council member ID ${mId} belongs to Pastoral Council, not Finance Council.`
              );
              err.statusCode = 409;
              err.code = "COUNCIL_MEMBER_STALE";
              throw err;
            }
          }
        }
      }

      // 6. True in-place update for Pastoral Council (Requirement 5)
      const keptPpcIds = new Set();
      const pastoralMembersToInsert = [];

      for (let index = 0; index < pastoralCouncilMembers.length; index++) {
        const m = pastoralCouncilMembers[index];
        if (m.id !== undefined) {
          const mId = validateMemberId(m.id);
          if (existingMemberMap.has(mId)) {
            keptPpcIds.add(mId);
            await tx.parishCouncilMember.update({
              where: { id: mId },
              data: {
                positionTitle: m.positionTitle.trim(),
                memberName: m.memberName.trim(),
                sortOrder: index,
              },
            });
          }
        } else {
          // ONLY a genuinely absent `id` can reach pastoralMembersToInsert
          pastoralMembersToInsert.push({
            councilConfigurationId: existingConfig.id,
            councilType: "PASTORAL",
            positionTitle: m.positionTitle.trim(),
            memberName: m.memberName.trim(),
            sortOrder: index,
            photoUrl: null,
            photoObjectKey: null,
          });
        }
      }

      const deletedPpc = existingPpc.filter((m) => !keptPpcIds.has(m.id));
      if (deletedPpc.length > 0) {
        for (const dm of deletedPpc) {
          if (dm.photoObjectKey) orphanedPhotoKeys.push(dm.photoObjectKey);
        }
        await tx.parishCouncilMember.deleteMany({
          where: {
            id: { in: deletedPpc.map((m) => m.id) },
          },
        });
      }

      if (pastoralMembersToInsert.length > 0) {
        await tx.parishCouncilMember.createMany({
          data: pastoralMembersToInsert,
        });
      }

      // 7. PFC handling:
      // If financeCouncilEnabled == true: true in-place update for Finance members
      // If financeCouncilEnabled == false: PRESERVE existing Finance members!
      let finalFinanceCount = existingPfc.length;

      if (financeCouncilEnabled) {
        const keptPfcIds = new Set();
        const financeMembersToInsert = [];

        for (let index = 0; index < financeCouncilMembers.length; index++) {
          const m = financeCouncilMembers[index];
          if (m.id !== undefined) {
            const mId = validateMemberId(m.id);
            if (existingMemberMap.has(mId)) {
              keptPfcIds.add(mId);
              await tx.parishCouncilMember.update({
                where: { id: mId },
                data: {
                  positionTitle: m.positionTitle.trim(),
                  memberName: m.memberName.trim(),
                  sortOrder: index,
                },
              });
            }
          } else {
            // ONLY a genuinely absent `id` can reach financeMembersToInsert
            financeMembersToInsert.push({
              councilConfigurationId: existingConfig.id,
              councilType: "FINANCE",
              positionTitle: m.positionTitle.trim(),
              memberName: m.memberName.trim(),
              sortOrder: index,
              photoUrl: null,
              photoObjectKey: null,
            });
          }
        }

        const deletedPfc = existingPfc.filter((m) => !keptPfcIds.has(m.id));
        if (deletedPfc.length > 0) {
          for (const dm of deletedPfc) {
            if (dm.photoObjectKey) orphanedPhotoKeys.push(dm.photoObjectKey);
          }
          await tx.parishCouncilMember.deleteMany({
            where: {
              id: { in: deletedPfc.map((m) => m.id) },
            },
          });
        }

        if (financeMembersToInsert.length > 0) {
          await tx.parishCouncilMember.createMany({
            data: financeMembersToInsert,
          });
        }

        finalFinanceCount = keptPfcIds.size + financeMembersToInsert.length;
      }

      // 7. Write Audit Log within transaction
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
            pastoralMemberCount: existingPpc.length,
            financeMemberCount: existingPfc.length,
          },
          newValues: {
            financeCouncilEnabled: Boolean(financeCouncilEnabled),
            pastoralMemberCount: pastoralCouncilMembers.length,
            financeMemberCount: finalFinanceCount,
          },
          metadata: {
            parishId: numericParishId,
          },
        }
      );

      // 8. Return updated snapshot
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
            id: Number(m.id),
            positionTitle: m.positionTitle,
            memberName: m.memberName,
            sortOrder: m.sortOrder,
            photoUrl: m.photoUrl || null,
          })),
        financeCouncilMembers: (updatedConfig.members || [])
          .filter((m) => m.councilType === "FINANCE")
          .map((m) => ({
            id: Number(m.id),
            positionTitle: m.positionTitle,
            memberName: m.memberName,
            sortOrder: m.sortOrder,
            photoUrl: m.photoUrl || null,
          })),
      };
    });

    // 9. Post-commit R2 cleanup (Requirement 7):
    // Delete only R2 keys that are NO LONGER referenced by any surviving member in DB
    if (orphanedPhotoKeys.length > 0 && this.r2Service) {
      for (const key of orphanedPhotoKeys) {
        try {
          const isStillReferenced = typeof this.repository.isPhotoKeyReferenced === "function"
            ? await this.repository.isPhotoKeyReferenced(key)
            : false;
          if (!isStillReferenced) {
            await this.r2Service.delete(key);
          }
        } catch (err) {
          logger.warn({ err, key }, "[ParishCouncilService] Failed to clean up orphaned officer photo from R2 post-commit");
        }
      }
    }

    return result;
  }

  /**
   * Uploads or replaces an officer photo for a council member.
   * @param {string|number} parishId
   * @param {string|number} memberId
   * @param {object} file
   * @param {number} actorId
   * @returns {Promise<{ memberId: string, photoUrl: string }>}
   */
  async uploadOfficerPhoto(parishId, memberId, file, actorId) {
    const numericParishId = parseInt(parishId, 10);
    const numericMemberId = parseInt(memberId, 10);

    if (isNaN(numericParishId) || isNaN(numericMemberId)) {
      const err = new Error("Invalid parish ID or member ID format.");
      err.statusCode = 400;
      err.code = "INVALID_COUNCIL_PAYLOAD";
      throw err;
    }

    // 1. Fetch parish to verify active status
    const parish = await this.repository.findParishById(numericParishId);
    if (!parish) {
      const err = new Error("Parish not found.");
      err.statusCode = 404;
      err.code = "PARISH_NOT_FOUND";
      throw err;
    }
    if (!parish.isActive) {
      const err = new Error("Cannot modify council members for an inactive or archived parish.");
      err.statusCode = 409;
      err.code = "PARISH_NOT_EDITABLE";
      throw err;
    }

    // 2. Validate member ownership and parish ownership BEFORE file validation & upload (Section 11)
    const initialMember = await this.repository.findMemberById(numericMemberId);
    if (!initialMember || initialMember.councilConfiguration?.parishId !== numericParishId) {
      const err = new Error("Council member was not found or does not belong to this parish.");
      err.statusCode = 404;
      err.code = "COUNCIL_MEMBER_STALE";
      throw err;
    }

    // 3. Validate file (magic bytes, MIME, size <= 2MB)
    const { signature, normalizedMime } = FileValidator.validateCouncilOfficerPhoto(file);

    const ext = signature === "jpeg" ? "jpg" : signature;
    const newKey = `councils/parish_${numericParishId}/officers/${randomUUID()}.${ext}`;

    // 4. Upload new unique object to R2
    let uploadedUrl;
    try {
      uploadedUrl = await this.r2Service.upload({
        key: newKey,
        body: file.buffer,
        contentType: normalizedMime,
      });
    } catch (uploadErr) {
      logger.error({ err: uploadErr }, "[ParishCouncilService] Failed to upload officer photo to R2");
      const err = new Error("Failed to upload officer photo to storage.");
      err.statusCode = 500;
      err.code = "COUNCIL_IMAGE_UPLOAD_FAILED";
      throw err;
    }

    // 5. Update database pointer conditionally/authoritatively under transaction + row lock
    let updatedMember;
    let oldKey = null;

    try {
      if (typeof this.repository.executeLockedPhotoUpdate === "function") {
        const lockRes = await this.repository.executeLockedPhotoUpdate(numericMemberId, numericParishId, {
          photoUrl: uploadedUrl,
          photoObjectKey: newKey,
        });
        updatedMember = lockRes.updatedMember;
        oldKey = lockRes.oldKey;
      } else {
        oldKey = initialMember.photoObjectKey;
        updatedMember = await this.repository.updateMember(numericMemberId, {
          photoUrl: uploadedUrl,
          photoObjectKey: newKey,
        });
      }
    } catch (dbErr) {
      logger.error({ err: dbErr, newKey }, "[ParishCouncilService] DB update failed, rolling back newly uploaded R2 photo");
      try {
        await this.r2Service.delete(newKey);
      } catch (delErr) {
        logger.error({ err: delErr, key: newKey }, "[ParishCouncilService] Failed to clean up R2 key during rollback");
      }
      throw dbErr;
    }

    // 6. Only after DB successfully points to new object, delete old object if not still referenced
    if (oldKey && oldKey !== newKey) {
      try {
        const isStillReferenced = typeof this.repository.isPhotoKeyReferenced === "function"
          ? await this.repository.isPhotoKeyReferenced(oldKey)
          : false;
        if (!isStillReferenced) {
          await this.r2Service.delete(oldKey);
        }
      } catch (cleanupErr) {
        logger.warn(
          { err: cleanupErr, oldKey },
          "[ParishCouncilService] Failed to clean up old officer photo from R2"
        );
      }
    }

    // 7. Canonical Audit Log
    try {
      await AuditLogService.log(
        actorId,
        oldKey ? "Council Officer Photo Replaced" : "Council Officer Photo Uploaded",
        null,
        false,
        {
          affectedTable: "parish_council_members",
          affectedRecordId: numericMemberId,
          parishId: numericParishId,
          metadata: {
            memberId: numericMemberId,
            memberName: initialMember.memberName,
            positionTitle: initialMember.positionTitle,
            photoUrl: uploadedUrl,
          },
        }
      );
    } catch (auditErr) {
      logger.warn(
        { err: auditErr },
        "[ParishCouncilService] Non-blocking audit log failure on photo upload"
      );
    }

    return {
      memberId: String(updatedMember.id),
      photoUrl: updatedMember.photoUrl,
    };
  }

  /**
   * Removes an officer's photo, clearing DB pointers and deleting storage object.
   * @param {string|number} parishId
   * @param {string|number} memberId
   * @param {number} actorId
   * @returns {Promise<object>}
   */
  async removeOfficerPhoto(parishId, memberId, actorId) {
    const numericParishId = parseInt(parishId, 10);
    const numericMemberId = parseInt(memberId, 10);

    if (isNaN(numericParishId) || isNaN(numericMemberId)) {
      const err = new Error("Invalid parish ID or member ID format.");
      err.statusCode = 400;
      err.code = "INVALID_COUNCIL_PAYLOAD";
      throw err;
    }

    // 1. Fetch parish to verify active status
    const parish = await this.repository.findParishById(numericParishId);
    if (!parish) {
      const err = new Error("Parish not found.");
      err.statusCode = 404;
      err.code = "PARISH_NOT_FOUND";
      throw err;
    }
    if (!parish.isActive) {
      const err = new Error("Cannot modify council members for an inactive or archived parish.");
      err.statusCode = 409;
      err.code = "PARISH_NOT_EDITABLE";
      throw err;
    }

    // 2. Fetch member and verify it belongs to this parish's council
    const initialMember = await this.repository.findMemberById(numericMemberId);
    if (!initialMember || initialMember.councilConfiguration?.parishId !== numericParishId) {
      const err = new Error("Council member was not found or does not belong to this parish.");
      err.statusCode = 404;
      err.code = "COUNCIL_MEMBER_STALE";
      throw err;
    }

    // 3. Clear database fields using transaction + row lock
    let updatedMember;
    let oldKey = null;

    if (typeof this.repository.executeLockedPhotoUpdate === "function") {
      const lockRes = await this.repository.executeLockedPhotoUpdate(numericMemberId, numericParishId, {
        photoUrl: null,
        photoObjectKey: null,
      });
      updatedMember = lockRes.updatedMember;
      oldKey = lockRes.oldKey;
    } else {
      oldKey = initialMember.photoObjectKey;
      updatedMember = await this.repository.updateMember(numericMemberId, {
        photoUrl: null,
        photoObjectKey: null,
      });
    }

    // 4. Attempt deletion from R2 only if no surviving member references the object
    if (oldKey) {
      try {
        const isStillReferenced = typeof this.repository.isPhotoKeyReferenced === "function"
          ? await this.repository.isPhotoKeyReferenced(oldKey)
          : false;
        if (!isStillReferenced) {
          await this.r2Service.delete(oldKey);
        }
      } catch (delErr) {
        logger.warn(
          { err: delErr, oldKey },
          "[ParishCouncilService] Failed to clean up deleted officer photo from R2"
        );
      }
    }

    // 5. Canonical Audit Log
    try {
      await AuditLogService.log(
        actorId,
        "Council Officer Photo Removed",
        null,
        false,
        {
          affectedTable: "parish_council_members",
          affectedRecordId: numericMemberId,
          parishId: numericParishId,
          metadata: {
            memberId: numericMemberId,
            memberName: initialMember.memberName,
            positionTitle: initialMember.positionTitle,
          },
        }
      );
    } catch (auditErr) {
      logger.warn(
        { err: auditErr },
        "[ParishCouncilService] Non-blocking audit log failure on photo removal"
      );
    }

    return {
      memberId: String(updatedMember.id),
      photoUrl: null,
    };
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
