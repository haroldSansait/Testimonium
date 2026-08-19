import { DashboardService } from "../services/DashboardService.js";

const dashboardService = new DashboardService();

export const getStats = async (req, res, next) => {
  try {
    const parishId = req.user?.role !== "DIOCESE_COORDINATOR" ? req.user?.parish?.id : (req.query.parishId ? parseInt(req.query.parishId, 10) : undefined);
    const data = await dashboardService.getStats(parishId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getSchedule = async (req, res, next) => {
  try {
    const parishId = req.user?.role !== "DIOCESE_COORDINATOR" ? req.user?.parish?.id : (req.query.parishId ? parseInt(req.query.parishId, 10) : undefined);
    const data = await dashboardService.getSchedule(parishId);
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
