import { DioceseService } from "../services/DioceseService.js";

const dioceseService = new DioceseService();

export const getStats = async (req, res, next) => {
  try {
    const data = await dioceseService.getStats();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getRecentActivity = async (req, res, next) => {
  try {
    const data = await dioceseService.getRecentActivity();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const data = await dioceseService.getNotifications(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};
