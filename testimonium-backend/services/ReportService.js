import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { toDatabaseDate } from "./SchedulingAvailability.js";

function forbidden(message = "You do not have permission to access this report.") {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = "FORBIDDEN";
  return error;
}

function notFound() {
  const error = new Error("Report not found.");
  error.statusCode = 404;
  error.code = "REPORT_NOT_FOUND";
  return error;
}

function stale() {
  const error = new Error("This report changed elsewhere. Reload it before saving.");
  error.statusCode = 409;
  error.code = "REPORT_STALE";
  return error;
}

async function requireParish(client, parishId) {
  if (!parishId) return;
  const exists = await client.parish.count({ where: { id: parishId } });
  if (!exists) {
    const error = new Error("Parish not found.");
    error.statusCode = 404;
    error.code = "PARISH_NOT_FOUND";
    throw error;
  }
}

function actorParishId(actor) {
  return Number(actor.parish?.id || actor.parishId) || null;
}

function validateScope(payload, actor) {
  if (actor.role === "SECRETARY") {
    const parishId = actorParishId(actor);
    if (!parishId) throw forbidden("Secretary account is not assigned to a parish.");
    if (payload.scope !== "PARISH") throw forbidden("Secretaries can create parish reports only.");
    return { scope: "PARISH", parishId };
  }
  if (actor.role !== "DIOCESE_COORDINATOR") throw forbidden();
  if (payload.scope === "DIOCESE") {
    if (payload.parishId !== null && payload.parishId !== undefined) {
      const error = new Error("Diocese reports must not specify a parish.");
      error.statusCode = 400;
      error.code = "INVALID_REPORT_SCOPE";
      throw error;
    }
    return { scope: "DIOCESE", parishId: null };
  }
  const parishId = Number(payload.parishId);
  if (!Number.isInteger(parishId) || parishId < 1) {
    const error = new Error("Parish reports require a parishId.");
    error.statusCode = 400;
    error.code = "INVALID_REPORT_SCOPE";
    throw error;
  }
  return { scope: "PARISH", parishId };
}

function authorize(report, actor) {
  if (actor.role === "DIOCESE_COORDINATOR") return;
  if (actor.role === "SECRETARY" && report.parishId === actorParishId(actor)) return;
  throw forbidden();
}

const include = {
  parish: { select: { id: true, parishName: true } },
  createdBy: { select: { id: true, fullName: true } },
  archivedBy: { select: { id: true, fullName: true } },
};

export class ReportService {
  async list(filters, actor) {
    const where = { isArchived: filters.includeArchived ? undefined : false };
    if (actor.role === "SECRETARY") {
      const parishId = actorParishId(actor);
      if (!parishId) throw forbidden("Secretary account is not assigned to a parish.");
      where.parishId = parishId;
      where.scope = "PARISH";
    } else if (actor.role === "DIOCESE_COORDINATOR") {
      if (filters.parishId) where.parishId = filters.parishId;
      if (filters.scope) where.scope = filters.scope;
    } else {
      throw forbidden();
    }
    if (filters.category) where.category = filters.category;
    if (filters.authorId) where.createdById = filters.authorId;
    if (filters.from || filters.to) {
      where.reportDate = {};
      if (filters.from) where.reportDate.gte = toDatabaseDate(filters.from);
      if (filters.to) where.reportDate.lte = toDatabaseDate(filters.to);
    }
    if (filters.keyword) {
      where.OR = [
        { title: { contains: filters.keyword, mode: "insensitive" } },
        { description: { contains: filters.keyword, mode: "insensitive" } },
      ];
    }
    const skip = (filters.page - 1) * filters.limit;
    const [data, total] = await Promise.all([
      prisma.dailyReport.findMany({
        where,
        include,
        skip,
        take: filters.limit,
        orderBy: [{ reportDate: "desc" }, { createdAt: "desc" }],
      }),
      prisma.dailyReport.count({ where }),
    ]);
    return { data, total };
  }

  async getById(id, actor) {
    const report = await prisma.dailyReport.findUnique({ where: { id: Number(id) }, include });
    if (!report) throw notFound();
    authorize(report, actor);
    return report;
  }

  async create(payload, actor) {
    const scope = validateScope(payload, actor);
    return prisma.$transaction(async (tx) => {
      await requireParish(tx, scope.parishId);
      const report = await tx.dailyReport.create({
        data: {
          reportDate: toDatabaseDate(payload.reportDate),
          ...scope,
          title: payload.title,
          category: payload.category,
          description: payload.description,
          createdById: actor.id,
        },
        include,
      });
      await AuditLogService.log(actor.id, "REPORT_CREATED", tx, false, {
        affectedTable: "DailyReport",
        affectedRecordId: report.id,
        parishId: report.parishId,
        newValues: report,
      });
      return report;
    });
  }

  async update(id, payload, actor) {
    const parsedId = Number(id);
    const current = await prisma.dailyReport.findUnique({ where: { id: parsedId } });
    if (!current) throw notFound();
    authorize(current, actor);
    if (current.isArchived) {
      const error = new Error("Archived reports cannot be edited.");
      error.statusCode = 409;
      error.code = "REPORT_ARCHIVED";
      throw error;
    }
    if (current.version !== payload.expectedVersion) throw stale();
    const scope = validateScope(payload, actor);
    return prisma.$transaction(async (tx) => {
      await requireParish(tx, scope.parishId);
      const result = await tx.dailyReport.updateMany({
        where: { id: parsedId, version: payload.expectedVersion, isArchived: false },
        data: {
          reportDate: toDatabaseDate(payload.reportDate),
          ...scope,
          title: payload.title,
          category: payload.category,
          description: payload.description,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw stale();
      const report = await tx.dailyReport.findUnique({ where: { id: parsedId }, include });
      await AuditLogService.log(actor.id, "REPORT_UPDATED", tx, false, {
        affectedTable: "DailyReport",
        affectedRecordId: report.id,
        parishId: report.parishId,
        previousValues: current,
        newValues: report,
      });
      return report;
    });
  }

  async archive(id, expectedVersion, actor) {
    const parsedId = Number(id);
    const current = await prisma.dailyReport.findUnique({ where: { id: parsedId } });
    if (!current) throw notFound();
    authorize(current, actor);
    return prisma.$transaction(async (tx) => {
      const result = await tx.dailyReport.updateMany({
        where: { id: parsedId, version: Number(expectedVersion), isArchived: false },
        data: {
          isArchived: true,
          archivedAt: new Date(),
          archivedById: actor.id,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw stale();
      const report = await tx.dailyReport.findUnique({ where: { id: parsedId }, include });
      await AuditLogService.log(actor.id, "REPORT_ARCHIVED", tx, false, {
        affectedTable: "DailyReport",
        affectedRecordId: report.id,
        parishId: report.parishId,
        previousValues: current,
        newValues: report,
      });
      return report;
    });
  }
}
