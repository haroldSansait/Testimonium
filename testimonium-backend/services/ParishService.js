import { ParishRepository } from "../repositories/ParishRepository.js";
import { UserService } from "./UserService.js";
import { FirebaseAdminService } from "./FirebaseAdminService.js";
import { AuditLogService } from "./AuditLogService.js";
import { PriestAssignmentHandler } from "./PriestAssignmentHandler.js";
import { R2Service } from "./R2Service.js";
import { logger } from "../config/logger.js";
import { prisma } from "../config/db.js";
import {
  CANONICAL_DOCUMENT_TYPES,
  DEFAULT_OFFERED_DOCUMENTS,
  normalizeAvailableDocumentsForSave,
  getEffectiveOfferedDocuments,
} from "../config/documents.js";
import { validateSchedulingSettingsForSave } from "./SchedulingConfiguration.js";

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

const DEFAULT_MASS_SCHEDULE_TEMPLATES = [
  // Wednesdays
  { dayType: "WEDNESDAY", timeSlot: "06:00 AM", label: "Morning Mass" },
  { dayType: "WEDNESDAY", timeSlot: "05:15 PM", label: "Evening Mass" },
  // Fridays
  { dayType: "FRIDAY", timeSlot: "06:00 AM", label: "Morning Mass" },
  { dayType: "FRIDAY", timeSlot: "05:15 PM", label: "Evening Mass" },
  // Sundays
  { dayType: "SUNDAY", timeSlot: "05:00 AM", label: "Sunday Early Mass" },
  { dayType: "SUNDAY", timeSlot: "07:00 AM", label: "Sunday Morning Mass" },
  { dayType: "SUNDAY", timeSlot: "09:00 AM", label: "Sunday High Mass" },
  { dayType: "SUNDAY", timeSlot: "04:00 PM", label: "Sunday Afternoon Mass" },
  { dayType: "SUNDAY", timeSlot: "06:00 PM", label: "Sunday Evening Mass" },
];

export class ParishService {
  constructor(
    parishRepository = new ParishRepository(),
    userService = new UserService(),
    firebaseAdminService = new FirebaseAdminService()
  ) {
    this.parishRepository = parishRepository;
    this.userService = userService;
    this.firebaseAdminService = firebaseAdminService;
  }

