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
