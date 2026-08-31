import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../config/db.js";
import { ParishEventService } from "../services/ParishEventService.js";

test("public month feed preserves month bounds, visibility, Mass end times, and WEEKDAY fallback semantics", async () => {
  const originalEvents = prisma.parishEvent.findMany;
  const originalTemplates = prisma.massScheduleTemplate.findMany;
  const originalUsers = prisma.user.findMany;
  let observedWhere;

  prisma.parishEvent.findMany = async ({ where }) => {
    observedWhere = where;
    return [{
      id: 1,
      parishId: 9,
      title: "Public activity",
      eventType: "OTHER",
      description: null,
      location: null,
      eventDate: new Date("2026-08-20T00:00:00.000Z"),
      startTime: "08:00 AM",
      endTime: "09:00 AM",
      visibility: "PUBLIC",
      parish: { id: 9, parishName: "Sample Parish" },
    }];
  };
  prisma.massScheduleTemplate.findMany = async () => [{
    id: 10,
    parishId: 9,
    dayType: "WEEKDAY",
    timeSlot: "10:00 AM",
    label: "Weekday Mass",
    assignedPriestId: null,
    parish: { id: 9, parishName: "Sample Parish" },
    assignedPriest: null,
  }];
  prisma.user.findMany = async () => [];

  try {
    const events = await new ParishEventService().getPublicEvents("2026", "8");
    const masses = events.filter((event) => String(event.id).startsWith("mass-t-"));

    assert.equal(observedWhere.visibility, "PUBLIC");
    assert.equal(observedWhere.eventDate.gte.toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(observedWhere.eventDate.lt.toISOString(), "2026-09-01T00:00:00.000Z");
    assert.ok(events.some((event) => event.title === "Public activity"));
    assert.ok(masses.length > 0);
    assert.ok(masses.every((event) => event.startTime === "10:00 AM" && event.endTime === "11:00 AM"));
    assert.ok(masses.every((event) => /mass-t-10-2026-08-\d{2}/.test(String(event.id))));
    assert.ok(masses.every((event) => {
      const weekday = new Date(event.eventDate).getUTCDay();
      return weekday === 3 || weekday === 5;
    }));
  } finally {
    prisma.parishEvent.findMany = originalEvents;
    prisma.massScheduleTemplate.findMany = originalTemplates;
    prisma.user.findMany = originalUsers;
  }
});