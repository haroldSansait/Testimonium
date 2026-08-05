import { getFirebaseAuth } from "../config/firebase.js";
import { AuthService } from "../services/AuthService.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const authService = new AuthService();

export const authenticateFirebaseToken = async (req, res, next) => {
  try {
    const authorizationHeader = req.get("Authorization");

    if (!authorizationHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required.",
        errors: [],
      });
    }

    const token = authorizationHeader.slice("Bearer ".length).trim();

    let decodedToken;
    let applicationUser;

    if (env.nodeEnv === "development" && env.enableDevAuth && token === "test-token-coordinator") {
      decodedToken = {
        uid: "FEoSXFxvPMVAK8D20ynOs2j2LEn2",
        email: "coordinator@testimonium.org",
        email_verified: true,
        name: "Diocese Coordinator"
      };
      applicationUser = await authService.getOrCreateApplicationUser(decodedToken);
    } else {
      decodedToken = await getFirebaseAuth().verifyIdToken(token, true);
      const registrationProfile = req.body?.registrationProfile || (req.body?.firstName && req.body?.lastName ? req.body : null);
      const legalAcceptance = req.body?.legalAcceptance || (req.body?.termsAccepted && req.body?.privacyAccepted ? req.body : null);
      applicationUser = await authService.getOrCreateApplicationUser(decodedToken, legalAcceptance, registrationProfile);
    }

    req.firebaseUser = decodedToken;
    req.user = applicationUser;

    return next();
  } catch (error) {
    logger.warn({ errMessage: error.message, code: error.code }, "[AuthMiddleware] Firebase authentication verification failed");

    if (error.statusCode && error.code) {
      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        message: error.message,
        errors: [],
      });
    }

    return res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || "Authentication token is invalid or expired.",
      errors: [],
    });
  }
};