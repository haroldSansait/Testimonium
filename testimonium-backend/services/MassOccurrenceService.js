import { createHash } from "node:crypto";
import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import {
  MASS_CONFLICT_DURATION_MS, evaluatePriestConflictFromSnapshot, getManilaDateString,
  isValidStrictManilaDate, massTemplateAppliesOnDate, parseManilaDateTime,
} from "./ConflictHelper.js";
import { classifyPriestAvailability, loadPriestConflictSnapshot } from "./ScheduleAvailabilityDomainService.js";
import { lockParishSchedulingConfiguration, lockPriestsForScheduling, normalizePositiveSafeInt } from "./SchedulingAvailability.js";
import { activeMassOccurrenceOverride, effectiveMassOccurrence } from "../shared/MassOccurrenceOverride.js";
import { resolveMassDisplayLabel } from "../shared/LayMinisterPresentation.js";

const DAY = 86400000;
function failure(message, code, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode });
}
function weekRange(from) {
  if (!isValidStrictManilaDate(from)) throw failure("Select a valid week start date (YYYY-MM-DD).", "INVALID_DATE_FORMAT", 400);
  const to = new Date(new Date(`${from}T00:00:00Z`).getTime() + 6 * DAY).toISOString().slice(0, 10);
  return { from, to };
}
function stable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stable).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
function token(template, date, override, state) {
  return createHash("sha256").update(JSON.stringify(stable({
    template, date, override, priests: state.priests, snapshots: state.snapshots,
    configurationVersion: state.configurationVersion, from: state.from,
  }))).digest("hex");
}
async function loadState(client, parishId, from) {
  const range = weekRange(from);
  const priests = await client.user.findMany({
    where: { parishId, role: { roleName: "PRIEST" }, status: "ACTIVE" },
    select: { id: true, fullName: true, isAssistant: true }, orderBy: { id: "asc" },
  });
  const parish = await client.parish.findUnique({ where: { id: parishId }, select: { schedulingConfigVersion: true } });
  const snapshots = await Promise.all(priests.map(async priest => {
    try { return await loadPriestConflictSnapshot(priest.id, range.from, range.to, client); }
    catch { return null; }
  }));
  return { ...range, priests, snapshots, configurationVersion: parish?.schedulingConfigVersion };
}
function evaluate(template, date, state) {
  const start = parseManilaDateTime(date, template.timeSlot);
  const end = start && new Date(start.getTime() + MASS_CONFLICT_DURATION_MS);
  const priests = state.priests.map((priest, index) => {
    let classification = "UNKNOWN";
    const snapshot = state.snapshots[index];
    if (snapshot && start) {
      try {
        const result = evaluatePriestConflictFromSnapshot({
          ...snapshot, massTemplates: snapshot.massTemplates.filter(item => item.id !== template.id),
        }, start, end);
        classification = result.available ? "AVAILABLE"
          : ["PRIEST_AVAILABILITY_UNDETERMINED", "UNRESOLVED_SCHEDULE_INTERVAL"].includes(result.reason) ? "UNKNOWN" : "CONFIRMED_UNAVAILABLE";
      } catch { /* Fail closed for malformed source data. */ }
    }
    return { ...priest, classification };
  });
  const classification = !start ? "UNKNOWN"
    : priests.some(priest => priest.classification === "AVAILABLE") ? "AVAILABLE"
    : priests.some(priest => priest.classification === "UNKNOWN") ? "UNKNOWN"
    : priests.length ? "CONFIRMED_UNAVAILABLE" : "NO_ACTIVE_PRIESTS";
  return { classification, priests, startAt: start?.toISOString() ?? null };
}
function occurrenceDto(template, date, state) {
  const override = template.occurrenceOverrides.find(item => new Date(item.occurrenceDate).toISOString().slice(0, 10) === date);
  const activeOverride = activeMassOccurrenceOverride(template, date);
  const effective = effectiveMassOccurrence(template, date);
  return {
    templateId: template.id, date, timeSlot: template.timeSlot, label: template.label,
    displayLabel: resolveMassDisplayLabel(effective), layMinisterAssigned: effective.layMinisterAssigned,
    recurringLayMinisterAssigned: template.layMinisterAssigned,
    assignedPriest: effective.assignedPriest,
    override: override ? { id: override.id, version: override.version, isActive: override.isActive, applies: Boolean(activeOverride) } : null,
    ...evaluate(template, date, state), weekStart: state.from,
    availabilityToken: token(template, date, override, state),
  };
}
const templateInclude = (from, to) => ({
  assignedPriest: { select: { id: true, fullName: true, isAssistant: true } },
  occurrenceOverrides: { where: {
    occurrenceDate: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
  } },
});