  /**
   * Retrieves all parishes, filtered and mapped to frontend DTOs.
   * @param {object} filters
   * @returns {Promise<object>}
   */
  async getParishes(filters) {
    const result = await this.parishRepository.findMany(filters);
    const mappedParishes = result.items.map((p) => this.mapToDto(p));
    return {
      items: mappedParishes,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Retrieves a single parish by ID, mapped to DTO.
   * @param {string|number} idOrSlug
   * @returns {Promise<object>}
   */
  async getParishById(idOrSlug) {
    let parish;
    const numericId = parseInt(idOrSlug, 10);
    if (!isNaN(numericId)) {
      parish = await this.parishRepository.findById(numericId);
    } else {
      parish = await this.parishRepository.findBySlug(idOrSlug);
    }

    if (!parish) {
      const err = new Error("Parish not found.");
      err.statusCode = 404;
      throw err;
    }

    return this.mapToDto(parish);
  }

  /**
   * Creates a new parish with optional atomic staff assignment, unique slug, and default mass templates.
   * @param {object} payload
   * @param {number} actorId
   * @returns {Promise<object>}
   */
  async createParish(payload, actorId) {
    const parishInfo = payload.parishInfo || payload;
    const name = parishInfo.name?.trim();
    const type = parishInfo.type;
    const feastDay = parishInfo.feastDay?.trim() || null;
    const patronSaint = parishInfo.patronSaint?.trim() || null;
    const address = parishInfo.address?.trim() || null;
    const contactNumber = parishInfo.contactNumber?.trim() || null;
    const email = parishInfo.email?.trim() || null;
    const venueCapacity = parishInfo.venueCapacity ? parseInt(parishInfo.venueCapacity, 10) : null;

    if (!name || !type) {
      const err = new Error("Parish name and type are required.");
      err.statusCode = 400;
      throw err;
    }

    // 1. Validate parish name uniqueness
    const existingParish = await prisma.parish.findUnique({
      where: { parishName: name },
    });
    if (existingParish) {
      const err = new Error(`A parish named "${name}" already exists.`);
      err.statusCode = 409;
      throw err;
    }

    const priestConfig = payload.priest || { mode: "none" };
    const secretaryConfig = payload.secretary || { mode: "none" };

    const priestMode = priestConfig.mode || "none";
    const secretaryMode = secretaryConfig.mode || "none";

    let existingPriestUser = null;
    let existingSecretaryUser = null;

    // 2. Pre-validate Existing Priest (if mode === 'existing')
    if (priestMode === "existing") {
      if (!priestConfig.existingUserId) {
        const err = new Error("Existing priest ID is required when 'Assign Existing' is selected.");
        err.statusCode = 400;
        throw err;
      }
      const priestId = parseInt(priestConfig.existingUserId, 10);
      if (isNaN(priestId)) {
        const err = new Error("Invalid priest ID format.");
        err.statusCode = 400;
        throw err;
      }
      existingPriestUser = await prisma.user.findUnique({
        where: { id: priestId },
        include: { role: true, parish: true },
      });
      if (!existingPriestUser) {
        const err = new Error("Selected priest was not found.");
        err.statusCode = 400;
        throw err;
      }
      if (existingPriestUser.role?.roleName !== "PRIEST") {
        const err = new Error("Selected user does not have the PRIEST role.");
        err.statusCode = 400;
        throw err;
      }
      if (existingPriestUser.status !== "ACTIVE") {
        const err = new Error("Selected priest account is inactive.");
        err.statusCode = 400;
        throw err;
      }
      if (existingPriestUser.parishId !== null) {
        const err = new Error(`Selected priest is already assigned to "${existingPriestUser.parish?.parishName || 'another parish'}".`);
        err.statusCode = 409;
        throw err;
      }
    }

    // 3. Pre-validate Existing Secretary (if mode === 'existing')
    if (secretaryMode === "existing") {
      if (!secretaryConfig.existingUserId) {
        const err = new Error("Existing secretary ID is required when 'Assign Existing' is selected.");
        err.statusCode = 400;
        throw err;
      }
      const secretaryId = parseInt(secretaryConfig.existingUserId, 10);
      if (isNaN(secretaryId)) {
        const err = new Error("Invalid secretary ID format.");
        err.statusCode = 400;
        throw err;
      }
      existingSecretaryUser = await prisma.user.findUnique({
        where: { id: secretaryId },
        include: { role: true, parish: true },
      });
      if (!existingSecretaryUser) {
        const err = new Error("Selected secretary was not found.");
        err.statusCode = 400;
        throw err;
      }
      if (existingSecretaryUser.role?.roleName !== "SECRETARY") {
        const err = new Error("Selected user does not have the SECRETARY role.");
        err.statusCode = 400;
        throw err;
      }
      if (existingSecretaryUser.status !== "ACTIVE") {
        const err = new Error("Selected secretary account is inactive.");
        err.statusCode = 400;
        throw err;
      }
      if (existingSecretaryUser.parishId !== null) {
        const err = new Error(`Selected secretary is already assigned to "${existingSecretaryUser.parish?.parishName || 'another parish'}".`);
        err.statusCode = 409;
        throw err;
      }
    }

    // 4. Pre-validate New Priest (if mode === 'new')
    if (priestMode === "new") {
      const pData = priestConfig.newUserData;
      if (!pData || !pData.fullName?.trim() || !pData.email?.trim()) {
        const err = new Error("Priest full name and email are required when creating a new priest account.");
        err.statusCode = 400;
        throw err;
      }
      const existingEmail = await prisma.user.findUnique({
        where: { email: pData.email.trim() },
      });
      if (existingEmail) {
        const err = new Error(`The email "${pData.email}" is already registered in the system.`);
        err.statusCode = 409;
        throw err;
      }
    }

    // 5. Pre-validate New Secretary (if mode === 'new')
    if (secretaryMode === "new") {
      const sData = secretaryConfig.newUserData;
      if (!sData || !sData.fullName?.trim() || !sData.email?.trim()) {
        const err = new Error("Secretary full name and email are required when creating a new secretary account.");
        err.statusCode = 400;
        throw err;
      }
      const existingEmail = await prisma.user.findUnique({
        where: { email: sData.email.trim() },
      });
      if (existingEmail) {
        const err = new Error(`The email "${sData.email}" is already registered in the system.`);
        err.statusCode = 409;
        throw err;
      }

      if (priestMode === "new" && priestConfig.newUserData?.email?.trim().toLowerCase() === sData.email.trim().toLowerCase()) {
        const err = new Error("Priest and Secretary cannot have the same email address.");
        err.statusCode = 400;
        throw err;
      }
    }

    // 6. Parse Address, Municipality, and Map Type
    const { municipalityCity: parsedCity, province } = this.parseAddress(address);
    const municipalityCity = parishInfo.municipalityCity?.trim() || parsedCity || "Unknown";
    const mappedType = this.parishRepository.mapTypeToEnum(type);

    // 7. Database transaction: Create Parish + Unique Slug + Seed Mass Templates + Link Existing Staff
    let createdParish;
    try {
      createdParish = await prisma.$transaction(async (tx) => {
        const dupe = await tx.parish.findUnique({ where: { parishName: name } });
        if (dupe) {
          const err = new Error(`A parish named "${name}" already exists.`);
          err.statusCode = 409;
          throw err;
        }

        // Generate unique slug
        const baseSlug = generateSlug(name) || "parish";
        let candidateSlug = baseSlug;
        let counter = 1;
        while (true) {
          const existingSlug = await tx.parish.findUnique({ where: { slug: candidateSlug } });
          if (!existingSlug) break;
          candidateSlug = `${baseSlug}-${counter}`;
          counter++;
        }

        const parish = await tx.parish.create({
          data: {
            parishName: name,
            slug: candidateSlug,
            type: mappedType,
            patronSaint,
            feastDay,
            address,
            municipalityCity,
            province: province || "Negros Oriental",
            contactNumber,
            email,
            venueCapacity,
            isActive: true,
          },
        });

        // Seed default mass schedule templates
        for (const t of DEFAULT_MASS_SCHEDULE_TEMPLATES) {
          await tx.massScheduleTemplate.create({
            data: {
              parishId: parish.id,
              dayType: t.dayType,
              timeSlot: t.timeSlot,
              label: t.label,
              isActive: true,
            },
          });
        }

        if (priestMode === "existing" && existingPriestUser) {
          if (existingPriestUser.parishId && existingPriestUser.parishId !== parish.id) {
            await PriestAssignmentHandler.cleanupPriestAssignmentsFromParish(existingPriestUser.id, existingPriestUser.parishId, tx, name);
          }
          await tx.user.update({
            where: { id: existingPriestUser.id },
            data: { parishId: parish.id },
          });
        }

        if (secretaryMode === "existing" && existingSecretaryUser) {
          await tx.user.update({
            where: { id: existingSecretaryUser.id },
            data: { parishId: parish.id },
          });
        }

        return parish;
      });
    } catch (dbErr) {
      logger.error({ err: dbErr, parishName: name }, "[ParishService] Failed to create parish in DB transaction");
      throw dbErr;
    }

    // 8. Provision New Staff (if applicable) with rollback/compensation
    const provisionedUsers = [];
    try {
      if (priestMode === "new") {
        const pData = priestConfig.newUserData;
        const result = await this.userService.createUser(
          {
            name: pData.fullName.trim(),
            email: pData.email.trim(),
            contactNumber: pData.contactNumber?.trim() || null,
            role: "PRIEST",
            parish: createdParish.parishName,
          },
          actorId
        );
        provisionedUsers.push(result.user);
      }

      if (secretaryMode === "new") {
        const sData = secretaryConfig.newUserData;
        const result = await this.userService.createUser(
          {
            name: sData.fullName.trim(),
            email: sData.email.trim(),
            contactNumber: sData.contactNumber?.trim() || null,
            role: "SECRETARY",
            parish: createdParish.parishName,
          },
          actorId
        );
        provisionedUsers.push(result.user);
      }
    } catch (provisionErr) {
      logger.error({ err: provisionErr, parishId: createdParish.id }, "[ParishService] Failed to provision staff for new parish, rolling back");

      // Rollback provisioned users
      for (const u of provisionedUsers) {
        try {
          if (u.firebaseUid) {
            await this.firebaseAdminService.deleteUser(u.firebaseUid);
          }
          await prisma.user.delete({ where: { id: parseInt(u.id, 10) } });
        } catch (cleanupErr) {
          logger.error({ err: cleanupErr, userId: u.id }, "[ParishService] Error during user cleanup rollback");
        }
      }

      // Unlink existing staff
      if (priestMode === "existing" && existingPriestUser) {
        await prisma.user.update({ where: { id: existingPriestUser.id }, data: { parishId: null } }).catch(() => {});
      }
      if (secretaryMode === "existing" && existingSecretaryUser) {
        await prisma.user.update({ where: { id: existingSecretaryUser.id }, data: { parishId: null } }).catch(() => {});
      }

      // Delete created parish
      await prisma.parish.delete({ where: { id: createdParish.id } }).catch(() => {});

      await AuditLogService.log(actorId, `Parish Creation Failed: "${name}" (${provisionErr.message})`);
      throw provisionErr;
    }

    // 9. Audit Logging
    await AuditLogService.log(actorId, `Parish Created: "${createdParish.parishName}"`);

    if (priestMode === "existing" && existingPriestUser) {
      await AuditLogService.log(actorId, `Assigned Priest "${existingPriestUser.fullName}" to parish "${createdParish.parishName}"`);
    }
    if (secretaryMode === "existing" && existingSecretaryUser) {
      await AuditLogService.log(actorId, `Assigned Secretary "${existingSecretaryUser.fullName}" to parish "${createdParish.parishName}"`);
    }

    // 10. Fetch complete parish with all active users and return DTO
    const finalParish = await prisma.parish.findUnique({
      where: { id: createdParish.id },
      include: {
        users: {
          where: { status: "ACTIVE" },
          include: { role: true },
        },
      },
    });

    return this.mapToDto(finalParish);
  }

  /**
   * Updates an existing parish.
   * @param {string|number} id
   * @param {object} data
   * @param {number} actorId
   * @returns {Promise<object>}
   */
  async editParish(id, data, actorId) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      throw err;
    }

    const updatePayload = {};
    if (data.name) updatePayload.parishName = data.name;
    if (data.type) {
      updatePayload.type =
        data.type === "Parish"
          ? "PARISH"
          : data.type === "Quasi-Parish"
          ? "QUASI_PARISH"
          : data.type === "Mission Station"
          ? "MISSION_STATION"
          : data.type;
    }
    if (data.patronSaint !== undefined) updatePayload.patronSaint = data.patronSaint;
    if (data.feastDay !== undefined) updatePayload.feastDay = data.feastDay?.trim() || null;
    if (data.municipalityCity !== undefined) updatePayload.municipalityCity = data.municipalityCity?.trim();
    if (data.address !== undefined) {
      updatePayload.address = data.address;
      if (data.address && data.municipalityCity === undefined) {
        const { municipalityCity, province } = this.parseAddress(data.address);
        updatePayload.municipalityCity = municipalityCity;
        updatePayload.province = province;
      }
    }
    if (data.contactNumber !== undefined) updatePayload.contactNumber = data.contactNumber;
    if (data.email !== undefined) updatePayload.email = data.email;
    if (data.status !== undefined) {
      updatePayload.isActive = data.status === "Active";
    }
    if (data.documentSettings !== undefined) {
      updatePayload.documentSettings = data.documentSettings && typeof data.documentSettings === "object" ? JSON.stringify(data.documentSettings) : data.documentSettings;
    }
    if (data.eventSettings !== undefined) {
      const normalizedSettings = validateSchedulingSettingsForSave(data.eventSettings);
      updatePayload.eventSettings = JSON.stringify(normalizedSettings);
    }
    if (data.officeHours !== undefined) {
      this.validateOfficeHours(data.officeHours);
      updatePayload.officeHours = data.officeHours && typeof data.officeHours === "object" ? JSON.stringify(data.officeHours) : data.officeHours;
    }
    if (data.paymentQrEnabled !== undefined) {
      updatePayload.paymentQrEnabled = Boolean(data.paymentQrEnabled);
      updatePayload.paymentQrUpdatedAt = new Date();
      if (actorId) updatePayload.paymentQrUpdatedBy = parseInt(actorId, 10);
    }
    if (data.paymentQrImage !== undefined) {
      updatePayload.paymentQrImage = data.paymentQrImage;
      updatePayload.paymentQrUpdatedAt = new Date();
      if (actorId) updatePayload.paymentQrUpdatedBy = parseInt(actorId, 10);
    }
    if (data.availableDocuments !== undefined) {
      updatePayload.availableDocuments = normalizeAvailableDocumentsForSave(data.availableDocuments);
    }
    if (data.venueCapacity !== undefined) {
      updatePayload.venueCapacity = data.venueCapacity ? parseInt(data.venueCapacity, 10) : null;
    }


    const parish = await prisma.$transaction(async (tx) => {
      // 1. Fetch current parish state to verify it exists and get audit logs
      const currentParish = await tx.parish.findUnique({
        where: { id: numericId },
        include: {
          users: {
            include: { role: true },
          },
        },
      });
      if (!currentParish) {
        const err = new Error("Parish not found.");
        err.statusCode = 404;
        throw err;
      }

      const currentPriest = currentParish.users.find(u => u.role.roleName === "PRIEST");
      const currentSecretary = currentParish.users.find(u => u.role.roleName === "SECRETARY");

      // 2. Handle Priest Assignment
      if (data.priestId !== undefined) {
        const newPriestId = data.priestId ? parseInt(data.priestId, 10) : null;
        const currentPriestId = currentPriest ? currentPriest.id : null;

        if (newPriestId !== currentPriestId) {
          // Unassign previous priest
          if (currentPriestId) {
            await tx.user.update({
              where: { id: currentPriestId },
              data: { parishId: null },
            });
            await PriestAssignmentHandler.cleanupPriestAssignmentsFromParish(currentPriestId, currentParish.id, tx);
            await AuditLogService.log(actorId, `Removed Priest from parish "${currentParish.parishName}"`, tx);
          }

          // Assign new priest
          if (newPriestId) {
            const newPriestUser = await tx.user.findUnique({
              where: { id: newPriestId },
              include: { role: true },
            });
            if (!newPriestUser) {
              const err = new Error("Selected priest not found.");
              err.statusCode = 400;
              throw err;
            }
            if (newPriestUser.role.roleName !== "PRIEST") {
              const err = new Error("Selected user is not a priest.");
              err.statusCode = 400;
              throw err;
            }
            if (newPriestUser.status !== "ACTIVE") {
              const err = new Error("Selected priest is not active.");
              err.statusCode = 400;
              throw err;
            }

            // Clean up any assignments from newPriestUser's old parish if transferred
            if (newPriestUser.parishId && newPriestUser.parishId !== numericId) {
              await PriestAssignmentHandler.cleanupPriestAssignmentsFromParish(newPriestId, newPriestUser.parishId, tx, currentParish.parishName);
            }

            // Assign
            await tx.user.update({
              where: { id: newPriestId },
              data: { parishId: numericId },
            });

            if (currentPriestId) {
              await AuditLogService.log(actorId, `Changed Priest for parish "${currentParish.parishName}" to "${newPriestUser.fullName}"`, tx);
            } else {
              await AuditLogService.log(actorId, `Assigned Priest "${newPriestUser.fullName}" to parish "${currentParish.parishName}"`, tx);
            }
          }
        }
      }

      // 3. Handle Secretary Assignment
      if (data.secretaryId !== undefined) {
        const newSecretaryId = data.secretaryId ? parseInt(data.secretaryId, 10) : null;
        const currentSecretaryId = currentSecretary ? currentSecretary.id : null;

        if (newSecretaryId !== currentSecretaryId) {
          // Unassign previous secretary
          if (currentSecretaryId) {
            await tx.user.update({
              where: { id: currentSecretaryId },
              data: { parishId: null },
            });
            await AuditLogService.log(actorId, `Removed Secretary from parish "${currentParish.parishName}"`, tx);
          }

          // Assign new secretary
          if (newSecretaryId) {
            const newSecretaryUser = await tx.user.findUnique({
              where: { id: newSecretaryId },
              include: { role: true },
            });
            if (!newSecretaryUser) {
              const err = new Error("Selected secretary not found.");
              err.statusCode = 400;
              throw err;
            }
            if (newSecretaryUser.role.roleName !== "SECRETARY") {
              const err = new Error("Selected user is not a secretary.");
              err.statusCode = 400;
              throw err;
            }
            if (newSecretaryUser.status !== "ACTIVE") {
              const err = new Error("Selected secretary is not active.");
              err.statusCode = 400;
              throw err;
            }

            // Assign
            await tx.user.update({
              where: { id: newSecretaryId },
              data: { parishId: numericId },
            });

            if (currentSecretaryId) {
              await AuditLogService.log(actorId, `Changed Secretary for parish "${currentParish.parishName}" to "${newSecretaryUser.fullName}"`, tx);
            } else {
              await AuditLogService.log(actorId, `Assigned Secretary "${newSecretaryUser.fullName}" to parish "${currentParish.parishName}"`, tx);
            }
          }
        }
      }

      // 4. Update the parish details
      const updatedParish = await tx.parish.update({
        where: { id: numericId },
        data: updatePayload,
        include: {
          users: {
            include: { role: true },
          },
        },
      });

      return updatedParish;
    });

    await AuditLogService.log(actorId, `Parish Updated: "${parish.parishName}"`);
    return this.mapToDto(parish);
  }

