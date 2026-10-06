import { logger } from "../config/logger.js";
import { RoleRepository } from "../repositories/RoleRepository.js";
import { UserRepository, profileInclude } from "../repositories/UserRepository.js";
import { AuditLogService } from "./AuditLogService.js";
import { LegalPolicyService } from "./LegalPolicyService.js";

import { normalizeAndConstructFullName } from "../utils/nameUtils.js";
import { isProfileIncomplete } from "../utils/profileCompleteness.js";
import { isEffectivelyVerified } from "../utils/governmentIdVerificationHelper.js";

export class AuthService {
  constructor(
    userRepository = new UserRepository(),
    roleRepository = new RoleRepository(),
    legalPolicyService = LegalPolicyService,
    auditLogService = AuditLogService,
  ) {
    this.userRepository = userRepository;
    this.roleRepository = roleRepository;
    this.legalPolicyService = legalPolicyService;
    this.auditLogService = auditLogService;
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

      if (legalAcceptance) {
        existingUser = await this.recordLegalAcceptanceUser(existingUser, legalAcceptance);
      }

      return this.toCurrentApplicationProfile(existingUser, decodedToken, false);
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
        if (legalAcceptance && (linkedUser.role?.roleName || linkedUser.role) === "PARISHIONER") {
          linkedUser = await this.recordLegalAcceptanceUser(linkedUser, legalAcceptance);
        }
        return this.toCurrentApplicationProfile(linkedUser, decodedToken, false);
      } catch (error) {
        if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
          logger.warn({ firebaseUid, email }, "[AuthService] JIT email-linking race condition detected. Requerying user...");
          const user = (await this.userRepository.findByFirebaseUid(firebaseUid)) || 
                       (await this.userRepository.findByEmail(email));
          if (user) {
            await AuditLogService.log(user.id, "JIT User Reused", null, false);
            return this.toCurrentApplicationProfile(user, decodedToken, false);
          }
        }
        throw error;
      }
    }

    // 3. New User Registration: Legal acceptance is mandatory for all creation paths
    if (!legalAcceptance?.termsAccepted || !legalAcceptance?.privacyAccepted) {
      const error = new Error("Acceptance of Terms of Service and Privacy Policy is required.");
      error.code = "LEGAL_ACCEPTANCE_REQUIRED";
      error.statusCode = 400;
      throw error;
    }

    if (!legalAcceptance?.termsVersion || !legalAcceptance?.privacyVersion) {
      const error = new Error("Explicit legal policy versions are required.");
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

    let fullName;
    if (registrationProfile?.firstName && registrationProfile?.lastName) {
      fullName = normalizeAndConstructFullName(registrationProfile);
    } else if (registrationProfile?.fullName) {
      fullName = String(registrationProfile.fullName).trim();
    } else {
      fullName = this.resolveFullName(decodedToken);
    }

    try {
      const { user: createdUser, currentVersions } =
        await this.legalPolicyService.withCurrentPoliciesForAcceptance(async (tx, policies) => {
          this.validateCompleteLegalAcceptance(legalAcceptance, policies);
          const serverNow = new Date();
          const user = await tx.user.create({
            data: {
              firebaseUid, email, fullName,
              isVerified: Boolean(decodedToken.email_verified),
              roleId: parishionerRole.id, parishId: null,
              termsAcceptedAt: serverNow, privacyAcceptedAt: serverNow,
              termsVersion: policies.termsOfService.version,
              privacyVersion: policies.privacyPolicy.version,
            },
            include: profileInclude,
          });
          await this.auditLogService.logOrThrow(user.id, "Terms Accepted", tx, false);
          await this.auditLogService.logOrThrow(user.id, "Privacy Accepted", tx, false);
          await this.auditLogService.logOrThrow(user.id, provider === "google.com" ? "Google New User" : "JIT User Created", tx, false);
          await this.auditLogService.logOrThrow(user.id, "Registration Completed", tx, false);
          await this.auditLogService.logOrThrow(user.id, decodedToken.email_verified ? "Email Verified" : "Verification Email Sent", tx, false);
          return { user, currentVersions: this.versionsFromPolicies(policies) };
        });

      return this.toApplicationProfile(createdUser, decodedToken, true, currentVersions);
    } catch (error) {
      if (error.code === "P2002" || error.message?.includes("Unique constraint")) {
        logger.warn({ firebaseUid, email }, "[AuthService] JIT creation race condition detected across DB instances. Requerying user...");
        const user = (await this.userRepository.findByFirebaseUid(firebaseUid)) || 
                     (await this.userRepository.findByEmail(email));
        if (user) {
          await AuditLogService.log(user.id, "JIT User Reused", null, false);
          return this.toCurrentApplicationProfile(user, decodedToken, false);
        }
      }
      throw error;
    }
  }

  versionsFromPolicies(policies) {
    return {
      termsVersion: policies.termsOfService.version,
      privacyVersion: policies.privacyPolicy.version,
    };
  }

  validateCompleteLegalAcceptance(payload, policies) {
    if (payload?.termsAccepted !== true || payload?.privacyAccepted !== true ||
        !payload?.termsVersion || !payload?.privacyVersion) {
      const error = new Error("Explicit acceptance of both legal policies and their displayed versions is required.");
      error.statusCode = 400;
      error.code = "LEGAL_ACCEPTANCE_REQUIRED";
      throw error;
    }
    if (payload.termsVersion !== policies.termsOfService.version ||
        payload.privacyVersion !== policies.privacyPolicy.version) {
      const error = new Error("The displayed legal policy versions are outdated. Please review and accept the latest versions.");
      error.statusCode = 409;
      error.code = "LEGAL_ACCEPTANCE_VERSION_CONFLICT";
      throw error;
    }
  }

  async toCurrentApplicationProfile(user, decodedToken = null, isNewUser = false) {
    const role = user.role?.roleName || user.role;
    if (role !== "PARISHIONER") return this.toApplicationProfile(user, decodedToken, isNewUser);
    const policies = await this.legalPolicyService.getCurrentPolicies();
    return this.toApplicationProfile(user, decodedToken, isNewUser, this.versionsFromPolicies(policies));
  }

  async _recordLegalAcceptanceTransaction(userId, legalPayload) {
    if (!legalPayload || typeof legalPayload !== 'object' || Array.isArray(legalPayload)) {
      const error = new Error('Invalid legal acceptance payload.');
      error.statusCode = 400; error.code = 'INVALID_PAYLOAD'; throw error;
    }
    return this.legalPolicyService.withCurrentPoliciesForAcceptance(async (tx, policies) => {
      const hasTerms = 'termsAccepted' in legalPayload || 'termsVersion' in legalPayload;
      const hasPrivacy = 'privacyAccepted' in legalPayload || 'privacyVersion' in legalPayload;
      if (!hasTerms && !hasPrivacy) {
        const error = new Error('At least one legal policy acceptance must be provided.');
        error.statusCode = 400; error.code = 'LEGAL_ACCEPTANCE_REQUIRED'; throw error;
      }
      const updateData = {};
      const serverNow = new Date();

      if (hasTerms) {
        if (legalPayload.termsAccepted !== true || typeof legalPayload.termsVersion !== 'string') {
          const error = new Error('Terms of Service and its displayed version must be explicitly accepted.');
          error.statusCode = 400; error.code = 'LEGAL_ACCEPTANCE_REQUIRED'; throw error;
        }
        if (legalPayload.termsVersion !== policies.termsOfService.version) {
          const error = new Error(`Terms of Service version conflict. Current version is ${policies.termsOfService.version}.`);
          error.statusCode = 409; error.code = 'LEGAL_ACCEPTANCE_VERSION_CONFLICT'; throw error;
        }
        updateData.termsAcceptedAt = serverNow;
        updateData.termsVersion = policies.termsOfService.version;
      }

      if (hasPrivacy) {
        if (legalPayload.privacyAccepted !== true || typeof legalPayload.privacyVersion !== 'string') {
          const error = new Error('Privacy Policy and its displayed version must be explicitly accepted.');
          error.statusCode = 400; error.code = 'LEGAL_ACCEPTANCE_REQUIRED'; throw error;
        }
        if (legalPayload.privacyVersion !== policies.privacyPolicy.version) {
          const error = new Error(`Privacy Policy version conflict. Current version is ${policies.privacyPolicy.version}.`);
          error.statusCode = 409; error.code = 'LEGAL_ACCEPTANCE_VERSION_CONFLICT'; throw error;
        }
        updateData.privacyAcceptedAt = serverNow;
        updateData.privacyVersion = policies.privacyPolicy.version;
      }

      const user = await tx.user.findUnique({ where: { id: userId }, include: profileInclude });
      if (!user) {
        const error = new Error('User not found.');
        error.statusCode = 404; error.code = 'USER_NOT_FOUND'; throw error;
      }
      const updated = await tx.user.update({
        where: { id: userId }, data: updateData, include: profileInclude,
      });
      if (hasTerms) await this.auditLogService.logOrThrow(userId, 'Terms Accepted', tx, false);
      if (hasPrivacy) await this.auditLogService.logOrThrow(userId, 'Privacy Accepted', tx, false);
      return { user: updated, currentVersions: this.versionsFromPolicies(policies) };
    });
  }

  /**
   * Records legal acceptance explicitly for a user.
   */
  async recordLegalAcceptance(userId, legalPayload, decodedToken = null) {
    if (!legalPayload || typeof legalPayload !== "object") {
      const error = new Error("Invalid payload.");
      error.statusCode = 400;
      error.code = "INVALID_PAYLOAD";
      throw error;
    }

    const hasTerms = "termsAccepted" in legalPayload || "termsVersion" in legalPayload;
    const hasPrivacy = "privacyAccepted" in legalPayload || "privacyVersion" in legalPayload;

    if (!hasTerms && !hasPrivacy) {
      const error = new Error("At least one legal policy acceptance must be provided.");
      error.statusCode = 400;
      error.code = "LEGAL_ACCEPTANCE_REQUIRED";
      throw error;
    }

    const { user, currentVersions } = await this._recordLegalAcceptanceTransaction(userId, legalPayload);
    return this.toApplicationProfile(user, decodedToken, false, currentVersions);
  }

  async recordLegalAcceptanceUser(user, legalPayload) {
    const result = await this._recordLegalAcceptanceTransaction(user.id, legalPayload);
    return result.user;
  }

  resolveFullName(decodedToken) {
    if (decodedToken?.name && typeof decodedToken.name === "string") {
      const trimmed = decodedToken.name.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    return "";
  }

  /**
   * Evaluates server-driven onboarding status
   */
  toApplicationProfile(user, decodedToken = null, isNewUser = false, currentVersions = null) {
    // Firebase ID Token email_verified claim is the single source of truth
    const emailVerified = decodedToken?.email_verified ?? Boolean(user.isVerified);

    const versions = currentVersions || {
      termsVersion: user.termsVersion,
      privacyVersion: user.privacyVersion,
    };

    const termsAccepted = Boolean(
      user.termsAcceptedAt && user.termsVersion === versions.termsVersion
    );
    const privacyAccepted = Boolean(
      user.privacyAcceptedAt && user.privacyVersion === versions.privacyVersion
    );

    // Backend is sole authority for profile completion state
    const needsProfileCompletion = isProfileIncomplete(user);

    const isGovIdVerified = isEffectivelyVerified(user.governmentIdVerification);
    const govIdStatus = user.governmentIdVerification?.status || "NOT_SUBMITTED";
    const govIdRejectionReason = user.governmentIdVerification?.rejectionReason || null;
    const govIdVerifiedAt = user.governmentIdVerification?.verifiedAt || null;
    const govIdExpiresAt = user.governmentIdVerification?.expiresAt || null;
    const govIdType = user.governmentIdVerification?.idType || null;

    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      fullName: user.fullName,
      contactNumber: user.contactNumber,
      address: user.address || null,
      isVerified: emailVerified,
      emailVerified,
      governmentIdVerificationStatus: govIdStatus,
      governmentIdRejectionReason: govIdRejectionReason,
      governmentIdVerifiedAt: govIdVerifiedAt,
      governmentIdExpiresAt: govIdExpiresAt,
      governmentIdType: govIdType,
      isGovernmentIdVerified: isGovIdVerified,
      termsAccepted,
      privacyAccepted,
      needsProfileCompletion,
      isNewUser: Boolean(isNewUser),
      status: user.status,
      role: user.role?.roleName || user.role,
      emailNotificationsEnabled: typeof user.emailNotificationsEnabled === "boolean" ? user.emailNotificationsEnabled : true,
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
