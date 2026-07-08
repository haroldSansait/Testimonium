import { ScheduleRepository } from "../repositories/ScheduleRepository.js";

export class ScheduleService {
  constructor(scheduleRepository = new ScheduleRepository()) {
    this.scheduleRepository = scheduleRepository;
  }

  /**
   * Returns a paginated list of schedule requests with optional filters.
   * @param {object} opts
   * @param {number} opts.page
   * @param {number} opts.limit
   * @param {string|undefined} opts.search
   * @param {string|undefined} opts.status
   */
  async list({ page = 1, limit = 10, search, status, parishId } = {}) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return this.scheduleRepository.findMany({
      page: parsedPage,
      limit: parsedLimit,
      search,
      status,
      parishId,
    });
  }
}
