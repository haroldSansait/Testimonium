import { ScheduleService } from "../services/ScheduleService.js";

const scheduleService = new ScheduleService();

export const list = async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;
    const parishId = req.user.role !== "DIOCESE_COORDINATOR" ? req.user.parish?.id : undefined;

    const { data, total } = await scheduleService.list({
      page,
      limit,
      search,
      status,
      parishId,
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
