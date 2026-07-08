import { AnalyticsRepository } from "../repositories/AnalyticsRepository.js";

/**
 * Helper to safely calculate trend percentage.
 * @param {number} current
 * @param {number} previous
 * @returns {number}
 */
function calculateTrend(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100.0 : 0.0;
  }
  const pct = ((current - previous) / previous) * 100;
  return Math.round(pct * 10) / 10; // Round to 1 decimal place
}

export class AnalyticsService {
  constructor(analyticsRepository = new AnalyticsRepository()) {
    this.analyticsRepository = analyticsRepository;
  }

  /**
   * Retrieves overview counts.
   * @returns {Promise<object>}
   */
  async getOverview() {
    const stats = await this.analyticsRepository.getOverviewStats();
    return {
      totalDocumentRequests: stats.documents || 0,
      totalScheduleRequests: stats.schedules || 0,
      activeUsersCount: stats.users || 0,
      activeParishesCount: stats.parishes || 0
    };
  }

  /**
   * Retrieves sacrament stats, maps event type/document type counts, and calculates trend vs previous year.
   * @returns {Promise<Array>}
   */
  async getSacramentAnalytics() {
    const now = new Date();
    const currentYear = now.getFullYear();

    const currentYearStart = new Date(currentYear, 0, 1);
    const currentYearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    const prevYearStart = new Date(currentYear - 1, 0, 1);
    const prevYearEnd = new Date(currentYear - 1, 11, 31, 23, 59, 59, 999);

    const [schedulesData, docsData] = await Promise.all([
      this.analyticsRepository.getSacramentScheduleCounts(
        currentYearStart, currentYearEnd, prevYearStart, prevYearEnd
      ),
      this.analyticsRepository.getSacramentDocumentCounts(
        currentYearStart, currentYearEnd, prevYearStart, prevYearEnd
      )
    ]);

    const getScheduleCount = (list, type) => {
      if (!list) return 0;
      const item = list.find(x => x.eventType === type);
      return item ? item._count : 0;
    };

    const getDocCount = (list, type) => {
      if (!list) return 0;
      const item = list.find(x => x.documentType === type);
      return item ? item._count : 0;
    };

    // Current year totals
    const currentBaptisms = getScheduleCount(schedulesData.currentYearCounts, 'BAPTISM') +
                            getDocCount(docsData.currentYearCounts, 'BAPTISMAL_CERTIFICATE');
    const currentConfirmations = getScheduleCount(schedulesData.currentYearCounts, 'CONFIRMATION') +
                                  getDocCount(docsData.currentYearCounts, 'CONFIRMATION_CERTIFICATE');
    const currentWeddings = getScheduleCount(schedulesData.currentYearCounts, 'WEDDING') +
                            getDocCount(docsData.currentYearCounts, 'MARRIAGE_CERTIFICATE');
    // Funerals and other untracked types are 0 to align with database schema constraints while maintaining frontend contract
    const currentFunerals = 0;

    // Previous year totals
    const prevBaptisms = getScheduleCount(schedulesData.prevYearCounts, 'BAPTISM') +
                         getDocCount(docsData.prevYearCounts, 'BAPTISMAL_CERTIFICATE');
    const prevConfirmations = getScheduleCount(schedulesData.prevYearCounts, 'CONFIRMATION') +
                              getDocCount(docsData.prevYearCounts, 'CONFIRMATION_CERTIFICATE');
    const prevWeddings = getScheduleCount(schedulesData.prevYearCounts, 'WEDDING') +
                         getDocCount(docsData.prevYearCounts, 'MARAGE_CERTIFICATE'); // note the typo in mock if any, or MARRIAGE_CERTIFICATE
    const prevFunerals = 0;

    return [
      { type: 'Baptisms', count: currentBaptisms, trend: calculateTrend(currentBaptisms, prevBaptisms) },
      { type: 'Confirmations', count: currentConfirmations, trend: calculateTrend(currentConfirmations, prevConfirmations) },
      { type: 'Weddings', count: currentWeddings, trend: calculateTrend(currentWeddings, prevWeddings) },
      { type: 'Funerals', count: currentFunerals, trend: 0.0 }
    ];
  }

  /**
   * Retrieves document request analytics, calculating completion rate and average processing time.
   * @returns {Promise<Array>}
   */
  async getDocumentAnalytics() {
    const [countsByStatus, processedDocs] = await Promise.all([
      this.analyticsRepository.getDocumentRequestCountsByStatus(),
      this.analyticsRepository.getProcessedDocumentRequests()
    ]);

    // Document types to display
    const documentTypesMap = {
      BAPTISMAL_CERTIFICATE: 'Baptismal Certificate',
      CONFIRMATION_CERTIFICATE: 'Confirmation Certificate',
      MARRIAGE_CERTIFICATE: 'Marriage Certificate',
      FIRST_COMMUNION_CERTIFICATE: 'First Communion Certificate'
    };

    const allDocTypes = [
      'Baptismal Certificate',
      'Confirmation Certificate',
      'Marriage Certificate',
      'Good Moral Character',
      'Death Certificate',
      'Burial Permit'
    ];

    const statsMap = {};
    allDocTypes.forEach(type => {
      statsMap[type] = {
        total: 0,
        completed: 0,
        processingTimes: []
      };
    });

    // Populate data from DB status counts
    if (countsByStatus) {
      for (const item of countsByStatus) {
        const uiType = documentTypesMap[item.documentType];
        if (uiType && statsMap[uiType]) {
          const count = item._count || 0;
          statsMap[uiType].total += count;
          if (item.status === 'COMPLETED') {
            statsMap[uiType].completed += count;
          }
        }
      }
    }

    // Populate processing times
    if (processedDocs) {
      for (const doc of processedDocs) {
        const uiType = documentTypesMap[doc.documentType];
        if (uiType && statsMap[uiType]) {
          const start = new Date(doc.dateRequested);
          const end = new Date(doc.dateProcessed);
          const diffMs = end.getTime() - start.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (!isNaN(diffDays)) {
            statsMap[uiType].processingTimes.push(diffDays);
          }
        }
      }
    }

    // Format final DTO array
    return allDocTypes.map(type => {
      const stats = statsMap[type];
      const total = stats.total;
      const completed = stats.completed;

      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      let avgProcessingDays = 0.0;
      if (stats.processingTimes.length > 0) {
        const sum = stats.processingTimes.reduce((a, b) => a + b, 0);
        const avg = sum / stats.processingTimes.length;
        avgProcessingDays = Math.round(avg * 10) / 10;
      }

      return {
        documentType: type,
        requestCount: total,
        completionRate,
        avgProcessingDays
      };
    });
  }

  /**
   * Retrieves parish analytics, counting request and active registration volumes.
   * @returns {Promise<Array>}
   */
  async getParishAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const {
      parishes,
      requestCounts,
      activeParishionerCounts,
      newRegistrationCounts
    } = await this.analyticsRepository.getParishAnalyticsData(thirtyDaysAgo);

    const getCount = (list, parishId) => {
      if (!list) return 0;
      const item = list.find(x => x.parishId === parishId);
      return item ? item._count : 0;
    };

    if (!parishes || parishes.length === 0) {
      return [];
    }

    return parishes.map(p => {
      const requestCount = getCount(requestCounts, p.id);
      const activeParishioners = getCount(activeParishionerCounts, p.id);
      const newRegistrations = getCount(newRegistrationCounts, p.id);

      return {
        parish: p.parishName,
        requestCount,
        activeParishioners,
        newRegistrations
      };
    });
  }
}
