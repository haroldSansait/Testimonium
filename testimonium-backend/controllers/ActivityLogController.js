import { ActivityLogService } from "../services/ActivityLogService.js";

const activityLogService = new ActivityLogService();

export const list = async (req, res, next) => {
  try {
    const { page, limit, personnel, action, startDate, endDate } = req.query;

    const { data, total } = await activityLogService.list({
      page,
      limit,
      personnelName: personnel,
      action,
      startDate,
      endDate,
    });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (err) {
    return next(err);
  }
};
