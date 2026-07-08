import { ScheduleRepository } from "../repositories/ScheduleRepository.js";

export class CalendarService {
  constructor(scheduleRepository = new ScheduleRepository()) {
    this.scheduleRepository = scheduleRepository;
  }

  /**
   * Returns all schedule events for the given calendar month.
   * @param {number} year
   * @param {number} month - 1-based (1 = January, 12 = December)
   */
  async getEvents(year, month, parishId) {
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (
      !Number.isInteger(parsedYear) ||
      !Number.isInteger(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      parsedYear < 2000 ||
      parsedYear > 2100
    ) {
      const error = new Error("Invalid year or month. year must be 2000–2100, month must be 1–12.");
      error.statusCode = 400;
      throw error;
    }

    return this.scheduleRepository.findByMonth(parsedYear, parsedMonth, parishId);
  }
}
