import { parseManilaDateOnly } from "./ConflictHelper.js";

export const WEEKDAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const DEFAULT_SUNDAY_RESTRICTED_SERVICES = [
  "WEDDING",
  "MARRIAGE_SPECIAL",
  "FUNERAL",
];

export function getCanonicalWeekday(dateInput) {
  const parsed = parseManilaDateOnly(dateInput);
  if (!parsed) {
    const error = new Error("Invalid date format. Expected YYYY-MM-DD.");
    error.statusCode = 400;
    error.code = "INVALID_DATE_FORMAT";
    throw error;
  }
  return parsed.dayName.toUpperCase();
}

export async function lockParishSchedulingConfiguration(client, parishId) {
  const rows = await client.$queryRaw`
    SELECT "parish_id"
    FROM "parishes"
    WHERE "parish_id" = ${Number(parishId)}
    FOR UPDATE
  `;
  if (!rows.length) {
    const error = new Error("Parish not found.");
    error.statusCode = 404;
    error.code = "PARISH_NOT_FOUND";
    throw error;
  }
}

/**
 * Strictly validates and normalizes a positive safe integer ID.
 * Required accepted input:
 * - positive safe integer number
 * OR
 * - strict digit-only string representing positive safe integer
 *
 * Rejects: null, undefined, 0, -1, 1.5, "1.5", "123junk", " 123junk", "abc", "", NaN, Infinity, unsafe integers.
 */
export function normalizePositiveSafeInt(value, fieldLabel = "ID", code = "INVALID_ID") {
  if (typeof value === "string") {
    if (!/^\d+$/.test(value)) {
      const error = new Error(`Invalid ${fieldLabel}. Must be a positive integer.`);
      error.statusCode = 400;
      error.code = code;
      throw error;
    }
  } else if (typeof value !== "number") {
    const error = new Error(`Invalid ${fieldLabel}. Must be a positive integer.`);
    error.statusCode = 400;
    error.code = code;
    throw error;
  }

  const numericId = Number(value);
  if (!Number.isSafeInteger(numericId) || numericId <= 0) {
    const error = new Error(`Invalid ${fieldLabel}. Must be a positive integer.`);
    error.statusCode = 400;
    error.code = code;
    throw error;
  }
  return numericId;
}

export function normalizePriestId(priestId) {
  return normalizePositiveSafeInt(priestId, "priest ID", "INVALID_PRIEST_ID");
}

export function normalizeParishId(parishId) {
  return normalizePositiveSafeInt(parishId, "parish ID", "INVALID_PARISH_ID");
}

/**
 * Acquires an exclusive row-level lock on a priest User record to serialize
 * concurrent priest commitment creations, assignments, and updates.
 *
 * Must fail closed:
 * 1. Strictly validates priestId
 * 2. Queries/locks exact User row
 * 3. Verifies exactly one intended priest exists
 * 4. Throws if invalid or missing
 *
 * @param {object} client - Prisma transaction client
 * @param {number|string} priestId
 * @returns {Promise<number>} - Normalized priest ID
 */
export async function lockPriestForScheduling(client, priestId) {
  const numericId = normalizePriestId(priestId);
  const rows = await client.$queryRaw`
    SELECT "user_id"
    FROM "users"
    WHERE "user_id" = ${numericId}
    FOR UPDATE
  `;
  if (!rows || rows.length !== 1) {
    const error = new Error("Priest user not found.");
    error.statusCode = 404;
    error.code = "PRIEST_NOT_FOUND";
    throw error;
  }
  return numericId;
}

/**
 * Deterministically locks multiple priests in ascending ID order to prevent deadlocks.
 * Strictly validates every provided ID and rejects malformed input completely.
 *
 * @param {object} client - Prisma transaction client
 * @param {Array<number|string>} priestIds
 * @returns {Promise<number[]>} - Unique sorted locked priest IDs
 */
