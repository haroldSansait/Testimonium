import { logger } from "../config/logger.js";
import { prisma } from "../config/db.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { RoleRepository } from "../repositories/RoleRepository.js";
import { FirebaseAdminService } from "./FirebaseAdminService.js";
import { AuditLogService } from "./AuditLogService.js";

export class UserService {
  constructor(
    userRepository = new UserRepository(),
    roleRepository = new RoleRepository(),
    firebaseAdminService = new FirebaseAdminService(),
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.firebaseAdminService = firebaseAdminService;
  }

  /**
   * Retrieves and filters staff users.
   * @param {object} filters
   * @returns {Promise<object>}
   */
  async getUsers(filters) {
    const { data, total } = await this.userRepository.findMany(filters);
    return {
      data: data.map((u) => this.mapToDto(u)),
      total,
    };
  }

  /**
   * Creates a new user in both PostgreSQL and Firebase.
   * Rollback Firebase if database insert fails.
   * @param {object} data
   * @param {number} actorId
   * @returns {Promise<object>}
   */
  async createUser(data, actorId) {
    // 1. Validate fields
    if (!data.name || !data.email || !data.role) {
      const err = new Error("Name, email, and role are required.");
      err.statusCode = 400;
      throw err;
    }

    // 2. Validate email uniqueness in PostgreSQL
    const existing = await this.userRepository.findByEmail(data.email);
    if (existing) {
      const err = new Error("This email is already registered in the system.");
      err.statusCode = 409;
      throw err;
    }

    // 3. Resolve role and parish
    const isAssistant = data.role === "ASSISTANT_PRIEST";
    const roleName = data.role === "ASSISTANT_PRIEST" ? "PRIEST" : data.role;
    const role = await this.roleRepository.findByName(roleName);
    if (!role) {
      const err = new Error(`Role "${data.role}" is not valid.`);
      err.statusCode = 400;
      throw err;
    }

    let parishId = null;
    if (data.parish && data.role !== "DIOCESE_COORDINATOR") {
      const parish = await prisma.parish.findUnique({
        where: { parishName: data.parish },
      });
      if (!parish) {
        const err = new Error(`Parish "${data.parish}" was not found.`);
        err.statusCode = 400;
        throw err;
      }
      parishId = parish.id;
    }

    // Generate secure temporary password
    const tempPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8).toUpperCase() +
      "1a!@";

    // 4. Create in Firebase Auth
    const firebaseUser = await this.firebaseAdminService.createUser({
      email: data.email,
      displayName: data.name,
      password: tempPassword,
    });

