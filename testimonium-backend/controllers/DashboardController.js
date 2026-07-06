import { DashboardService } from "../services/DashboardService.js";

const dashboardService = new DashboardService();

export const getStats = async (req, res, next) => {
  try {
    const data = await dashboardService.getStats();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getSchedule = async (req, res, next) => {
  try {
    const data = await dashboardService.getSchedule();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getAlerts = async (req, res, next) => {
  try {
    const data = await dashboardService.getAlerts(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};