export async function getMassOccurrences(parishInput, from = getManilaDateString()) {
  const parishId = normalizePositiveSafeInt(parishInput, "parish ID");
  const range = weekRange(from);
  // A preview is read-only and never seeds templates or changes assignments.
  return prisma.$transaction(async client => {
    const templates = await client.massScheduleTemplate.findMany({
      where: { parishId, OR: [
        { isActive: true },
        { occurrenceOverrides: { some: { isActive: true, occurrenceDate: {
          gte: new Date(range.from + "T00:00:00Z"), lte: new Date(range.to + "T00:00:00Z"),
        } } } },
      ] }, include: templateInclude(range.from, range.to), orderBy: { id: "asc" },
    });
    const state = await loadState(client, parishId, range.from);
    const occurrences = [];
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date(new Date(`${range.from}T00:00:00Z`).getTime() + offset * DAY).toISOString().slice(0, 10);
      for (const template of templates) {
        if (template.isActive && massTemplateAppliesOnDate(template.dayType, date)) occurrences.push(occurrenceDto(template, date, state));
      }
    }
    occurrences.sort((a, b) => (a.startAt || a.date).localeCompare(b.startAt || b.date) || a.templateId - b.templateId);
    const outdatedOverrides = templates.flatMap(template => template.occurrenceOverrides.flatMap(override => {
      const date = new Date(override.occurrenceDate).toISOString().slice(0, 10);
      if (!override.isActive || (template.isActive && massTemplateAppliesOnDate(template.dayType, date))) return [];
      return [{ ...occurrenceDto(template, date, state), timeSlot: override.timeSlot }];
    }));
    return { ...range, occurrences, outdatedOverrides };
  }, { isolationLevel: "RepeatableRead", timeout: 15000 });
}

export async function setMassOccurrenceLayMinister(parishInput, templateInput, date, input, actorId, assign) {
  const parishId = normalizePositiveSafeInt(parishInput, "parish ID");
  const templateId = normalizePositiveSafeInt(templateInput, "template ID");
  const range = weekRange(input?.weekStart);
  if (!isValidStrictManilaDate(date) || date < range.from || date > range.to) {
    throw failure("The selected date is outside the reviewed week.", "INVALID_MASS_OCCURRENCE", 422);
  }
  try {
    return await prisma.$transaction(async tx => {
      await lockParishSchedulingConfiguration(tx, parishId);
      const template = await tx.massScheduleTemplate.findUnique({
        where: { id: templateId }, include: templateInclude(range.from, range.to),
      });
      if (!template || template.parishId !== parishId) throw failure("Mass template not found in this parish.", "MASS_TEMPLATE_NOT_FOUND", 404);
      if (assign && (!template.isActive || !massTemplateAppliesOnDate(template.dayType, date))) {
        throw failure("The selected date no longer belongs to the configured Mass template. Refresh the schedule.", "INVALID_MASS_OCCURRENCE", 422);
      }
      const state = await loadState(tx, parishId, range.from);
      await lockPriestsForScheduling(tx, [...new Set([...state.priests.map(priest => priest.id), template.assignedPriestId].filter(Boolean))]);
      const dto = occurrenceDto(template, date, state);
      if (typeof input.availabilityToken !== "string" || input.availabilityToken !== dto.availabilityToken) {
        throw failure("Scheduling information changed. Refresh availability and review the exact date and time again.", "MASS_OCCURRENCE_STALE");
      }
      const start = parseManilaDateTime(date, template.timeSlot);
      if (assign && (!start || start <= new Date())) throw failure("Select a future Mass occurrence.", "INVALID_MASS_OCCURRENCE", 422);
      const end = start && new Date(start.getTime() + MASS_CONFLICT_DURATION_MS);
      if (assign) {
        if (template.layMinisterAssigned || dto.override?.applies) throw failure("This occurrence is already Lay Minister-led. Refresh the schedule.", "MASS_OCCURRENCE_STALE");
        // The preview never authorizes a write: use the canonical live validator again under locks.
        const classifications = await Promise.all(state.priests.map(priest => classifyPriestAvailability({
          priestId: priest.id, date, startDatetime: start, endDatetime: end,
          excludeMassTemplateId: templateId, timeSlot: template.timeSlot, tx,
        })));
        if (classifications.some((value, index) => value !== dto.priests[index].classification)) {
          throw failure("Priest availability changed. Refresh and review this occurrence again.", "MASS_OCCURRENCE_STALE");
        }
        if (classifications.includes("AVAILABLE")) throw failure("An eligible parish priest is available for this occurrence. A Lay Minister cannot be assigned.", "LAY_MINISTER_PRIEST_AVAILABLE");
        if (classifications.includes("UNKNOWN")) throw failure("Priest availability cannot currently be verified. Retry before assigning a Lay Minister.", "LAY_MINISTER_AVAILABILITY_UNVERIFIED");
      }
      const original = template.occurrenceOverrides.find(item => new Date(item.occurrenceDate).toISOString().slice(0, 10) === date);
      if (!assign && !original?.isActive) throw failure("This override changed or was already removed. Refresh and review again.", "MASS_OCCURRENCE_STALE");
      const data = assign ? {
        dayType: template.dayType, timeSlot: template.timeSlot, templateRevision: template.occurrenceRevision,
        isActive: true, createdById: actorId, revokedAt: null, revokedById: null,
      } : { isActive: false, revokedAt: new Date(), revokedById: actorId };
      const saved = original
        ? await tx.massOccurrenceOverride.update({ where: { id: original.id }, data: { ...data, version: { increment: 1 } } })
        : await tx.massOccurrenceOverride.create({ data: { ...data, templateId, occurrenceDate: new Date(`${date}T00:00:00Z`) } });
      await AuditLogService.log(actorId, assign ? "Mass Occurrence Lay Minister Assigned" : "Mass Occurrence Lay Minister Revoked", tx, false, {
        affectedTable: "mass_occurrence_overrides", affectedRecordId: saved.id, parishId,
        previousValues: original || undefined, newValues: { templateId, date, ...data },
      });
      return { templateId, date, timeSlot: template.timeSlot, layMinisterAssigned: assign };
    }, { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (["P2034", "P2002"].includes(error.code)) throw failure("Scheduling information changed. Refresh availability and review again.", "MASS_OCCURRENCE_STALE");
    throw error;
  }
}
