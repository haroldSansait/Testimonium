import { ActivityLogRepository } from "../repositories/ActivityLogRepository.js";

export class ActivityLogService {
  constructor(activityLogRepository = new ActivityLogRepository()) {
    this.activityLogRepository = activityLogRepository;
  }

  /**
   * Returns a paginated list of activity logs with optional filters.
   * @param {object} opts
   * @param {number} opts.page
   * @param {number} opts.limit
   * @param {string|undefined} opts.personnelName - searches by related user's fullName
   * @param {string|undefined} opts.action
   * @param {string|undefined} opts.startDate
   * @param {string|undefined} opts.endDate
   */
  async list({ page = 1, limit = 10, personnelName, action, startDate, endDate } = {}) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return this.activityLogRepository.findMany({
      page: parsedPage,
      limit: parsedLimit,
      personnelName,
      action,
      startDate,
      endDate,
    });
  }
}