    // 5. Create in PostgreSQL (with rollback logic)
    try {
      const created = await this.userRepository.create({
        firebaseUid: firebaseUser.uid,
        email: data.email,
        fullName: data.name,
        isVerified: true,
        roleId: role.id,
        parishId,
        isAssistant,
      });

      await AuditLogService.log(actorId, `User Created: ${data.email}`);

      // Immediately generate a Firebase password setup link
      let setupLink = null;
      try {
        setupLink = await this.firebaseAdminService.generatePasswordResetLink(data.email);
        logger.info({ email: data.email }, "[TESTIMONIUM] Generated onboarding password setup link.");
      } catch (linkErr) {
        logger.error({ email: data.email, errMessage: linkErr.message }, "[TESTIMONIUM] Failed to generate setup link");
      }

      return {
        user: this.mapToDto(created),
        setupLink,
      };
    } catch (dbError) {
      // Rollback Firebase user if database creation fails
      try {
        await this.firebaseAdminService.deleteUser(firebaseUser.uid);
      } catch (fbRollbackError) {
        logger.error({ err: fbRollbackError }, "[TESTIMONIUM] Firebase user creation rollback failure");
      }
      throw dbError;
    }
  }

  /**
   * Updates an existing user record.
   * @param {string|number} id
   * @param {object} data
   * @param {number} actorId
   * @returns {Promise<object>}
   */
  async editUser(id, data, actorId) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid user ID format.");
      err.statusCode = 400;
      throw err;
    }

    const user = await this.userRepository.findById(numericId);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    // Email duplicate check if changing email
    if (data.email && data.email !== user.email) {
      const existing = await this.userRepository.findByEmail(data.email);
      if (existing && existing.id !== numericId) {
        const err = new Error("This email is already in use by another user.");
        err.statusCode = 409;
        throw err;
      }
    }

    // Resolve role and parish
    let roleId = undefined;
    let isAssistant = undefined;
    if (data.role) {
      isAssistant = data.role === "ASSISTANT_PRIEST";
      const roleName = data.role === "ASSISTANT_PRIEST" ? "PRIEST" : data.role;
      const role = await this.roleRepository.findByName(roleName);
      if (!role) {
        const err = new Error(`Role "${data.role}" is not valid.`);
        err.statusCode = 400;
        throw err;
      }
      roleId = role.id;
    }

    let parishId = undefined;
    if (data.parish !== undefined) {
      if (data.parish && data.role !== "DIOCESE_COORDINATOR") {
        const parish = await prisma.parish.findUnique({
          where: { parishName: data.parish },
        });
        if (!parish) {
          const err = new Error(`Parish "${data.parish}" was not found.`);
          err.statusCode = 400;
          throw err;
        }
        parishId = parish.id;
      } else {
        parishId = null;
      }
    }

    // Update in Firebase if linked
    if (user.firebaseUid) {
      await this.firebaseAdminService.updateUser(user.firebaseUid, {
        email: data.email,
        displayName: data.name,
      });
    }

    // Update in PostgreSQL
    const updated = await this.userRepository.update(numericId, {
      fullName: data.name,
      email: data.email,
      roleId,
      parishId,
      isAssistant,
    });

    await AuditLogService.log(actorId, `User Updated: ${updated.email} (Role: ${data.role || 'unchanged'})`, null, false, {
      affectedTable: "User",
      affectedRecordId: updated.id,
      newValues: { role: data.role, email: data.email }
    });
    return this.mapToDto(updated);
  }

  /**
   * Disables user in PostgreSQL and Firebase.
   * @param {string|number} id
   * @param {number} actorId
   * @returns {Promise<void>}
   */
  async disableUser(id, actorId) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid user ID format.");
      err.statusCode = 400;
      throw err;
    }

    const user = await this.userRepository.findById(numericId);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    if (user.firebaseUid) {
      await this.firebaseAdminService.updateUser(user.firebaseUid, { disabled: true });
    }

    await this.userRepository.updateStatus(numericId, "INACTIVE");
    await AuditLogService.log(actorId, `User Disabled: ${user.email}`);
  }

  /**
   * Enables user in PostgreSQL and Firebase.
   * @param {string|number} id
   * @param {number} actorId
   * @returns {Promise<void>}
   */
  async enableUser(id, actorId) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid user ID format.");
      err.statusCode = 400;
      throw err;
    }

    const user = await this.userRepository.findById(numericId);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    if (user.firebaseUid) {
      await this.firebaseAdminService.updateUser(user.firebaseUid, { disabled: false });
    }

    await this.userRepository.updateStatus(numericId, "ACTIVE");
    await AuditLogService.log(actorId, `User Enabled: ${user.email}`);
  }

  /**
   * Triggers password reset link generation in Firebase.
   * @param {string|number} id
   * @param {number} actorId
   * @returns {Promise<string>} Reset link URL
   */
  async resetPassword(id, actorId) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid user ID format.");
      err.statusCode = 400;
      throw err;
    }

    const user = await this.userRepository.findById(numericId);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    const resetLink = await this.firebaseAdminService.generatePasswordResetLink(user.email);
    logger.info({ email: user.email }, "[TESTIMONIUM] Generated password reset link.");
    await AuditLogService.log(actorId, `Password Reset: ${user.email}`);
    return resetLink;
  }

  /**
   * Updates a user's assigned calendar color.
   * @param {string|number} id
   * @param {string|null} color
   * @param {number} actorId
   * @param {string} actorRole
   * @param {number|null} actorParishId
   * @returns {Promise<object>}
   */
  async updateUserColor(id, color, actorId, actorRole, actorParishId) {
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      const err = new Error("Invalid user ID format.");
      err.statusCode = 400;
      throw err;
    }

    const user = await this.userRepository.findById(numericId);
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    // Role check: Secretaries can only update priests of their own parish
    if (actorRole === "SECRETARY") {
      if (user.parishId !== actorParishId) {
        const err = new Error("You do not have permission to manage this priest's color.");
        err.statusCode = 403;
        throw err;
      }
    }

    const updated = await this.userRepository.update(numericId, {
      color: color || null
    });

    await AuditLogService.log(actorId, `Updated priest color for ${updated.email} to ${color || 'default'}`, null, false, {
      affectedTable: "User",
      affectedRecordId: updated.id,
      newValues: { color }
    });

    return this.mapToDto(updated);
  }

  // MAPPING HELPERS

  /**
   * Maps database User model to frontend DTO structure.
   * @param {object} u
   * @returns {object}
   */
  mapToDto(u) {
    return {
      id: String(u.id),
      name: u.fullName,
      email: u.email,
      role: u.isAssistant ? "ASSISTANT_PRIEST" : u.role.roleName,
      parish: u.parish ? u.parish.parishName : "None",
      parishId: u.parishId ? String(u.parishId) : null,
      status: u.status === "ACTIVE" ? "Active" : "Disabled",
      isAssistant: u.isAssistant,
      color: u.color || null,
      avatarInitials: this.getInitials(u.fullName),
      avatarColor: this.getActorColor(u.fullName),
    };
  }

  /**
   * Generates initials for user avatar.
   * @param {string} name
   * @returns {string}
   */
  getInitials(name) {
    if (!name) return "US";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Generates a deterministic avatar color.
   * @param {string} name
   * @returns {string}
   */
  getActorColor(name) {
    const colors = ["#7B1C2A", "#1D4ED8", "#065F46", "#B45309", "#6D28D9", "#0E7490"];
    if (!name) return "#4B5563";
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}
