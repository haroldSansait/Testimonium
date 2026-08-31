import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSchedulingRules,
  getCanonicalWeekday,
  WEEKDAYS,
} from "../services/SchedulingAvailability.js";
import { validateOfficeHoursForSave } from "../services/SchedulingConfiguration.js";
import { validateParishAndOffice } from "../services/BookingValidator.js";
import { EmailOutboxService } from "../services/EmailOutboxService.js";
import { EventVisibility, Prisma } from "@prisma/client";
import { prisma } from "../config/db.js";
import { ParishEventService } from "../services/ParishEventService.js";
import { ReportService } from "../services/ReportService.js";
import { renderEmail } from "../services/email/EmailTemplates.js";
import {
  createReportSchema,
  reportListQuerySchema,
  updateReportSchema,
} from "../validators/reportSchemas.js";
import { validateQuery } from "../middlewares/validateRequest.js";
import { z } from "zod";

test("query validation supports the getter-only req.query contract in Express 5", () => {
  const requestPrototype = {};
  Object.defineProperty(requestPrototype, "query", {
    configurable: true,
    get: () => ({ page: "2", ignored: "value" }),
  });
  const req = Object.create(requestPrototype);
  const res = {
    status: () => assert.fail("A valid query must not produce an HTTP error."),
  };
  let nextCalled = false;

  validateQuery(z.object({ page: z.coerce.number().int().positive() }))(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(Object.hasOwn(req, "query"), true);
  assert.deepEqual(req.query, { page: 2 });
});

test("scheduling rules use deterministic service-date to general-weekday precedence", () => {
  const common = {
    eventType: "WEDDING",
    dateInput: "2026-08-30",
    weekdayRules: [{ weekday: "SUNDAY", isAvailable: false }],
    serviceWeekdayRules: [{ eventType: "WEDDING", weekday: "SUNDAY", isAvailable: false }],
  };
  const dateAvailable = evaluateSchedulingRules({
    ...common,
    dateRule: {
      baseMode: "UNAVAILABLE",
      reason: "Parish closure",
      serviceOverrides: [{ eventType: "WEDDING", mode: "AVAILABLE" }],
    },
  });
  assert.equal(dateAvailable.source, "SERVICE_DATE_OVERRIDE");

  assert.throws(
    () => evaluateSchedulingRules({
      ...common,
      dateRule: { baseMode: "AVAILABLE", serviceOverrides: [{ eventType: "WEDDING", mode: "UNAVAILABLE" }] },
    }),
    (error) => error.code === "DATE_UNAVAILABLE" && error.statusCode === 409
  );

  const serviceWeekdayAvailable = evaluateSchedulingRules({
    ...common,
    serviceWeekdayRules: [{ eventType: "WEDDING", weekday: "SUNDAY", isAvailable: true }],
    dateRule: null,
  });
  assert.equal(serviceWeekdayAvailable.source, "SERVICE_WEEKDAY_OVERRIDE");
});

test("weekday mapping is Manila date-only stable and covers the persisted enum", () => {
  assert.deepEqual(WEEKDAYS, ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]);
  assert.equal(getCanonicalWeekday("2026-08-30"), "SUNDAY");
  assert.equal(getCanonicalWeekday("2026-08-31"), "MONDAY");
});

test("persisted weekday configuration fails closed when the selected weekday row is missing", () => {
  assert.throws(
    () => evaluateSchedulingRules({
      eventType: "BAPTISM",
      dateInput: "2026-08-31",
      weekdayRules: [],
      serviceWeekdayRules: [],
      dateRule: null,
    }),
    (error) => error.code === "SCHEDULING_CONFIGURATION_INCOMPLETE" && error.statusCode === 409
  );
});

test("all scheduling settings writes share strict office-hours validation", () => {
  const valid = { Monday: { isClosed: false, openTime: "08:00 AM", closeTime: "05:00 PM" } };
  assert.deepEqual(validateOfficeHoursForSave(valid), valid);
  assert.throws(() => validateOfficeHoursForSave({ Monday: { isClosed: false, openTime: "25:00", closeTime: "26:00" } }));
  assert.throws(() => validateOfficeHoursForSave({ Monday: { isClosed: false, openTime: "05:00 PM", closeTime: "08:00 AM" } }));
});

test("configured slot starts remain authoritative without an invented 60-minute end", () => {
  const parish = {
    isActive: true,
    officeHours: {
      Monday: { isClosed: false, openTime: "08:00 AM", closeTime: "04:00 PM" },
    },
  };

  assert.equal(validateParishAndOffice(parish, "monday", "03:30 PM"), true);
  assert.throws(
    () => validateParishAndOffice(parish, "monday", "07:30 AM"),
    (error) => error.code === "OUTSIDE_OFFICE_HOURS"
  );
  assert.throws(
    () => validateParishAndOffice(parish, "monday", "04:00 PM"),
    (error) => error.code === "OUTSIDE_OFFICE_HOURS"
  );
});

test("Prisma event visibility and version fields belong to ParishEvent only", () => {
  const parishEvent = Prisma.dmmf.datamodel.models.find((model) => model.name === "ParishEvent");
  const massTemplate = Prisma.dmmf.datamodel.models.find((model) => model.name === "MassScheduleTemplate");
  assert.deepEqual(Object.values(EventVisibility), ["PUBLIC", "PARISH_PRIVATE"]);
  assert.ok(parishEvent?.fields.some((field) => field.name === "visibility"));
  assert.ok(parishEvent?.fields.some((field) => field.name === "version"));
  assert.equal(massTemplate?.fields.some((field) => field.name === "visibility"), false);
  assert.equal(massTemplate?.fields.some((field) => field.name === "version"), false);
});

