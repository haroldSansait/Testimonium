import { logger } from "../config/logger.js";
import { RoleRepository } from "../repositories/RoleRepository.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { AuditLogService } from "./AuditLogService.js";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, isValidLegalVersion } from "../config/legal.js";

import { normalizeAndConstructFullName } from "../utils/nameUtils.js";

export class AuthService {
  constructor(
    userRepository = new UserRepository(),
    roleRepository = new RoleRepository(),
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
  }

  /**
   * Resolves application user from Firebase token and validates/links provider states.
   * Server is single authority for legal timestamps and onboarding status.
   * Database-safe concurrency with P2002 catch-and-requery for multi-instance deployments.
   */
  async getOrCreateApplicationUser(decodedToken, legalAcceptance = null, registrationProfile = null) {
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email;
    const provider = decodedToken.firebase?.sign_in_provider || "password";

    if (!firebaseUid || !email) {
      const error = new Error("Firebase token is missing required profile claims.");
      error.statusCode = 401;
      throw error;
    }

    // 1. Lookup by firebase_uid
    let existingUser = await this.userRepository.findByFirebaseUid(firebaseUid);

    if (existingUser) {
      // Update isVerified if Firebase reports verified email
      if (decodedToken.email_verified && !existingUser.isVerified) {
        existingUser = await this.userRepository.update(existingUser.id, { isVerified: true });
        await AuditLogService.log(existingUser.id, "Email Verified", null, false);
      }

      // If legal acceptance payload provided for existing user missing terms
      if (legalAcceptance && (!existingUser.termsAcceptedAt || !existingUser.privacyAcceptedAt)) {
        existingUser = await this.recordLegalAcceptanceUser(existingUser, legalAcceptance);
      }

      await AuditLogService.log(existingUser.id, provider === "google.com" ? "Google Existing User" : "User Login", null, false);

      return this.toApplicationProfile(existingUser, decodedToken);
    }

    // 2. Lookup by email to check for provider conflict / pre-provisioned accounts
    const existingUserByEmail = await this.userRepository.findByEmail(email);

    if (existingUserByEmail) {
      // Check if user already has a linked firebaseUid belonging to another auth provider account
      if (existingUserByEmail.firebaseUid && existingUserByEmail.firebaseUid !== firebaseUid) {
        await AuditLogService.log(existingUserByEmail.id, "Duplicate Provider Blocked", null, false, {
          metadata: JSON.stringify({ attemptedProvider: provider, email })
        });

        if (provider === "google.com") {
          const error = new Error("This email already has a password account. Please sign in using your password.");
          error.code = "ACCOUNT_EXISTS_WITH_PASSWORD";
          error.statusCode = 409;
          throw error;
        } else {
          const error = new Error("This email is already registered using Google.");
          error.code = "ACCOUNT_EXISTS_WITH_GOOGLE";
          error.statusCode = 409;
          throw error;
        }
      }

      // Link pre-provisioned staff record
      try {
        let linkedUser = await this.userRepository.updateFirebaseUid(
          existingUserByEmail.id,
          firebaseUid,
        );

        if (decodedToken.email_verified) {
          linkedUser = await this.userRepository.update(linkedUser.id, { isVerified: true });
        }

        await AuditLogService.log(linkedUser.id, "Google Account Linked", null, false);
        return this.toApplicationProfile(linkedUser, decodedToken);
      } catch (error) {
        if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
          logger.warn({ firebaseUid, email }, "[AuthService] JIT email-linking race condition detected. Requerying user...");
          const user = (await this.userRepository.findByFirebaseUid(firebaseUid)) || 
                       (await this.userRepository.findByEmail(email));
          if (user) {
            await AuditLogService.log(user.id, "JIT User Reused", null, false);
            return this.toApplicationProfile(user, decodedToken);
          }
        }
        throw error;
      }
    }

    // 3. New User Registration: Legal acceptance is mandatory for all creation paths
    if (legalAcceptance) {
      this.validateLegalPayload(legalAcceptance);
    } else if (provider === "google.com") {
      // Google users must accept terms before account creation
      const error = new Error("Acceptance of Terms of Service and Privacy Policy is required.");
      error.code = "LEGAL_ACCEPTANCE_REQUIRED";
      error.statusCode = 400;
      throw error;
    }

    const parishionerRole = await this.roleRepository.findByName("PARISHIONER");

    if (!parishionerRole) {
      const error = new Error("Default PARISHIONER role is not configured.");
      error.statusCode = 500;
      throw error;
    }

    const serverNow = new Date();
    const termsVersion = legalAcceptance?.termsVersion || CURRENT_TERMS_VERSION;
    const privacyVersion = legalAcceptance?.privacyVersion || CURRENT_PRIVACY_VERSION;

    let fullName;
    if (registrationProfile?.firstName && registrationProfile?.lastName) {
      fullName = normalizeAndConstructFullName(registrationProfile);
    } else if (registrationProfile?.fullName) {
      fullName = String(registrationProfile.fullName).trim();
    } else {
      fullName = this.resolveFullName(decodedToken);
    }

