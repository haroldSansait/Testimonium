import { Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";

export class AnalyticsRepository {
  /**
   * Get counts of document requests, schedules, active users, and active parishes.
   * @returns {Promise<object>}
   */
  async getOverviewStats() {
    const [documents, schedules, users, parishes] = await Promise.all([
      prisma.documentRequest.count(),
      prisma.schedule.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.parish.count({ where: { isActive: true } }),
    ]);
    return { documents, schedules, users, parishes };
  }

  /**
   * Get sacrament schedule counts for current year and previous year to calculate trend.
   * @param {Date} currentYearStart
   * @param {Date} currentYearEnd
   * @param {Date} prevYearStart
   * @param {Date} prevYearEnd
   * @returns {Promise<object>}
   */
  async getSacramentScheduleCounts(currentYearStart, currentYearEnd, prevYearStart, prevYearEnd) {
    const [currentYearCounts, prevYearCounts] = await Promise.all([
      prisma.schedule.groupBy({
        by: ['eventType'],
        where: {
          requestedDate: {
            gte: currentYearStart,
            lte: currentYearEnd
          },
          status: 'CONFIRMED'
        },
        _count: true
      }),
      prisma.schedule.groupBy({
        by: ['eventType'],
        where: {
          requestedDate: {
            gte: prevYearStart,
            lte: prevYearEnd
          },
          status: 'CONFIRMED'
        },
        _count: true
      })
    ]);
    return { currentYearCounts, prevYearCounts };
  }

  /**
   * Get sacrament document request counts for current year and previous year to calculate trend.
   * @param {Date} currentYearStart
   * @param {Date} currentYearEnd
   * @param {Date} prevYearStart
   * @param {Date} prevYearEnd
   * @returns {Promise<object>}
   */
  async getSacramentDocumentCounts(currentYearStart, currentYearEnd, prevYearStart, prevYearEnd) {
    const [currentYearCounts, prevYearCounts] = await Promise.all([
      prisma.documentRequest.groupBy({
        by: ['documentType'],
        where: {
          dateRequested: {
            gte: currentYearStart,
            lte: currentYearEnd
          }
        },
        _count: true
      }),
      prisma.documentRequest.groupBy({
        by: ['documentType'],
        where: {
          dateRequested: {
            gte: prevYearStart,
            lte: prevYearEnd
          }
        },
        _count: true
      })
    ]);
    return { currentYearCounts, prevYearCounts };
  }

  /**
   * Get document request counts grouped by type and status.
   * @returns {Promise<Array>}
   */
  async getDocumentRequestCountsByStatus() {
    return prisma.documentRequest.groupBy({
      by: ['documentType', 'status'],
      _count: true
    });
  }

  /**
   * Get processing times for document requests with a processed date.
   * @returns {Promise<Array>}
   */
  async getProcessedDocumentRequests() {
    return prisma.documentRequest.findMany({
      where: {
        dateProcessed: { not: null }
      },
      select: {
        documentType: true,
        dateRequested: true,
        dateProcessed: true
      }
    });
  }

  /**
   * Get parish analytics: list of active parishes and counts grouped by parishId.
   * @param {Date} thirtyDaysAgo
   * @returns {Promise<object>}
   */
  async getParishAnalyticsData(thirtyDaysAgo) {
    const [parishes, requestCounts, activeParishionerCounts, newRegistrationCounts] = await Promise.all([
      prisma.parish.findMany({
        where: { isActive: true },
        select: { id: true, parishName: true }
      }),
      prisma.documentRequest.groupBy({
        by: ['parishId'],
        _count: true
      }),
      prisma.user.groupBy({
        by: ['parishId'],
        where: {
          role: { roleName: 'PARISHIONER' },
          status: 'ACTIVE'
        },
        _count: true
      }),
      prisma.user.groupBy({
        by: ['parishId'],
        where: {
          role: { roleName: 'PARISHIONER' },
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: true
      })
    ]);

    return { parishes, requestCounts, activeParishionerCounts, newRegistrationCounts };
  }

  async getDescriptiveAnalytics(filters) {
    const { from, toExclusive, parishId, documentType, eventType, documentStatus, scheduleStatus, category, includeUsers } = filters;
    const documentWhere = {
      dateRequested: { gte: from, lt: toExclusive },
      ...(parishId ? { parishId } : {}),
      ...(documentType ? { documentType } : {}),
      ...(documentStatus ? { status: documentStatus } : {}),
    };
    const scheduleWhere = {
      createdAt: { gte: from, lt: toExclusive },
      ...(parishId ? { parishId } : {}),
      ...(eventType ? { eventType } : {}),
      ...(scheduleStatus ? { status: scheduleStatus } : {}),
    };
    const eventWhere = {
      eventDate: { gte: from, lt: toExclusive },
      isActive: true,
      ...(parishId ? { parishId } : {}),
      ...(eventType ? { eventType } : {}),
    };
    const reportWhere = {
      reportDate: { gte: from, lt: toExclusive },
      isArchived: false,
      ...(parishId ? { parishId } : {}),
      ...(category ? { category } : {}),
    };
    const paymentWhere = {
      createdAt: { gte: from, lt: toExclusive },
      ...(parishId ? { request: { parishId } } : {}),
    };

    const docParishSql = parishId ? Prisma.sql`AND dr."parish_id" = ${parishId}` : Prisma.empty;
    const scheduleParishSql = parishId ? Prisma.sql`AND s."parish_id" = ${parishId}` : Prisma.empty;
    const eventParishSql = parishId ? Prisma.sql`AND pe."parish_id" = ${parishId}` : Prisma.empty;
    const reportParishSql = parishId ? Prisma.sql`AND r."parish_id" = ${parishId}` : Prisma.empty;
    const documentTypeSql = documentType ? Prisma.sql`AND dr."document_type" = ${documentType}::"DocumentType"` : Prisma.empty;
    const eventTypeSql = eventType ? Prisma.sql`AND s."event_type" = ${eventType}::"ScheduleEventType"` : Prisma.empty;
    const documentStatusSql = documentStatus ? Prisma.sql`AND dr."status" = ${documentStatus}::"DocumentRequestStatus"` : Prisma.empty;
    const scheduleStatusSql = scheduleStatus ? Prisma.sql`AND s."status" = ${scheduleStatus}::"ScheduleStatus"` : Prisma.empty;
    const parishEventTypeSql = eventType ? Prisma.sql`AND pe."event_type" = ${eventType}` : Prisma.empty;
    const reportCategorySql = category ? Prisma.sql`AND r."category" = ${category}::"ReportCategory"` : Prisma.empty;

    const [
      documentTotal,
      documentsByType,
      documentsByStatus,
      documentMonthly,
      processingAverage,
      paymentTotal,
      paymentByStatus,
      verifiedAmount,
      receiptsSubmitted,
      paymentCorrections,
      paymentMonthly,
      scheduleTotal,
      schedulesByType,
      schedulesByStatus,
      scheduleMonthly,
      busiestWeekdays,
      eventTotal,
      eventsByVisibility,
      eventsByType,
      eventMonthly,
      reportTotal,
      reportsByCategory,
      reportMonthly,
      userRoleDistribution,
      userMonthly,
      documentByParish,
      scheduleByParish,
    ] = await Promise.all([
      prisma.documentRequest.count({ where: documentWhere }),
      prisma.documentRequest.groupBy({ by: ["documentType"], where: documentWhere, _count: true }),
      prisma.documentRequest.groupBy({ by: ["status"], where: documentWhere, _count: true }),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', dr."date_requested"), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM "document_requests" dr
        WHERE dr."date_requested" >= ${from} AND dr."date_requested" < ${toExclusive}
          ${docParishSql} ${documentTypeSql} ${documentStatusSql}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw`
        SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (dr."date_processed" - dr."date_requested")) / 3600.0), 0)::float8 AS hours
        FROM "document_requests" dr
        WHERE dr."date_requested" >= ${from} AND dr."date_requested" < ${toExclusive}
          AND dr."date_processed" IS NOT NULL ${docParishSql} ${documentTypeSql} ${documentStatusSql}`,
      prisma.paymentTransaction.count({ where: paymentWhere }),
      prisma.paymentTransaction.groupBy({ by: ["status"], where: paymentWhere, _count: true }),
      prisma.paymentTransaction.aggregate({
        where: { ...paymentWhere, status: "VERIFIED" },
        _sum: { amount: true },
      }),
      prisma.receiptUpload.count({
        where: {
          uploadedAt: { gte: from, lt: toExclusive },
          ...(parishId ? { transaction: { request: { parishId } } } : {}),
        },
      }),
      prisma.requestHistory.count({
        where: {
          createdAt: { gte: from, lt: toExclusive },
          newStatus: "PAYMENT_NEEDS_CORRECTION",
          ...(parishId ? { request: { parishId } } : {}),
        },
      }),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', pt."created_at"), 'YYYY-MM') AS month,
               COUNT(*)::int AS count,
               COALESCE(SUM(pt."amount"), 0)::text AS amount
        FROM "payment_transactions" pt
        JOIN "document_requests" dr ON dr."request_id" = pt."request_id"
        WHERE pt."created_at" >= ${from} AND pt."created_at" < ${toExclusive}
          AND pt."status" = 'VERIFIED' ${docParishSql}
        GROUP BY 1 ORDER BY 1`,
      prisma.schedule.count({ where: scheduleWhere }),
      prisma.schedule.groupBy({ by: ["eventType"], where: scheduleWhere, _count: true }),
      prisma.schedule.groupBy({ by: ["status"], where: scheduleWhere, _count: true }),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', s."created_at"), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM "schedules" s
        WHERE s."created_at" >= ${from} AND s."created_at" < ${toExclusive}
          ${scheduleParishSql} ${eventTypeSql} ${scheduleStatusSql}
        GROUP BY 1 ORDER BY 1`,
      prisma.$queryRaw`
        SELECT EXTRACT(ISODOW FROM s."requested_date")::int AS weekday,
               COUNT(*)::int AS count
        FROM "schedules" s
        WHERE s."requested_date" >= ${from} AND s."requested_date" < ${toExclusive}
          ${scheduleParishSql} ${eventTypeSql} ${scheduleStatusSql}
        GROUP BY 1 ORDER BY count DESC, weekday ASC`,
      prisma.parishEvent.count({ where: eventWhere }),
      prisma.parishEvent.groupBy({ by: ["visibility"], where: eventWhere, _count: true }),
      prisma.parishEvent.groupBy({ by: ["eventType"], where: eventWhere, _count: true }),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', pe."event_date"), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM "parish_events" pe
        WHERE pe."event_date" >= ${from} AND pe."event_date" < ${toExclusive}
          AND pe."is_active" = true ${eventParishSql} ${parishEventTypeSql}
        GROUP BY 1 ORDER BY 1`,
      prisma.dailyReport.count({ where: reportWhere }),
      prisma.dailyReport.groupBy({ by: ["category"], where: reportWhere, _count: true }),
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', r."report_date"), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM "daily_reports" r
        WHERE r."report_date" >= ${from} AND r."report_date" < ${toExclusive}
          AND r."is_archived" = false ${reportParishSql} ${reportCategorySql}
        GROUP BY 1 ORDER BY 1`,
      includeUsers
        ? prisma.user.groupBy({ by: ["roleId"], where: { createdAt: { lt: toExclusive } }, _count: true })
        : Promise.resolve([]),
      includeUsers
        ? prisma.$queryRaw`
            SELECT to_char(date_trunc('month', u."created_at"), 'YYYY-MM') AS month,
                   COUNT(*)::int AS count
            FROM "users" u
            WHERE u."created_at" >= ${from} AND u."created_at" < ${toExclusive}
            GROUP BY 1 ORDER BY 1`
        : Promise.resolve([]),
      parishId ? Promise.resolve([]) : prisma.documentRequest.groupBy({ by: ["parishId"], where: documentWhere, _count: true }),
      parishId ? Promise.resolve([]) : prisma.schedule.groupBy({ by: ["parishId"], where: scheduleWhere, _count: true }),
    ]);

    const roles = includeUsers
      ? await prisma.role.findMany({ select: { id: true, roleName: true } })
      : [];
    const roleNameById = new Map(roles.map((role) => [role.id, role.roleName]));
    return {
      documents: { total: documentTotal, byType: documentsByType, byStatus: documentsByStatus, monthly: documentMonthly, averageProcessingHours: Number(processingAverage[0]?.hours || 0) },
      payments: { totalTransactions: paymentTotal, receiptsSubmitted, corrections: paymentCorrections, byStatus: paymentByStatus, verifiedAmount: verifiedAmount._sum.amount?.toFixed(2) || "0.00", monthly: paymentMonthly },
      scheduling: { total: scheduleTotal, byType: schedulesByType, byStatus: schedulesByStatus, monthlyBySubmissionDate: scheduleMonthly, busiestWeekdaysByRequestedDate: busiestWeekdays },
      events: { total: eventTotal, byVisibility: eventsByVisibility, byType: eventsByType, monthlyByEventDate: eventMonthly },
      reports: { total: reportTotal, byCategory: reportsByCategory, monthlyByReportDate: reportMonthly },
      users: includeUsers ? { byRole: userRoleDistribution.map((row) => ({ role: roleNameById.get(row.roleId), count: row._count })), monthlyGrowth: userMonthly } : null,
      parishComparisons: parishId ? null : { documents: documentByParish, schedules: scheduleByParish },
    };
  }
}