test("public event discovery excludes PARISH_PRIVATE events and retains recurring Mass templates", async () => {
  const originalEvents = prisma.parishEvent.findMany;
  const originalTemplates = prisma.massScheduleTemplate.findMany;
  const originalUsers = prisma.user.findMany;
  let observedWhere = null;
  prisma.parishEvent.findMany = async ({ where }) => {
    observedWhere = where;
    return [{
      id: 1,
      parishId: 9,
      title: "Public activity",
      eventType: "OTHER",
      eventDate: new Date("2026-08-15T00:00:00.000Z"),
      startTime: null,
      endTime: null,
      description: null,
      location: null,
      visibility: "PUBLIC",
      parish: { id: 9, parishName: "Sample Parish" },
    }];
  };
  prisma.massScheduleTemplate.findMany = async () => [{
    id: 10,
    parishId: 9,
    dayType: "SUNDAY",
    timeSlot: "06:00 AM",
    label: "Sunday Mass",
    isActive: true,
    assignedPriestId: null,
    parish: { id: 9, parishName: "Sample Parish" },
    assignedPriest: null,
  }];
  prisma.user.findMany = async () => [];
  try {
    const events = await new ParishEventService().getPublicEvents("2026", "8");
    assert.equal(observedWhere.visibility, "PUBLIC");
    assert.ok(events.some((event) => event.title === "Public activity"));
    assert.ok(events.some((event) => event.title === "Sunday Mass"));
    assert.ok(events.every((event) => Object.hasOwn(event, "visibility") === false));
  } finally {
    prisma.parishEvent.findMany = originalEvents;
    prisma.massScheduleTemplate.findMany = originalTemplates;
    prisma.user.findMany = originalUsers;
  }
});

test("report validators enforce bounded text, scope shape, and optimistic versions", () => {
  const report = {
    reportDate: "2026-08-29",
    scope: "PARISH",
    parishId: 7,
    title: "Parish activity",
    category: "ACTIVITY",
    description: "Completed pastoral visits.",
  };
  assert.equal(createReportSchema.parse(report).title, report.title);
  assert.equal(updateReportSchema.parse({ ...report, expectedVersion: 2 }).expectedVersion, 2);
  assert.equal(reportListQuerySchema.parse({ includeArchived: "true" }).includeArchived, true);
  assert.throws(() => updateReportSchema.parse({ ...report, expectedVersion: 0 }));
});

test("report lookup independently blocks cross-parish Secretary IDOR", async () => {
  const originalFindUnique = prisma.dailyReport.findUnique;
  prisma.dailyReport.findUnique = async () => ({
    id: 77,
    parishId: 2,
    scope: "PARISH",
    parish: { id: 2, parishName: "Other Parish" },
    createdBy: { id: 9, fullName: "Author" },
    archivedBy: null,
  });
  try {
    const service = new ReportService();
    await assert.rejects(
      () => service.getById(77, { id: 3, role: "SECRETARY", parish: { id: 1 } }),
      (error) => error.code === "FORBIDDEN" && error.statusCode === 403
    );
    const coordinatorView = await service.getById(77, { id: 4, role: "DIOCESE_COORDINATOR" });
    assert.equal(coordinatorView.id, 77);
  } finally {
    prisma.dailyReport.findUnique = originalFindUnique;
  }
});

test("mandatory email templates escape all user-controlled HTML", () => {
  const malicious = '<img src=x onerror="alert(1)">';
  for (const emailType of [
    "DOCUMENT_READY_FOR_PICKUP",
    "SCHEDULE_SUBMITTED",
    "SCHEDULE_PROPOSED_RESCHEDULE",
    "SCHEDULE_CONFIRMED",
  ]) {
    const message = renderEmail(emailType, {
      recipientName: malicious,
      parishName: malicious,
      trackingNumber: malicious,
      documentType: malicious,
      serviceLabel: malicious,
      requestedDate: "2026-08-29",
      proposedDate: "2026-08-30",
      timeSlot: malicious,
      location: malicious,
    });
    assert.equal(message.html.includes("<img"), false);
    assert.equal(message.html.includes("&lt;img"), true);
    assert.ok(message.subject.length > 0);
    assert.ok(message.text.length > 0);
  }
});

test("email transition keys deduplicate one proposal but preserve later proposals", async () => {
  const keys = [];
  const client = {
    emailOutbox: {
      upsert: async (query) => {
        keys.push(query.create.transitionKey);
        return query.create;
      },
    },
  };
  const schedule = {
    id: 42,
    status: "PROPOSED_RESCHEDULE",
    proposalVersion: 1,
    eventType: "BAPTISM",
    requestedDate: new Date("2026-09-01T00:00:00.000Z"),
    proposedDate: new Date("2026-09-02T00:00:00.000Z"),
    proposedStartDatetime: new Date("2026-09-02T01:00:00.000Z"),
    user: { fullName: "Parishioner", email: "person@example.org" },
    parish: { parishName: "Sample Parish" },
  };
  await EmailOutboxService.enqueueScheduleTransition(schedule, "REQUESTED", "one", client);
  await EmailOutboxService.enqueueScheduleTransition(schedule, "REQUESTED", "duplicate", client);
  await EmailOutboxService.enqueueScheduleTransition({ ...schedule, proposalVersion: 2 }, "PROPOSED_RESCHEDULE", "two", client);
  assert.deepEqual(keys, [
    "schedule:42:proposal:1",
    "schedule:42:proposal:1",
    "schedule:42:proposal:2",
  ]);
});