    try {
      const createdUser = await this.userRepository.create({
        firebaseUid,
        email,
        fullName,
        isVerified: Boolean(decodedToken.email_verified),
        roleId: parishionerRole.id,
        parishId: null,
        termsAcceptedAt: serverNow,
        privacyAcceptedAt: serverNow,
        termsVersion,
        privacyVersion,
      });

      await AuditLogService.log(createdUser.id, "Terms Accepted", null, false);
      await AuditLogService.log(createdUser.id, "Privacy Accepted", null, false);
      await AuditLogService.log(createdUser.id, provider === "google.com" ? "Google New User" : "JIT User Created", null, false);
      await AuditLogService.log(createdUser.id, "Registration Completed", null, false);

      if (decodedToken.email_verified) {
        await AuditLogService.log(createdUser.id, "Email Verified", null, false);
      } else {
        await AuditLogService.log(createdUser.id, "Verification Email Sent", null, false);
      }

      return this.toApplicationProfile(createdUser, decodedToken);
    } catch (error) {
      if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
        logger.warn({ firebaseUid, email }, "[AuthService] JIT creation race condition detected across DB instances. Requerying user...");
        const user = (await this.userRepository.findByFirebaseUid(firebaseUid)) || 
                     (await this.userRepository.findByEmail(email));
        if (user) {
          await AuditLogService.log(user.id, "JIT User Reused", null, false);
          return this.toApplicationProfile(user, decodedToken);
        }
      }
      throw error;
    }
  }

  /**
   * Records legal acceptance explicitly for a user.
   */
  async recordLegalAcceptance(userId, legalPayload, decodedToken = null) {
    this.validateLegalPayload(legalPayload);
    const user = await this.userRepository.findById(userId);
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 404;
      throw error;
    }

    const updatedUser = await this.recordLegalAcceptanceUser(user, legalPayload);
    return this.toApplicationProfile(updatedUser, decodedToken);
  }

  async recordLegalAcceptanceUser(user, legalPayload) {
    const serverNow = new Date();
    const updated = await this.userRepository.update(user.id, {
      termsAcceptedAt: serverNow,
      privacyAcceptedAt: serverNow,
      termsVersion: legalPayload.termsVersion || CURRENT_TERMS_VERSION,
      privacyVersion: legalPayload.privacyVersion || CURRENT_PRIVACY_VERSION,
    });
    await AuditLogService.log(updated.id, "Terms Accepted", null, false);
    await AuditLogService.log(updated.id, "Privacy Accepted", null, false);
    return updated;
  }

  /**
   * Validates legal acceptance input fields
   */
  validateLegalPayload(payload) {
    if (!payload?.termsAccepted || !payload?.privacyAccepted) {
      const error = new Error("You must accept both the Terms of Service and Privacy Policy to proceed.");
      error.code = "LEGAL_ACCEPTANCE_REQUIRED";
      error.statusCode = 400;
      throw error;
    }

    const termsVersion = payload.termsVersion || CURRENT_TERMS_VERSION;
    const privacyVersion = payload.privacyVersion || CURRENT_PRIVACY_VERSION;

    if (!isValidLegalVersion(termsVersion, privacyVersion)) {
      const error = new Error("The accepted legal document versions are invalid or outdated.");
      error.code = "INVALID_LEGAL_VERSION";
      error.statusCode = 400;
      throw error;
    }
  }

  resolveFullName(decodedToken) {
    if (decodedToken.name) {
      return decodedToken.name;
    }

    return decodedToken.email.split("@")[0];
  }

  /**
   * Evaluates server-driven onboarding status
   */
  toApplicationProfile(user, decodedToken = null) {
    // Firebase ID Token email_verified claim is the single source of truth
    const emailVerified = decodedToken?.email_verified ?? Boolean(user.isVerified);

    const termsAccepted = Boolean(
      user.termsAcceptedAt && isValidLegalVersion(user.termsVersion, user.privacyVersion)
    );
    const privacyAccepted = Boolean(
      user.privacyAcceptedAt && isValidLegalVersion(user.termsVersion, user.privacyVersion)
    );

    // Backend is sole authority for profile completion state
    const needsProfileCompletion = Boolean(
      !user.fullName ||
      user.fullName.trim() === "" ||
      !user.contactNumber ||
      user.contactNumber.trim() === ""
    );

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      fullName: user.fullName,
      contactNumber: user.contactNumber,
      address: user.address || null,
      isVerified: emailVerified,
      emailVerified,
      termsAccepted,
      privacyAccepted,
      needsProfileCompletion,
      status: user.status,
      role: user.role.roleName,
      parish: user.parish
        ? {
            id: user.parish.id,
            parishName: user.parish.parishName,
            type: user.parish.type,
          }
        : null,
    };
  }

}
