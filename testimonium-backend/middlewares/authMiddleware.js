import { getFirebaseAuth } from "../config/firebase.js";
import { AuthService } from "../services/AuthService.js";

const authService = new AuthService();

export const authenticateFirebaseToken = async (req, res, next) => {
  try {
    const authorizationHeader = req.get("Authorization");

    if (!authorizationHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Authentication token is required.",
      });
    }

    const token = authorizationHeader.slice("Bearer ".length).trim();
    const decodedToken = await getFirebaseAuth().verifyIdToken(token);
    const applicationUser =
      await authService.getOrCreateApplicationUser(decodedToken);

    req.firebaseUser = decodedToken;
    req.user = applicationUser;
    return next();
  } catch {
    return res.status(401).json({
      message: "Authentication token is invalid or expired.",
    });
  }
};
