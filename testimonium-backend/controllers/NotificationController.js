import { NotificationService } from "../services/NotificationService.js";

const notificationService = new NotificationService();

export const list = async (req, res, next) => {
  try {
    const data = await notificationService.list(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const markOneRead = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid notification ID.",
      });
    }

    const data = await notificationService.markOneRead(id, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({ success: false, message: err.message });
    }
    return next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllRead(req.user.id);
    return res.status(200).json({
      success: true,
      data: { count: result.count },
    });
  } catch (err) {
    return next(err);
  }
};
