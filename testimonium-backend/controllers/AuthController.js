import { UserRepository } from "../repositories/UserRepository.js";
import { AuthService } from "../services/AuthService.js";
import { AuditLogService } from "../services/AuditLogService.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { shouldRequireEmailVerification } from "../utils/emailVerificationPolicy.js";

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
    const email = req.body?.email || req.firebaseUser?.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        code: "INVALID_REQUEST",
        message: "Email address is required.",
      });
    }

    const user = await userRepository.findByEmail(email);

    // Prevent Email Enumeration: Always return success message for non-existent users
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an eligible account exists, a verification email has been sent.",
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

    // Check 5 resends/day account limit
    let currentCount = user.verificationResentCount || 0;
    if (user.lastVerificationResentAt) {
      const timeSinceLastResend = now - new Date(user.lastVerificationResentAt).getTime();
      if (timeSinceLastResend > DAY_MS) {
        currentCount = 0; // Reset counter after 24h
      }
    }

    if (currentCount >= 5) {
      return res.status(429).json({
        success: false,
        code: "ACCOUNT_RESEND_LIMIT_EXCEEDED",
        message: "Maximum verification resend limit reached for today (5/day). Please try again tomorrow.",
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
      message: "Verification email sent.",
    });
  } catch (err) {
    return next(err);
  }
};

import { normalizeAndConstructFullName } from "../utils/nameUtils.js";
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
    const { termsAccepted, privacyAccepted, registrationProfile, firstName, middleName, lastName, suffix } = req.body;

    if (!termsAccepted || !privacyAccepted) {
      return res.status(400).json({
        success: false,
        code: "LEGAL_ACCEPTANCE_REQUIRED",
        message: "Acceptance of Terms of Service and Privacy Policy is required.",
      });
    }

    let userProfile = req.user;
    const nameParts = registrationProfile || { firstName, middleName, lastName, suffix };

    // If structured name fields provided, normalize and update user profile
    if (nameParts.firstName && nameParts.lastName) {
      const fullName = normalizeAndConstructFullName(nameParts);
      if (fullName !== req.user.fullName) {
        const updated = await userRepository.update(req.user.id, { fullName });
        userProfile = authService.toApplicationProfile(updated, req.firebaseUser, Boolean(req.user?.isNewUser));
        logger.debug({ userId: req.user.id, fullName }, "[AuthController] Updated user registration fullName");
      }
    }

    // The /register endpoint specifically provisions a newly registered account journey.
    // It must authoritatively return isNewUser: true regardless of prior JIT middleware checks.
    const isNewUser = true;

    return res.status(200).json({
      success: true,
      data: {
        ...userProfile,
        isNewUser: true,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, firstName, middleName, lastName, suffix, contactNumber, address, emailNotificationsEnabled } = req.body;

    if (emailNotificationsEnabled !== undefined && typeof emailNotificationsEnabled !== "boolean") {
      return res.status(400).json({
        success: false,
        code: "INVALID_PREFERENCE",
        message: "emailNotificationsEnabled must be a boolean.",
      });
    }

    const updatePayload = {};

    if (fullName !== undefined || (firstName && lastName)) {
      let finalFullName = fullName;
      if (firstName && lastName) {
        finalFullName = normalizeAndConstructFullName({ firstName, middleName, lastName, suffix });
      }
      if (finalFullName !== undefined) {
        updatePayload.fullName = finalFullName;
      }
    }

    if (contactNumber !== undefined) {
      updatePayload.contactNumber = contactNumber;
    }

    if (address !== undefined) {
      updatePayload.address = address;
    }

    if (emailNotificationsEnabled !== undefined) {
      updatePayload.emailNotificationsEnabled = emailNotificationsEnabled;
    }

    const updated = await userRepository.update(userId, updatePayload);

    const profile = authService.toApplicationProfile(updated, req.firebaseUser);

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    return next(err);
  }
};

