import { getFirebaseAuth } from "../config/firebase.js";
import { AuthService } from "../services/AuthService.js";
import { env } from "../config/env.js";

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
      decodedToken = await getFirebaseAuth().verifyIdToken(token);
      applicationUser = await authService.getOrCreateApplicationUser(decodedToken);
    }

    req.firebaseUser = decodedToken;
    req.user = applicationUser;

    return next();
  } catch (error) {
    console.error("========== FIREBASE AUTH ERROR ==========");
    console.error(error);
    console.error("=========================================");

    return res.status(401).json({
      success: false,
      message: "Authentication token is invalid or expired.",
      errors: [],
    });
  }
};