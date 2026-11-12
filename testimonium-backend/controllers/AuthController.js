import { UserRepository } from "../repositories/UserRepository.js";
import { AuthService } from "../services/AuthService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { shouldRequireEmailVerification } from "../utils/emailVerificationPolicy.js";
import { defaultGovernmentIdVerificationService } from "../services/GovernmentIdVerificationService.js";
import { formatRemainingTime } from "../services/OtpService.js";
import {
  doesConfirmedNameMatchDisplayedName,
  hasConfirmedStructuredName,
  needsGoogleLegalNameConfirmation,
} from "../utils/googleLegalNameConfirmation.js";
import {
  cleanNullableNameValue,
  hasAnyNameField,
  hasLegalNameChange,
  normalizeAndConstructFullName,
  resolveParishionerNameUpdate,
  resolveUserNameUpdate,
} from "../utils/nameUtils.js";


const userRepository = new UserRepository();
const authService = new AuthService();

export const getProfile = (req, res) => {
  // req.user is populated by authenticateFirebaseToken middleware
  return res.status(200).json({
    success: true,
    data: req.user,
  });
};

export const login = async (req, res, next) => {
  try {
    const provider = req.firebaseUser?.firebase?.sign_in_provider || "password";
    const isEmailVerified = Boolean(req.firebaseUser?.email_verified);
    const userRole = req.user?.role;

    // 1. Email verification policy enforcement
    if (!isEmailVerified) {
      const verificationRequired = shouldRequireEmailVerification({
        role: userRole,
        provider,
        environment: env.nodeEnv,
      });

      if (verificationRequired) {
        return res.status(403).json({
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before signing in.",
        });
      }

      // Audit log when email verification requirement is bypassed by development policy
      const roleName = typeof userRole === "string" ? userRole : userRole?.roleName;
      await AuditLogService.log(
        req.user.id,
        "Admin Email Verification Bypassed",
        null,
        false,
        {
          role: roleName,
          metadata: {
            environment: env.nodeEnv,
            policyState: env.adminEmailVerificationRequired ? "REQUIRED" : "DISABLED",
          },
        }
      );
    }

    // Log explicit user login event
    await AuditLogService.log(req.user.id, "User Login", null, false);

    const rememberMe = req.body.rememberMe ?? false;
    const durationDays = rememberMe ? 30 : 1;
    const expiresInSeconds = durationDays * 24 * 60 * 60;

    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
        isNewUser: Boolean(req.user?.isNewUser),
        rememberMe,
        expiresIn: expiresInSeconds,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const email = req.firebaseUser?.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "INVALID_REQUEST",
        message: "Email address is required.",
      });
    }

    const user = await userRepository.findByFirebaseUid(req.firebaseUser.uid);

    // Prevent Email Enumeration: Always return success message for non-existent users
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "Verification request accepted.",
      });
    }

    const now = Date.now();
    const COOLDOWN_MS = 60 * 1000; // 60 seconds cooldown
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Check 60-second cooldown
    if (user.lastVerificationResentAt) {
      const timeSinceLastResend = now - new Date(user.lastVerificationResentAt).getTime();
      if (timeSinceLastResend < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - timeSinceLastResend) / 1000);
        return res.status(429).json({
          success: false,
          code: "RESEND_COOLDOWN_ACTIVE",
          message: `Please wait ${remainingSeconds} seconds before requesting another verification email.`,
          retryAfter: remainingSeconds,
        });
      }
    }

    // Check resends/day account limit
    const maxDailySends = env.otp?.maxDailySends || 30;
    let currentCount = user.verificationResentCount || 0;
    if (user.lastVerificationResentAt) {
      const timeSinceLastResend = now - new Date(user.lastVerificationResentAt).getTime();
      if (timeSinceLastResend > DAY_MS) {
        currentCount = 0; // Reset counter after 24h
      }
    }

    if (currentCount >= maxDailySends) {
      const remainingSeconds = user.lastVerificationResentAt
        ? Math.max(1, Math.ceil((DAY_MS - (now - new Date(user.lastVerificationResentAt).getTime())) / 1000))
        : 86400;
      return res.status(429).json({
        success: false,
        code: "ACCOUNT_RESEND_LIMIT_EXCEEDED",
        message: `You've reached the verification email limit (${maxDailySends} requests). You can request another code in ${formatRemainingTime(remainingSeconds)}.`,
        retryAfter: remainingSeconds,
      });
    }

    // Update resend tracking state in database
    await userRepository.update(user.id, {
      lastVerificationResentAt: new Date(),
      verificationResentCount: currentCount + 1,
    });

    await AuditLogService.log(user.id, "Verification Resent", null, false, {
      metadata: { email }
    });

    return res.status(200).json({
      success: true,
      message: "Verification request accepted.",
    });
  } catch (err) {
    return next(err);
  }
};

