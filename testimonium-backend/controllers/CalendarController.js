import { CalendarService } from "../services/CalendarService.js";
import { validateParishAccess } from "../utils/tenantGuard.js";

const calendarService = new CalendarService();

export const getEvents = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    let parishId;
    if (req.user.role === "DIOCESE_COORDINATOR") {
      parishId = req.query.parishId ? parseInt(req.query.parishId, 10) : undefined;
    } else if (req.user.role === "SECRETARY" || req.user.role === "PRIEST") {
      parishId = req.user.parish?.id;
      if (req.query.parishId && parseInt(req.query.parishId, 10) !== parishId) {
        await validateParishAccess(req, req.query.parishId, "Calendar Events");
      }
    } else {
      parishId = req.query.parishId ? parseInt(req.query.parishId, 10) : undefined;
    }

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Query parameters 'year' and 'month' are required.",
      });
    }

    const data = await calendarService.getEvents(year, month, parishId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};

export const getPriestCalendar = async (req, res, next) => {
  try {
    const priestId = req.user.id;
    const { year, month, startDate, endDate } = req.query;

    const data = await calendarService.getPriestCalendar(priestId, {
      year,
      month,
      startDate,
      endDate,
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};