export async function lockPriestsForScheduling(client, priestIds) {
  if (!Array.isArray(priestIds)) {
    const error = new Error("Invalid priest IDs list.");
    error.statusCode = 400;
    error.code = "INVALID_PRIEST_ID";
    throw error;
  }
  if (!priestIds.length) return [];

  // Validate every provided ID strictly - reject malformed input
  const normalizedIds = priestIds.map((id) => normalizePriestId(id));
  const uniqueSorted = Array.from(new Set(normalizedIds)).sort((a, b) => a - b);

  for (const priestId of uniqueSorted) {
    await lockPriestForScheduling(client, priestId);
  }
  return uniqueSorted;
}

export async function loadSchedulingRules(client, parishId, dateInput = null) {
  const exceptionDate = dateInput ? toDatabaseDate(dateInput) : null;
  const [weekdayRules, serviceWeekdayRules, dateRule] = await Promise.all([
    client.parishWeekdayRule.findMany({ where: { parishId: Number(parishId) } }),
    client.parishServiceWeekdayRule.findMany({ where: { parishId: Number(parishId) } }),
    exceptionDate
      ? client.parishScheduleDateRule.findUnique({
          where: {
            parishId_exceptionDate: {
              parishId: Number(parishId),
              exceptionDate,
            },
          },
          include: { serviceOverrides: true },
        })
      : Promise.resolve(null),
  ]);
  return { weekdayRules, serviceWeekdayRules, dateRule };
}

export function toDatabaseDate(dateInput) {
  const parsed = parseManilaDateOnly(dateInput);
  if (!parsed) {
    const error = new Error("Invalid date format. Expected YYYY-MM-DD.");
    error.statusCode = 400;
    error.code = "INVALID_DATE_FORMAT";
    throw error;
  }
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

export function evaluateSchedulingRules({ eventType, dateInput, weekdayRules, serviceWeekdayRules, dateRule }) {
  const weekday = getCanonicalWeekday(dateInput);
  const serviceDateOverride = dateRule?.serviceOverrides?.find(
    (rule) => rule.eventType === eventType
  );

  if (serviceDateOverride?.mode === "UNAVAILABLE") {
    throw unavailableError("DATE_UNAVAILABLE", dateRule?.reason);
  }
  if (serviceDateOverride?.mode === "AVAILABLE") {
    return { available: true, source: "SERVICE_DATE_OVERRIDE", weekday };
  }
  if (dateRule?.baseMode === "UNAVAILABLE") {
    throw unavailableError("DATE_UNAVAILABLE", dateRule.reason);
  }
  if (dateRule?.baseMode === "AVAILABLE") {
    return { available: true, source: "DATE_OVERRIDE", weekday };
  }

  const serviceWeekdayRule = serviceWeekdayRules?.find(
    (rule) => rule.eventType === eventType && rule.weekday === weekday
  );
  if (serviceWeekdayRule) {
    if (!serviceWeekdayRule.isAvailable) {
      throw unavailableError("SERVICE_UNAVAILABLE_ON_DAY");
    }
    return { available: true, source: "SERVICE_WEEKDAY_OVERRIDE", weekday };
  }

  const parishWeekdayRule = weekdayRules?.find((rule) => rule.weekday === weekday);
  if (!parishWeekdayRule) {
    const error = new Error("Persisted parish weekday availability is incomplete.");
    error.statusCode = 409;
    error.code = "SCHEDULING_CONFIGURATION_INCOMPLETE";
    throw error;
  }
  if (parishWeekdayRule && !parishWeekdayRule.isAvailable) {
    throw unavailableError("DATE_UNAVAILABLE");
  }

  return { available: true, source: "PARISH_WEEKDAY", weekday };
}

function unavailableError(code, reason = null) {
  const error = new Error(
    reason ||
      (code === "SERVICE_UNAVAILABLE_ON_DAY"
        ? "This scheduling service is not available on the selected day."
        : "The selected date is not available for scheduling.")
  );
  error.statusCode = 409;
  error.code = code;
  return error;
}
