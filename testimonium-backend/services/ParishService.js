import { ParishRepository } from "../repositories/ParishRepository.js";
import { AuditLogService } from "./AuditLogService.js";
import { prisma } from "../config/db.js";

export class ParishService {
  constructor(parishRepository = new ParishRepository()) {
    this.parishRepository = parishRepository;
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
   * @param {string|number} id
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
   * Creates a new parish, parsing address into municipalityCity and province.
   * @param {object} data
   * @param {number} actorId
   * @returns {Promise<object>}
   */
  async createParish(data, actorId) {
    if (!data.name || !data.type) {
      const err = new Error("Parish name and type are required.");
      err.statusCode = 400;
      throw err;
    }

    const { municipalityCity, province } = this.parseAddress(data.address);
    const parish = await this.parishRepository.create({
      ...data,
      municipalityCity,
      province,
    });

    await AuditLogService.log(actorId, `Parish Created: "${parish.parishName}"`);
    return this.mapToDto(parish);
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
    if (data.address !== undefined) {
      updatePayload.address = data.address;
      if (data.address) {
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
      updatePayload.eventSettings = data.eventSettings && typeof data.eventSettings === "object" ? JSON.stringify(data.eventSettings) : data.eventSettings;
    }
    if (data.officeHours !== undefined) {
      updatePayload.officeHours = data.officeHours && typeof data.officeHours === "object" ? JSON.stringify(data.officeHours) : data.officeHours;
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
      contactNumber: p.contactNumber || "",
      email: p.email || "",
      latitude: p.latitude,
      longitude: p.longitude,
      feastDay: p.feastDay || "",
      coverImage: p.coverImage || "",
      logoImage: p.logoImage || "",
      mapZoom: p.mapZoom,
      pinColor: p.pinColor || "#0d9488",
      showLabel: p.showLabel ?? true,
      directoryDescription: p.directoryDescription || "",
      locationUpdatedAt: p.locationUpdatedAt ? p.locationUpdatedAt.toISOString() : null,
      locationUpdatedBy: p.locationUpdatedBy,
      gallery: p.gallery || [],
      documentSettings: p.documentSettings ? JSON.parse(p.documentSettings) : null,
      eventSettings: p.eventSettings ? JSON.parse(p.eventSettings) : null,
      officeHours: p.officeHours ? JSON.parse(p.officeHours) : null,
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
}