export { normalizeAndConstructFullName };

export const recordLegalAcceptance = async (req, res, next) => {
  try {
    const profile = await authService.recordLegalAcceptance(req.user.id, req.body, req.firebaseUser);
    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    return next(err);
  }
};

export const register = async (req, res, next) => {
  try {
    const {
      termsAccepted,
      privacyAccepted,
      termsVersion,
      privacyVersion,
      registrationProfile,
      firstName,
      middleName,
      lastName,
      suffix,
    } = req.body;

    if (!termsAccepted || !privacyAccepted) {
      return res.status(400).json({
        success: false,
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        message: "Acceptance of Terms of Service and Privacy Policy is required.",
      });
    }

    if (!termsVersion || !privacyVersion) {
      return res.status(400).json({
        success: false,
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        message: "Explicit legal policy versions are required for registration.",
      });
    }

    let userProfile = req.user;
    const nameParts = registrationProfile || { firstName, middleName, lastName, suffix };

    if (req.user?.id) {
      let updated = null;
      if (nameParts.firstName && nameParts.lastName) {
        updated = await defaultGovernmentIdVerificationService.withUserVerificationLease(
          req.user.id,
          async () => {
            const latestUser = await userRepository.findById(req.user.id);
            if (!latestUser) return null;

            const nameUpdate = resolveUserNameUpdate(nameParts, latestUser);
            const roleName = latestUser.role?.roleName || latestUser.role;
            if (
              roleName === "PARISHIONER" &&
              latestUser.governmentIdVerification?.status === "VERIFIED" &&
              hasLegalNameChange(nameParts, nameUpdate, latestUser)
            ) {
              const err = new Error(
                "Your legal name is locked after Government ID verification and cannot be changed."
              );
              err.statusCode = 403;
              err.code = "LEGAL_NAME_LOCKED";
              throw err;
            }

            if (Object.entries(nameUpdate).some(([field, value]) => value !== latestUser[field])) {
              const saved = await userRepository.update(req.user.id, nameUpdate);
              logger.debug(
                { userId: req.user.id, fullName: nameUpdate.fullName },
                "[AuthController] Updated user registration fullName"
              );
              return saved;
            }

            return latestUser;
          }
        );
      } else {
        updated = await userRepository.findById(req.user.id);
      }

      if (updated) {
        userProfile = await authService.toCurrentApplicationProfile(
          updated,
          req.firebaseUser,
          Boolean(req.user?.isNewUser),
        );
      }
    }

    const isNewUser = typeof req.user?.isNewUser === "boolean" ? req.user.isNewUser : true;

    return res.status(200).json({
      success: true,
      data: {
        ...userProfile,
        isNewUser,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      fullName,
      firstName,
      middleName,
      lastName,
      suffix,
      legalNameConfirmationAction,
      contactNumber,
      address,
      emailNotificationsEnabled,
    } = req.body;

    if (emailNotificationsEnabled !== undefined && typeof emailNotificationsEnabled !== "boolean") {
      return res.status(400).json({
        success: false,
        code: "INVALID_PREFERENCE",
        message: "emailNotificationsEnabled must be a boolean.",
      });
    }

    if (
      legalNameConfirmationAction !== undefined &&
      legalNameConfirmationAction !== "confirm" &&
      legalNameConfirmationAction !== "correct"
    ) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CONFIRMATION_ACTION",
        message: "legalNameConfirmationAction must be 'confirm' or 'correct'.",
      });
    }

    const nonNameUpdates = {};
    if (contactNumber !== undefined) {
      nonNameUpdates.contactNumber = contactNumber;
    }
    if (address !== undefined) {
      nonNameUpdates.address = address;
    }
    if (emailNotificationsEnabled !== undefined) {
      nonNameUpdates.emailNotificationsEnabled = emailNotificationsEnabled;
    }

    const nameInput = { fullName, firstName, middleName, lastName, suffix };
    const touchesName = hasAnyNameField(nameInput) || legalNameConfirmationAction !== undefined;

    const updated = touchesName
      ? await defaultGovernmentIdVerificationService.withUserVerificationLease(
          userId,
          async () => {
            const latestUser = await userRepository.findById(userId);
            if (!latestUser) {
              const err = new Error("User not found.");
              err.statusCode = 404;
              err.code = "USER_NOT_FOUND";
              throw err;
            }

            const roleName = latestUser.role?.roleName || latestUser.role;
            const isParishioner = roleName === "PARISHIONER";

            if (isParishioner && latestUser.governmentIdVerification?.status === "VERIFIED") {
              const nameFields = ["fullName", "firstName", "middleName", "lastName", "suffix"];
              const hasDirectFieldDiff = nameFields.some(
                (field) =>
                  nameInput[field] !== undefined &&
                  cleanNullableNameValue(nameInput[field]) !== cleanNullableNameValue(latestUser[field])
              );
              if (hasDirectFieldDiff) {
                const err = new Error(
                  "Your legal name is locked after Government ID verification and cannot be changed."
                );
                err.statusCode = 403;
                err.code = "LEGAL_NAME_LOCKED";
                throw err;
              }
            }

            if (legalNameConfirmationAction !== undefined) {
              const f = typeof firstName === "string" ? firstName.trim() : "";
              const l = typeof lastName === "string" ? lastName.trim() : "";
              if (!f || !l) {
                const err = new Error("First name and last name are required.");
                err.statusCode = 400;
                err.code = "INVALID_NAME_FIELDS";
                throw err;
              }
            }

            if (isParishioner && needsGoogleLegalNameConfirmation(latestUser) && !legalNameConfirmationAction) {
              const hasStructuredAttempt = ["firstName", "middleName", "lastName", "suffix"].some(
                (field) => nameInput[field] !== undefined
              );
              const combinedAttempt = cleanNullableNameValue(fullName);
              const hasChangedCombinedAttempt =
                fullName !== undefined && combinedAttempt !== cleanNullableNameValue(latestUser.fullName);
              if (hasStructuredAttempt || hasChangedCombinedAttempt) {
                const err = new Error(
                  "Please complete your initial legal-name confirmation on your Profile page before updating your name."
                );
                err.statusCode = 403;
                err.code = "LEGAL_NAME_CONFIRMATION_REQUIRED";
                throw err;
              }
            }

            const nameUpdate = isParishioner
              ? resolveParishionerNameUpdate(nameInput, latestUser)
              : resolveUserNameUpdate(nameInput, latestUser);

            if (
              isParishioner &&
              latestUser.governmentIdVerification?.status === "VERIFIED" &&
              hasLegalNameChange(nameInput, nameUpdate, latestUser)
            ) {
              const err = new Error(
                "Your legal name is locked after Government ID verification and cannot be changed."
              );
              err.statusCode = 403;
              err.code = "LEGAL_NAME_LOCKED";
              throw err;
            }

            if (
              legalNameConfirmationAction === "confirm" &&
              !doesConfirmedNameMatchDisplayedName(latestUser.fullName, nameUpdate.fullName)
            ) {
              const err = new Error(
                "The entered name components do not match your displayed full name. Please check your entries or choose \"No, I need to correct my name\"."
              );
              err.statusCode = 400;
              err.code = "LEGAL_NAME_CONFIRMATION_MISMATCH";
              throw err;
            }

            // Confirming the displayed name only supplies its boundaries.
            // Keep the saved spelling, accents, punctuation, and capitalization.
            if (legalNameConfirmationAction === "confirm") {
              nameUpdate.fullName = latestUser.fullName;
            }

            const wasConfirming =
              needsGoogleLegalNameConfirmation(latestUser) &&
              hasConfirmedStructuredName(nameUpdate);

            const saved = await userRepository.update(userId, {
              ...nameUpdate,
              ...nonNameUpdates,
            });

            if (wasConfirming) {
              await AuditLogService.log(userId, "Profile Updated", null, false, {
                metadata: { legalNameConfirmed: true },
              });
            }

            return saved;
          }
        )
      : await userRepository.update(userId, nonNameUpdates);

    const profile = await authService.toCurrentApplicationProfile(updated, req.firebaseUser);

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    return next(err);
  }
};
