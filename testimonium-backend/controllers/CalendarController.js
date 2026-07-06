import { CalendarService } from "../services/CalendarService.js";

const calendarService = new CalendarService();

export const getEvents = async (req, res, next) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Query parameters 'year' and 'month' are required.",
      });
    }

    const data = await calendarService.getEvents(year, month);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return next(err);
  }
};