  /**
   * Archives a parish (sets isActive = false).
   * @param {string|number} id
   * @param {number} actorId
   * @returns {Promise<void>}
   */
  async archiveParish(id, actorId) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      throw err;
    }

    const parish = await this.parishRepository.archive(numericId);
    await AuditLogService.log(actorId, `Parish Archived: "${parish.parishName}"`);
  }

  /**
   * Restores an archived parish (sets isActive = true).
   * @param {string|number} id
   * @param {number} actorId
   * @returns {Promise<object>}
   */
  async restoreParish(id, actorId) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      throw err;
    }

    const parish = await this.parishRepository.restore(numericId);
    await AuditLogService.log(actorId, `Parish Restored: "${parish.parishName}"`);
    return this.mapToDto(parish);
  }

  // MAPPING HELPERS

  /**
   * Maps database Parish model to frontend DTO structure.
   * @param {object} p
   * @returns {object}
   */
  mapToDto(p) {
    const priestUser = p.users?.find((u) => u.role?.roleName === "PRIEST");
    const secretaryUser = p.users?.find((u) => u.role?.roleName === "SECRETARY");

    return {
      id: String(p.id),
      name: p.parishName,
      slug: p.slug || "",
      type: this.mapEnumToType(p.type),
      vicariate: "Vicariate of Canlaon",
      priest: priestUser ? priestUser.fullName : "Unassigned",
      priestId: priestUser ? String(priestUser.id) : null,
      priestName: priestUser ? priestUser.fullName : "Unassigned",
      secretary: secretaryUser ? secretaryUser.fullName : "Unassigned",
      secretaryId: secretaryUser ? String(secretaryUser.id) : null,
      secretaryName: secretaryUser ? secretaryUser.fullName : "Unassigned",
      status: p.isActive ? "Active" : "Archived",
      patronSaint: p.patronSaint || "",
      address: p.address || "",
      municipalityCity: p.municipalityCity || "",
      contactNumber: p.contactNumber || "",
      email: p.email || "",
      latitude: p.latitude,
      longitude: p.longitude,
      feastDay: p.feastDay || "",
      coverImage: p.coverImage || "",
      logoImage: p.logoImage || "",
      mapZoom: p.mapZoom,
      pinColor: p.pinColor || "#7B1C2A",
      showLabel: p.showLabel ?? true,
      directoryDescription: p.directoryDescription || "",
      locationUpdatedAt: p.locationUpdatedAt ? p.locationUpdatedAt.toISOString() : null,
      locationUpdatedBy: p.locationUpdatedBy,
      gallery: p.gallery || [],
      venueCapacity: p.venueCapacity ?? null,
      documentSettings: p.documentSettings
        ? (() => { try { return typeof p.documentSettings === 'string' ? JSON.parse(p.documentSettings) : p.documentSettings; } catch (e) { return p.documentSettings; } })()
        : null,
      eventSettings: p.eventSettings
        ? (() => { try { return typeof p.eventSettings === 'string' ? JSON.parse(p.eventSettings) : p.eventSettings; } catch (e) { return p.eventSettings; } })()
        : null,
      officeHours: p.officeHours
        ? (() => { try { return typeof p.officeHours === 'string' ? JSON.parse(p.officeHours) : p.officeHours; } catch (e) { return p.officeHours; } })()
        : null,
      paymentQrImage: p.paymentQrImage || null,
      paymentQrEnabled: Boolean(p.paymentQrEnabled),
      paymentQrUpdatedAt: p.paymentQrUpdatedAt ? p.paymentQrUpdatedAt.toISOString() : null,
      paymentQrUpdatedBy: p.paymentQrUpdatedBy || null,
      availableDocuments:
        p.availableDocuments !== null && p.availableDocuments !== undefined
          ? getEffectiveOfferedDocuments(p.availableDocuments)
          : [...DEFAULT_OFFERED_DOCUMENTS],
    };
  }

  /**
   * Maps database enum to frontend type string.
   * @param {string} enumVal
   * @returns {string}
   */
  mapEnumToType(enumVal) {
    switch (enumVal) {
      case "PARISH":
        return "Parish";
      case "QUASI_PARISH":
        return "Quasi-Parish";
      case "MISSION_STATION":
        return "Mission Station";
      default:
        return enumVal;
    }
  }

  /**
   * Extrapolates municipality and province from the address string.
   * @param {string} [address]
   * @returns {{municipalityCity: string, province: string}}
   */
  parseAddress(address) {
    let municipalityCity = "Unknown";
    let province = "Negros Oriental";

    if (address) {
      const lower = address.toLowerCase();

      if (lower.includes("occidental")) {
        province = "Negros Occidental";
      } else if (lower.includes("oriental")) {
        province = "Negros Oriental";
      }

      const cities = ["san carlos city", "canlaon city", "don salvador benedicto", "vallehermoso"];
      for (const city of cities) {
        if (lower.includes(city)) {
          municipalityCity = city
            .split(" ")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
          break;
        }
      }
    }

    return { municipalityCity, province };
  }

  /**
   * Fetch all parishes for lightweight map configuration.
   */
  async getParishMapConfig() {
    const parishes = await prisma.parish.findMany({
      orderBy: { parishName: "asc" },
      include: {
        users: {
          include: { role: true },
        },
      },
    });
    return parishes.map((p) => this.mapToDto(p));
  }

  /**
   * Batch update map coordinates and zoom settings for parishes in a transaction.
   * Includes validation, geographic boundary checks, and optimistic locking checks.
   */
  async batchUpdateMapCoordinates(updates, actorId) {
    return await prisma.$transaction(async (tx) => {
      const results = [];
      for (const update of updates) {
        const parishId = parseInt(update.id, 10);
        
        // 1. Fetch current state to check existence and optimistic lock
        const parish = await tx.parish.findUnique({
          where: { id: parishId },
        });

        if (!parish) {
          const err = new Error(`Parish with ID ${parishId} not found.`);
          err.statusCode = 404;
          throw err;
        }

        // Optimistic locking check
        if (update.locationUpdatedAt && parish.locationUpdatedAt) {
          const clientTime = new Date(update.locationUpdatedAt).getTime();
          const dbTime = new Date(parish.locationUpdatedAt).getTime();
          if (Math.abs(clientTime - dbTime) > 1000) {
            const err = new Error(`Parish "${parish.parishName}" has been updated by another coordinator. Please refresh.`);
            err.statusCode = 409;
            throw err;
          }
        }

        // 2. Prepare payload
        const updatePayload = {
          latitude: update.latitude,
          longitude: update.longitude,
          locationUpdatedBy: parseInt(actorId, 10),
          locationUpdatedAt: new Date(),
        };

        if (update.mapZoom !== undefined) updatePayload.mapZoom = update.mapZoom;
        if (update.pinColor !== undefined) updatePayload.pinColor = update.pinColor;
        if (update.showLabel !== undefined) updatePayload.showLabel = update.showLabel;

        // 3. Perform update
        const updatedParish = await tx.parish.update({
          where: { id: parishId },
          data: updatePayload,
          include: {
            users: {
              include: { role: true },
            },
          },
        });

        // 4. Activity Log
        const oldCoords = `(${parish.latitude ?? "null"}, ${parish.longitude ?? "null"})`;
        const newCoords = `(${update.latitude}, ${update.longitude})`;
        await AuditLogService.log(
          actorId,
          `Parish Coordinates Configured: "${parish.parishName}" from ${oldCoords} to ${newCoords}`,
          tx,
          false,
          {
            affectedTable: "parishes",
            affectedRecordId: parishId,
            previousValues: {
              latitude: parish.latitude,
              longitude: parish.longitude,
              mapZoom: parish.mapZoom,
              pinColor: parish.pinColor,
              showLabel: parish.showLabel,
            },
            newValues: {
              latitude: update.latitude,
              longitude: update.longitude,
              mapZoom: update.mapZoom,
              pinColor: update.pinColor,
              showLabel: update.showLabel,
            },
          }
        );

        results.push(updatedParish);
      }

      return results.map((p) => this.mapToDto(p));
    });
  }

  /**
   * Update parish settings (description, email, contact number).
   */
  async updateDirectorySettings(parishId, data, actorId) {
    const numericId = parseInt(parishId, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      throw err;
    }

    const parish = await prisma.parish.findUnique({
      where: { id: numericId },
    });
    if (!parish) {
      const err = new Error("Parish not found.");
      err.statusCode = 404;
      throw err;
    }

    // HTML sanitization helper
    const sanitizeHtml = (str) => (str ? str.replace(/<[^>]*>/g, "") : str);

    const updatePayload = {};
    if (data.directoryDescription !== undefined) {
      updatePayload.directoryDescription = sanitizeHtml(data.directoryDescription);
    }
    if (data.contactNumber !== undefined) {
      updatePayload.contactNumber = data.contactNumber;
    }
    if (data.email !== undefined) {
      updatePayload.email = data.email;
    }

    const updatedParish = await prisma.parish.update({
      where: { id: numericId },
      data: updatePayload,
      include: {
        users: {
          include: { role: true },
        },
      },
    });

    await AuditLogService.log(
      actorId,
      `Parish Directory Settings Updated: "${parish.parishName}"`,
      null,
      false,
      {
        affectedTable: "parishes",
        affectedRecordId: numericId,
        previousValues: {
          directoryDescription: parish.directoryDescription,
          contactNumber: parish.contactNumber,
          email: parish.email,
        },
        newValues: {
          directoryDescription: updatedParish.directoryDescription,
          contactNumber: updatedParish.contactNumber,
          email: updatedParish.email,
        },
      }
    );

    return this.mapToDto(updatedParish);
  }

  /**
   * Uploads and updates Parish Payment QR image with R2 rollback on DB failure.
   */
  async uploadPaymentQr(parishId, file, actorId) {
    const numericId = parseInt(parishId, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      throw err;
    }

    if (!file || !file.buffer) {
      const err = new Error("No image file provided.");
      err.statusCode = 400;
      throw err;
    }

    // 1. File size check (2 MB limit)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.buffer.length > MAX_SIZE) {
      const err = new Error("File size exceeds 2 MB limit.");
      err.statusCode = 400;
      throw err;
    }

    // 2. MIME type & extension check
    const allowedMimeTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      const err = new Error("Invalid file type. Only PNG, JPEG, and WEBP images are allowed.");
      err.statusCode = 400;
      throw err;
    }

    // 3. File signature (magic bytes) validation to prevent SVG, executables, scripts
    const buf = file.buffer;
    const isPng = buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    const isJpeg = buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    const isWebp = buf.length >= 12 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
                   buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;

    if (!isPng && !isJpeg && !isWebp) {
      const err = new Error("File signature validation failed. Uploaded file is not a valid PNG, JPEG, or WEBP image.");
      err.statusCode = 400;
      throw err;
    }

    // 4. Upload to Cloudflare R2
    const ext = isPng ? "png" : isJpeg ? "jpg" : "webp";
    const objectKey = `parishes/${numericId}/payment_qr_${Date.now()}.${ext}`;
    const r2Service = new R2Service();

    let uploadedUrl;
    try {
      uploadedUrl = await r2Service.upload({
        key: objectKey,
        body: file.buffer,
        contentType: file.mimetype,
      });
    } catch (uploadErr) {
      logger.error({ err: uploadErr }, "[ParishService] R2 upload failed for Payment QR");
      const err = new Error("Failed to upload Payment QR image to storage.");
      err.statusCode = 500;
      throw err;
    }

    // 5. Update Database record with Rollback handling
    try {
      const parish = await prisma.parish.update({
        where: { id: numericId },
        data: {
          paymentQrImage: uploadedUrl,
          paymentQrEnabled: true,
          paymentQrUpdatedAt: new Date(),
          paymentQrUpdatedBy: actorId ? parseInt(actorId, 10) : null,
        },
        include: {
          users: { include: { role: true } },
        },
      });

      await AuditLogService.log(actorId, `Payment QR uploaded for parish "${parish.parishName}"`);
      return this.mapToDto(parish);
    } catch (dbErr) {
      // Rollback: delete uploaded file from Cloudflare R2
      logger.error({ err: dbErr, objectKey }, "[ParishService] DB update failed. Rolling back R2 object...");
      try {
        await r2Service.delete(objectKey);
      } catch (rollbackErr) {
        logger.error({ err: rollbackErr, objectKey }, "[ParishService] R2 rollback deletion failed");
      }
      throw dbErr;
    }
  }

  /**
   * Deletes Parish Payment QR image.
   */
  async deletePaymentQr(parishId, actorId) {
    const numericId = parseInt(parishId, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid parish ID format.");
      err.statusCode = 400;
      throw err;
    }

    const parish = await prisma.parish.update({
      where: { id: numericId },
      data: {
        paymentQrImage: null,
        paymentQrEnabled: false,
        paymentQrUpdatedAt: new Date(),
        paymentQrUpdatedBy: actorId ? parseInt(actorId, 10) : null,
      },
      include: {
        users: { include: { role: true } },
      },
    });

    await AuditLogService.log(actorId, `Payment QR deleted for parish "${parish.parishName}"`);
    return this.mapToDto(parish);
  }

  /**
   * Validates office hours format and ensures openTime < closeTime for active days.
   */
  validateOfficeHours(officeHours) {
    if (!officeHours) return;
    let obj = officeHours;
    if (typeof obj === "string") {
      try {
        obj = JSON.parse(obj);
      } catch (e) {
        return; // Legacy text format fallback
      }
    }
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;

    const parseToMinutes = (timeStr) => {
      if (!timeStr || typeof timeStr !== "string") return null;
      const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!match) return null;
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ampm = match[3] ? match[3].toUpperCase() : null;
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (const day of DAYS) {
      const conf = obj[day];
      if (conf && !conf.isClosed) {
        const openMin = parseToMinutes(conf.openTime);
        const closeMin = parseToMinutes(conf.closeTime);
        if (openMin === null || closeMin === null) {
          const err = new Error(`Invalid time format for ${day}. Expected format: 'HH:MM AM/PM' or 'HH:MM'.`);
          err.statusCode = 400;
          throw err;
        }
        if (openMin >= closeMin) {
          const err = new Error(`${day}: Opening time must be earlier than closing time.`);
          err.statusCode = 400;
          throw err;
        }
      }
    }
  }
}
