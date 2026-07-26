import { UserRepository } from "../repositories/UserRepository.js";
import { AuthService } from "../services/AuthService.js";

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
    const rememberMe = req.body.rememberMe ?? false;
    const durationDays = rememberMe ? 30 : 1;
    const expiresInSeconds = durationDays * 24 * 60 * 60;

    return res.status(200).json({
      success: true,
      data: {
        user: req.user,
        rememberMe,
        expiresIn: expiresInSeconds,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fullName, contactNumber, address } = req.body;

    const updated = await userRepository.update(userId, {
      fullName,
      contactNumber,
      address,
    });

    const profile = authService.toApplicationProfile(updated);

    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    return next(err);
  }
};


