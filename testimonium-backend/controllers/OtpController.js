import { defaultOtpService } from "../services/OtpService.js";
import { UserRepository } from "../repositories/UserRepository.js";
import { AuthService } from "../services/AuthService.js";

const userRepository = new UserRepository();
const authService = new AuthService();

export const requestEmailVerificationOtp = async (req, res, next) => {
  try {
    const email = req.firebaseUser?.email || req.user?.email;
    const firebaseUid = req.firebaseUser?.uid || req.user?.firebaseUid;
    const recipientName = req.user?.fullName || req.firebaseUser?.name;

    const result = await defaultOtpService.requestEmailVerificationOtp({
      email,
      firebaseUid,
      recipientName,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code || "REQUEST_FAILED",
        message: error.message,
        retryAfter: error.retryAfter,
      });
    }
    return next(error);
  }
};

export const confirmEmailVerificationOtp = async (req, res, next) => {
  try {
    const email = req.firebaseUser?.email || req.user?.email;
    const firebaseUid = req.firebaseUser?.uid || req.user?.firebaseUid;
    const { code } = req.body || {};

    const result = await defaultOtpService.confirmEmailVerificationOtp({
      email,
      firebaseUid,
      code,
    });

    // Resolve refreshed user profile with email_verified true
    const updatedUser = await userRepository.findByFirebaseUid(firebaseUid);
    const profile = updatedUser
      ? await authService.toCurrentApplicationProfile(updatedUser, {
          ...req.firebaseUser,
          email_verified: true,
        })
      : null;

    return res.status(200).json({
      success: true,
      message: result.message,
      data: profile,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code || "CONFIRMATION_FAILED",
        message: error.message,
        remainingAttempts: error.remainingAttempts,
      });
    }
    return next(error);
  }
};

export const requestPasswordResetOtp = async (req, res, next) => {
  try {
    const { email } = req.body || {};

    const result = await defaultOtpService.requestPasswordResetOtp({
      email,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code || "REQUEST_FAILED",
        message: error.message,
        retryAfter: error.retryAfter,
      });
    }
    return next(error);
  }
};

export const verifyPasswordResetOtp = async (req, res, next) => {
  try {
    const { email, code } = req.body || {};

    const result = await defaultOtpService.verifyPasswordResetOtp({
      email,
      code,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code || "VERIFICATION_FAILED",
        message: error.message,
        remainingAttempts: error.remainingAttempts,
      });
    }
    return next(error);
  }
};

export const completePasswordReset = async (req, res, next) => {
  try {
    const { email, resetToken, newPassword } = req.body || {};

    const result = await defaultOtpService.completePasswordReset({
      email,
      resetToken,
      newPassword,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code || "RESET_FAILED",
        message: error.message,
        retryAfter: error.retryAfter,
      });
    }
    return next(error);
  }
};
