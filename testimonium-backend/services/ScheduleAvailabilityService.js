import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import {
  WEEKDAYS,
  lockParishSchedulingConfiguration,
  toDatabaseDate,
} from "./SchedulingAvailability.js";
import { CANONICAL_SCHEDULE_EVENT_TYPES } from "./BookingValidator.js";
import {
  validateOfficeHoursForSave,
  validateSchedulingSettingsForSave,
} from "./SchedulingConfiguration.js";

function staleConfigurationError() {
  const error = new Error("Scheduling settings changed elsewhere. Reload the latest configuration and try again.");
  error.statusCode = 409;
  error.code = "SCHEDULING_CONFIG_STALE";
  return error;
}

function validateExpectedVersion(expectedVersion) {
  const parsed = Number(expectedVersion);
  if (!Number.isInteger(parsed) || parsed < 1) {
    const error = new Error("expectedVersion must be a positive integer.");
    error.statusCode = 400;
    error.code = "INVALID_EXPECTED_VERSION";
    throw error;
  }
  return parsed;
}

function validateWeekdayRules(parishRules, serviceRules) {
  if (!Array.isArray(parishRules) || parishRules.length !== WEEKDAYS.length) {
    const error = new Error("A complete Monday through Sunday parish availability set is required.");
    error.statusCode = 400;
    error.code = "INVALID_WEEKDAY_RULES";
    throw error;
  }
  const parishDays = new Set(parishRules.map((rule) => rule.weekday));
  if (parishDays.size !== WEEKDAYS.length || WEEKDAYS.some((day) => !parishDays.has(day))) {
    const error = new Error("Parish weekday rules must contain each weekday exactly once.");
    error.statusCode = 400;
    error.code = "INVALID_WEEKDAY_RULES";
    throw error;
  }

  const seen = new Set();
  for (const rule of serviceRules || []) {
    if (!CANONICAL_SCHEDULE_EVENT_TYPES.includes(rule.eventType) || !WEEKDAYS.includes(rule.weekday)) {
      const error = new Error("A service weekday override contains an unsupported service or weekday.");
      error.statusCode = 400;
      error.code = "INVALID_SERVICE_WEEKDAY_RULE";
      throw error;
    }
    const key = `${rule.eventType}:${rule.weekday}`;
    if (seen.has(key)) {
      const error = new Error("Duplicate service weekday overrides are not allowed.");
      error.statusCode = 400;
      error.code = "DUPLICATE_SERVICE_WEEKDAY_RULE";
      throw error;
    }
    seen.add(key);
  }
}

async function requireCurrentVersion(tx, parishId, expectedVersion) {
  await lockParishSchedulingConfiguration(tx, parishId);
  const parish = await tx.parish.findUnique({
    where: { id: parishId },
    select: { id: true, schedulingConfigVersion: true },
  });
  if (parish.schedulingConfigVersion !== expectedVersion) throw staleConfigurationError();
  return parish;
}

export class ScheduleAvailabilityService {
  async getConfiguration(parishId, { from, to } = {}) {
    const parsedParishId = Number(parishId);
    const whereDate = {};
    if (from) whereDate.gte = toDatabaseDate(from);
    if (to) whereDate.lte = toDatabaseDate(to);

    const parish = await prisma.parish.findUnique({
      where: { id: parsedParishId },
      select: {
        id: true,
        schedulingConfigVersion: true,
        weekdayRules: { orderBy: { id: "asc" } },
        serviceWeekdayRules: { orderBy: [{ eventType: "asc" }, { id: "asc" }] },
        scheduleDateRules: {
          where: Object.keys(whereDate).length ? { exceptionDate: whereDate } : undefined,
          include: {
            serviceOverrides: { orderBy: { eventType: "asc" } },
            createdBy: { select: { id: true, fullName: true } },
          },
          orderBy: { exceptionDate: "asc" },
        },
      },
    });
    if (!parish) {
      const error = new Error("Parish not found.");
      error.statusCode = 404;
      error.code = "PARISH_NOT_FOUND";
      throw error;
    }
    return parish;
  }

