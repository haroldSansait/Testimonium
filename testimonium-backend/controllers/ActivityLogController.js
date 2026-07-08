import { ActivityLogService } from "../services/ActivityLogService.js";

const activityLogService = new ActivityLogService();

export const list = async (req, res, next) => {
  try {
    const { page, limit, personnel, action, startDate, endDate, status, includeArchived, archivedOnly, role } = req.query;
    const parishId = req.user.role !== "DIOCESE_COORDINATOR" ? req.user.parish?.id : undefined;

    const { items, total, active, archived } = await activityLogService.list({
      page,
      limit,
      personnelName: personnel,
      action,
      startDate,
      endDate,
      parishId,
      status,
      includeArchived: includeArchived === "true",
      archivedOnly: archivedOnly === "true",
      role,
    });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return res.status(200).json({
      success: true,
      data: items,
      active,
      archived,
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

export const archive = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const actorId = req.user.id;

    if (!Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. 'ids' must be an array.",
      });
    }

    await activityLogService.archiveSelected(ids, actorId);
    return res.status(200).json({
      success: true,
      message: "Selected activity logs successfully archived.",
    });
  } catch (err) {
    return next(err);
  }
};

export const archiveAll = async (req, res, next) => {
  try {
    const actorId = req.user.id;
    await activityLogService.archiveAll(actorId);
    return res.status(200).json({
      success: true,
      message: "All eligible activity logs successfully archived.",
    });
  } catch (err) {
    return next(err);
  }
};

export const restore = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const actorId = req.user.id;

    if (!Array.isArray(ids)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payload. 'ids' must be an array.",
      });
    }

    await activityLogService.restoreSelected(ids, actorId);
    return res.status(200).json({
      success: true,
      message: "Selected activity logs successfully restored.",
    });
  } catch (err) {
    return next(err);
  }
};

export const restoreAll = async (req, res, next) => {
  try {
    const actorId = req.user.id;
    await activityLogService.restoreAll(actorId);
    return res.status(200).json({
      success: true,
      message: "All archived activity logs successfully restored.",
    });
  } catch (err) {
    return next(err);
  }
};

export const purge = async (req, res, next) => {
  try {
    const actorId = req.user.id;
    await activityLogService.purgeArchived(actorId);
    return res.status(200).json({
      success: true,
      message: "Archived activity logs older than retention period successfully purged.",
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
};