  async replaceWeekdayRules(parishId, payload, actorId) {
    const parsedParishId = Number(parishId);
    const expectedVersion = validateExpectedVersion(payload.expectedVersion);
    const parishRules = payload.parishRules || [];
    const serviceRules = payload.serviceRules || [];
    validateWeekdayRules(parishRules, serviceRules);
    const normalizedEventSettings = payload.eventSettings
      ? validateSchedulingSettingsForSave(payload.eventSettings)
      : null;
    const normalizedOfficeHours = payload.officeHours
      ? validateOfficeHoursForSave(payload.officeHours)
      : null;

    return prisma.$transaction(async (tx) => {
      await requireCurrentVersion(tx, parsedParishId, expectedVersion);
      const previous = await Promise.all([
        tx.parishWeekdayRule.findMany({ where: { parishId: parsedParishId } }),
        tx.parishServiceWeekdayRule.findMany({ where: { parishId: parsedParishId } }),
      ]);

      await tx.parishServiceWeekdayRule.deleteMany({ where: { parishId: parsedParishId } });
      await tx.parishWeekdayRule.deleteMany({ where: { parishId: parsedParishId } });
      await tx.parishWeekdayRule.createMany({
        data: parishRules.map((rule) => ({
          parishId: parsedParishId,
          weekday: rule.weekday,
          isAvailable: rule.isAvailable,
        })),
      });
      if (serviceRules.length) {
        await tx.parishServiceWeekdayRule.createMany({
          data: serviceRules.map((rule) => ({
            parishId: parsedParishId,
            eventType: rule.eventType,
            weekday: rule.weekday,
            isAvailable: rule.isAvailable,
          })),
        });
      }
      const parish = await tx.parish.update({
        where: { id: parsedParishId },
        data: {
          schedulingConfigVersion: { increment: 1 },
          ...(normalizedEventSettings ? { eventSettings: JSON.stringify(normalizedEventSettings) } : {}),
          ...(normalizedOfficeHours ? { officeHours: JSON.stringify(normalizedOfficeHours) } : {}),
        },
        select: { schedulingConfigVersion: true },
      });
      await AuditLogService.log(actorId, "SCHEDULE_WEEKDAY_RULE_UPDATED", tx, false, {
        affectedTable: "Parish",
        affectedRecordId: parsedParishId,
        parishId: parsedParishId,
        previousValues: { parishRules: previous[0], serviceRules: previous[1] },
        newValues: {
          parishRules,
          serviceRules,
          eventSettings: normalizedEventSettings,
          officeHours: normalizedOfficeHours,
          version: parish.schedulingConfigVersion,
        },
      });
      return this.getConfigurationWithClient(tx, parsedParishId);
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
  }

  async createDateRule(parishId, payload, actorId) {
    return this.writeDateRule("create", parishId, null, payload, actorId);
  }

  async updateDateRule(parishId, ruleId, payload, actorId) {
    return this.writeDateRule("update", parishId, Number(ruleId), payload, actorId);
  }

  async writeDateRule(operation, parishId, ruleId, payload, actorId) {
    const parsedParishId = Number(parishId);
    const expectedVersion = validateExpectedVersion(payload.expectedVersion);
    const exceptionDate = toDatabaseDate(payload.exceptionDate);
    const overrides = payload.serviceOverrides || [];
    const seen = new Set();
    for (const override of overrides) {
      if (!CANONICAL_SCHEDULE_EVENT_TYPES.includes(override.eventType) || !["AVAILABLE", "UNAVAILABLE"].includes(override.mode)) {
        const error = new Error("Date service overrides require a supported service and AVAILABLE or UNAVAILABLE mode.");
        error.statusCode = 400;
        error.code = "INVALID_DATE_SERVICE_OVERRIDE";
        throw error;
      }
      if (seen.has(override.eventType)) {
        const error = new Error("Duplicate service overrides are not allowed for one date.");
        error.statusCode = 400;
        error.code = "DUPLICATE_DATE_SERVICE_OVERRIDE";
        throw error;
      }
      seen.add(override.eventType);
    }

    try {
      return await prisma.$transaction(async (tx) => {
        await requireCurrentVersion(tx, parsedParishId, expectedVersion);
        let previous = null;
        if (operation === "update") {
          previous = await tx.parishScheduleDateRule.findFirst({
            where: { id: ruleId, parishId: parsedParishId },
            include: { serviceOverrides: true },
          });
          if (!previous) {
            const error = new Error("Scheduling date rule not found.");
            error.statusCode = 404;
            error.code = "DATE_RULE_NOT_FOUND";
            throw error;
          }
        }

        const data = {
          parishId: parsedParishId,
          exceptionDate,
          baseMode: payload.baseMode,
          reason: payload.reason?.trim() || null,
          createdById: actorId,
          serviceOverrides: {
            create: overrides.map((override) => ({ eventType: override.eventType, mode: override.mode })),
          },
        };
        let rule;
        if (operation === "create") {
          rule = await tx.parishScheduleDateRule.create({ data, include: { serviceOverrides: true } });
        } else {
          await tx.parishScheduleDateServiceOverride.deleteMany({ where: { dateRuleId: ruleId } });
          rule = await tx.parishScheduleDateRule.update({
            where: { id: ruleId },
            data: {
              exceptionDate: data.exceptionDate,
              baseMode: data.baseMode,
              reason: data.reason,
              serviceOverrides: data.serviceOverrides,
            },
            include: { serviceOverrides: true },
          });
        }
        const parish = await tx.parish.update({
          where: { id: parsedParishId },
          data: { schedulingConfigVersion: { increment: 1 } },
          select: { schedulingConfigVersion: true },
        });
        await AuditLogService.log(
          actorId,
          operation === "create" ? "SCHEDULE_DATE_RULE_CREATED" : "SCHEDULE_DATE_RULE_UPDATED",
          tx,
          false,
          {
            affectedTable: "ParishScheduleDateRule",
            affectedRecordId: rule.id,
            parishId: parsedParishId,
            previousValues: previous,
            newValues: { ...rule, schedulingConfigVersion: parish.schedulingConfigVersion },
          }
        );
        return { rule, schedulingConfigVersion: parish.schedulingConfigVersion };
      }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (error?.code === "P2002") {
        const conflict = new Error("A scheduling rule already exists for that parish and date.");
        conflict.statusCode = 409;
        conflict.code = "DATE_RULE_EXISTS";
        throw conflict;
      }
      throw error;
    }
  }

  async deleteDateRule(parishId, ruleId, expectedVersion, actorId) {
    const parsedParishId = Number(parishId);
    const parsedVersion = validateExpectedVersion(expectedVersion);
    return prisma.$transaction(async (tx) => {
      await requireCurrentVersion(tx, parsedParishId, parsedVersion);
      const existing = await tx.parishScheduleDateRule.findFirst({
        where: { id: Number(ruleId), parishId: parsedParishId },
        include: { serviceOverrides: true },
      });
      if (!existing) {
        const error = new Error("Scheduling date rule not found.");
        error.statusCode = 404;
        error.code = "DATE_RULE_NOT_FOUND";
        throw error;
      }
      await tx.parishScheduleDateRule.delete({ where: { id: existing.id } });
      const parish = await tx.parish.update({
        where: { id: parsedParishId },
        data: { schedulingConfigVersion: { increment: 1 } },
        select: { schedulingConfigVersion: true },
      });
      await AuditLogService.log(actorId, "SCHEDULE_DATE_RULE_REMOVED", tx, false, {
        affectedTable: "ParishScheduleDateRule",
        affectedRecordId: existing.id,
        parishId: parsedParishId,
        previousValues: existing,
      });
      return { schedulingConfigVersion: parish.schedulingConfigVersion };
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 10000 });
  }

  async getConfigurationWithClient(client, parishId) {
    return client.parish.findUnique({
      where: { id: parishId },
      select: {
        id: true,
        schedulingConfigVersion: true,
        weekdayRules: { orderBy: { id: "asc" } },
        serviceWeekdayRules: { orderBy: [{ eventType: "asc" }, { id: "asc" }] },
        scheduleDateRules: {
          include: { serviceOverrides: { orderBy: { eventType: "asc" } } },
          orderBy: { exceptionDate: "asc" },
        },
      },
    });
  }
}
