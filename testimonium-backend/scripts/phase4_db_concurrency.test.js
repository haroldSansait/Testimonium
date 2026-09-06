import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  isDisposableDatabaseConfigured,
  getDisposablePrismaClient,
} from "../test-utils/disposableDbGuard.js";
import { PriestPersonalScheduleService } from "../services/PriestPersonalScheduleService.js";
import { ScheduleService } from "../services/ScheduleService.js";
import { ParishEventService } from "../services/ParishEventService.js";
import { MassScheduleService } from "../services/MassScheduleService.js";
import { ParishAvailabilityService } from "../services/ParishAvailabilityService.js";
import { ParishService } from "../services/ParishService.js";

/**
 * Real PostgreSQL Concurrency & Lock Discipline Suite
 *
 * SAFETY GUARD:
 * This suite executes ONLY when an isolated, dedicated DISPOSABLE_DATABASE_URL is provided.
 * It will NEVER run against shared Supabase.
 */

test("Phase 4 Real PostgreSQL Concurrency & Transaction Serialization Suite", async (t) => {
  if (!isDisposableDatabaseConfigured()) {
    console.log(
      "\n[DISPOSABLE DB GUARD: NOT RUN] " +
      "REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE: " +
      "No DISPOSABLE_DATABASE_URL configured. Shared database execution strictly forbidden.\n"
    );
    t.skip("REFUSING TO RUN DB INTEGRATION TEST WITHOUT DISPOSABLE DATABASE");
    return;
  }

  const { prisma } = getDisposablePrismaClient();

  const personalService = new PriestPersonalScheduleService();
  const scheduleService = new ScheduleService();
  const eventService = new ParishEventService();
  const massService = new MassScheduleService();
  const parishService = new ParishService();

  const createdParishIds = [];
  const createdUserIds = [];
  const createdPersonalIds = [];
  const createdScheduleIds = [];
  const createdEventIds = [];
  const createdTemplateIds = [];
  const createdAvailabilityIds = [];

  try {
    // Setup test parish and priest in disposable database
    const parish = await prisma.parish.create({
      data: {
        parishName: `Disposable Concurrency Parish ${crypto.randomUUID().slice(0, 8)}`,
        slug: `disp-parish-${crypto.randomUUID().slice(0, 8)}`,
        type: "PARISH",
        diocese: "Novichesky",
        vicariate: "Vicariate I",
        cityMunicipality: "Quezon City",
        province: "Metro Manila",
        fullAddress: "123 Test St",
        schedulingConfigVersion: 1,
      },
    });
    createdParishIds.push(parish.id);

    const priestRole = await prisma.role.findFirst({ where: { roleName: "PRIEST" } });
    const priestUser = await prisma.user.create({
      data: {
        email: `priest-concurrent-${crypto.randomUUID().slice(0, 8)}@example.com`,
        fullName: "Fr. Concurrency Tester",
        roleId: priestRole.id,
        parishId: parish.id,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(priestUser.id);

    const parishionerRole = await prisma.role.findFirst({ where: { roleName: "PARISHIONER" } });
    const parishionerUser = await prisma.user.create({
      data: {
        email: `parishioner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        fullName: "Parishioner Tester",
        roleId: parishionerRole.id,
        status: "ACTIVE",
      },
    });
    createdUserIds.push(parishionerUser.id);

    // ========================================================================
    // A. Personal CREATE vs Personal CREATE (same priest, same overlapping interval)
    // ========================================================================
    await t.test("A. Personal CREATE vs Personal CREATE: exactly one succeeds", async () => {
      const startAt = "2026-11-10T10:00:00.000+08:00";
      const endAt = "2026-11-10T11:00:00.000+08:00";

      const results = await Promise.allSettled([
        personalService.create(priestUser.id, {
          title: "Personal Commitment A1",
          startAt,
          endAt,
        }),
        personalService.create(priestUser.id, {
          title: "Personal Commitment A2",
          startAt,
          endAt,
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one concurrent personal commitment must succeed");
      assert.equal(rejected.length, 1, "Conflicting concurrent personal commitment must be rejected");
      assert.match(rejected[0].reason.message, /conflict|unavailable/i);
      createdPersonalIds.push(fulfilled[0].value.id);
    });

    // ========================================================================
    // B. Schedule Assignment vs Personal CREATE
    // ========================================================================
    await t.test("B. Schedule Assignment vs Personal CREATE: exactly one succeeds", async () => {
      const schedule = await prisma.schedule.create({
        data: {
          parishId: parish.id,
          userId: parishionerUser.id,
          eventType: "BAPTISM",
          requestedDate: new Date("2026-11-11T00:00:00.000Z"),
          startDatetime: new Date("2026-11-11T14:00:00.000+08:00"),
          endDatetime: new Date("2026-11-11T15:00:00.000+08:00"),
          status: "PENDING",
          version: 1,
        },
      });
      createdScheduleIds.push(schedule.id);

      const results = await Promise.allSettled([
        scheduleService.assignPriest(
          schedule.id,
          priestUser.id,
          priestUser.id,
          "DIOCESE_COORDINATOR",
          parish.id,
          1
        ),
        personalService.create(priestUser.id, {
          title: "Personal Commitment B",
          startAt: "2026-11-11T14:30:00.000+08:00",
          endAt: "2026-11-11T15:30:00.000+08:00",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one conflicting commitment must succeed");
      assert.equal(rejected.length, 1, "The loser must be rejected due to conflict or version");
      if (fulfilled[0].value?.title === "Personal Commitment B") {
        createdPersonalIds.push(fulfilled[0].value.id);
      }
    });

    // ========================================================================
    // C. Priest ACCEPT vs Personal CREATE
    // ========================================================================
    await t.test("C. Priest ACCEPT vs Personal CREATE: exactly one succeeds", async () => {
      const schedule = await prisma.schedule.create({
        data: {
          parishId: parish.id,
          userId: parishionerUser.id,
          assignedPriestId: priestUser.id,
          eventType: "WEDDING",
          requestedDate: new Date("2026-11-12T00:00:00.000Z"),
          startDatetime: new Date("2026-11-12T09:00:00.000+08:00"),
          endDatetime: new Date("2026-11-12T10:30:00.000+08:00"),
          status: "PENDING",
          priestResponseStatus: "PENDING",
          version: 1,
        },
      });
      createdScheduleIds.push(schedule.id);

      const results = await Promise.allSettled([
        scheduleService.respondPriestAssignment(
          schedule.id,
          priestUser.id,
          "ACCEPTED",
          "Confirmed availability",
          1
        ),
        personalService.create(priestUser.id, {
          title: "Personal Commitment C",
          startAt: "2026-11-12T09:30:00.000+08:00",
          endAt: "2026-11-12T10:15:00.000+08:00",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one concurrent operation must succeed");
      assert.equal(rejected.length, 1, "Competing operation must be rejected");
      if (fulfilled[0].value?.title === "Personal Commitment C") {
        createdPersonalIds.push(fulfilled[0].value.id);
      }
    });

    // ========================================================================
    // D. Emergency Reschedule vs Personal CREATE
    // ========================================================================
    await t.test("D. Emergency Reschedule vs Personal CREATE: exactly one succeeds", async () => {
      const schedule = await prisma.schedule.create({
        data: {
          parishId: parish.id,
          userId: parishionerUser.id,
          assignedPriestId: priestUser.id,
          eventType: "BAPTISM",
          requestedDate: new Date("2026-11-13T00:00:00.000Z"),
          startDatetime: new Date("2026-11-13T08:00:00.000+08:00"),
          endDatetime: new Date("2026-11-13T09:00:00.000+08:00"),
          status: "CONFIRMED",
          priestResponseStatus: "ACCEPTED",
          version: 1,
        },
      });
      createdScheduleIds.push(schedule.id);

      const results = await Promise.allSettled([
        scheduleService.emergencyReschedule(
          schedule.id,
          {
            targetDate: "2026-11-13",
            timeSlot: "11:00 AM",
            reason: "Parish flood maintenance emergency",
          },
          priestUser.id,
          "DIOCESE_COORDINATOR",
          parish.id,
          1
        ),
        personalService.create(priestUser.id, {
          title: "Personal Commitment D",
          startAt: "2026-11-13T11:00:00.000+08:00",
          endAt: "2026-11-13T12:00:00.000+08:00",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one must succeed in emergency conflict race");
      assert.equal(rejected.length, 1, "Competitor must be rejected");
      if (fulfilled[0].value?.title === "Personal Commitment D") {
        createdPersonalIds.push(fulfilled[0].value.id);
      }
    });

    // ========================================================================
    // E. ParishEvent mutation vs Personal CREATE
    // ========================================================================
    await t.test("E. ParishEvent mutation vs Personal CREATE: exactly one succeeds", async () => {
      const results = await Promise.allSettled([
        eventService.createEvent(
          parish.id,
          {
            title: "Feast Day Solemn Mass",
            eventDate: "2026-11-14",
            startTime: "04:00 PM",
            endTime: "05:30 PM",
            assignedPriestId: priestUser.id,
          },
          priestUser.id
        ),
        personalService.create(priestUser.id, {
          title: "Personal Commitment E",
          startAt: "2026-11-14T16:15:00.000+08:00",
          endAt: "2026-11-14T17:00:00.000+08:00",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one commitment must succeed");
      assert.equal(rejected.length, 1, "Conflict must reject second commitment");
      if (fulfilled[0].value?.title === "Feast Day Solemn Mass") {
        createdEventIds.push(fulfilled[0].value.id);
      } else {
        createdPersonalIds.push(fulfilled[0].value.id);
      }
    });

    // ========================================================================
    // F. Mass mutation/upsert vs Personal CREATE
    // ========================================================================
    await t.test("F. Mass mutation/upsert vs Personal CREATE: exactly one succeeds", async () => {
      // 2026-11-15 is Sunday
      const results = await Promise.allSettled([
        massService.upsertTemplate(parish.id, {
          dayType: "SUNDAY",
          timeSlot: "07:00 AM",
          label: "Sunday Morning Service",
          assignedPriestId: priestUser.id,
          actorId: priestUser.id,
        }),
        personalService.create(priestUser.id, {
          title: "Personal Commitment F",
          startAt: "2026-11-15T07:15:00.000+08:00",
          endAt: "2026-11-15T08:00:00.000+08:00",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one must succeed between Mass template and Personal schedule");
      assert.equal(rejected.length, 1, "Competitor must be rejected");
      if (fulfilled[0].value?.dayType === "SUNDAY") {
        createdTemplateIds.push(fulfilled[0].value.id);
      } else {
        createdPersonalIds.push(fulfilled[0].value.id);
      }
    });

    // ========================================================================
    // G. PRIEST_LEAVE vs Personal CREATE
    // ========================================================================
    await t.test("G. PRIEST_LEAVE vs Personal CREATE: conflicting availability handled deterministically", async () => {
      const results = await Promise.allSettled([
        parishAvailabilityService.createAvailability(
          {
            parishId: parish.id,
            userId: priestUser.id,
            type: "PRIEST_LEAVE",
            startDate: "2026-11-16",
            endDate: "2026-11-18",
            title: "Annual Retreat",
          },
          priestUser.id
        ),
        personalService.create(priestUser.id, {
          title: "Personal Commitment G",
          startAt: "2026-11-17T10:00:00.000+08:00",
          endAt: "2026-11-17T11:00:00.000+08:00",
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      assert.equal(fulfilled.length, 1, "Exactly one conflicting availability mutation must win");
      assert.equal(rejected.length, 1, "Conflict must fail closed");
      if (fulfilled[0].value?.type === "PRIEST_LEAVE") {
        createdAvailabilityIds.push(fulfilled[0].value.id);
      } else {
        createdPersonalIds.push(fulfilled[0].value.id);
      }
    });

    // ========================================================================
    // 30. DEADLOCK / LOCK ORDER DB TEST
    // ========================================================================
    await t.test("30. Multi-Resource Lock Order Test: Mass mutation vs Mixed Parish Edit does not deadlock", async () => {
      // Both operations touch parish AND priest resources concurrently.
      // Canonical lock order is PARISH -> PRIEST.
      // If ordering were inverted (PRIEST -> PARISH vs PARISH -> PRIEST), PostgreSQL would raise deadlock (40P01).
      const results = await Promise.allSettled([
        massService.upsertTemplate(parish.id, {
          dayType: "SUNDAY",
          timeSlot: "09:00 AM",
          label: "Sunday High Mass",
          assignedPriestId: priestUser.id,
          actorId: priestUser.id,
        }),
        parishService.editParish(
          parish.id,
          {
            priestId: priestUser.id,
            officeHours: "Mon-Sat 8:00 AM - 5:00 PM",
            schedulingConfigVersion: 1,
          },
          priestUser.id,
          1
        ),
      ]);

      for (const res of results) {
        if (res.status === "rejected") {
          assert.notEqual(
            res.reason?.code,
            "40P01",
            "Must NEVER trigger PostgreSQL deadlock (40P01) due to lock order inversion"
          );
        }
      }
    });
  } finally {
    // -------------------------------------------------------------
    // Comprehensive Disposable Database Cleanup
    // -------------------------------------------------------------
    try {
      if (createdPersonalIds.length) {
        await prisma.priestPersonalSchedule.deleteMany({
          where: { id: { in: createdPersonalIds } },
        });
      }
      if (createdAvailabilityIds.length) {
        await prisma.parishAvailability.deleteMany({
          where: { id: { in: createdAvailabilityIds } },
        });
      }
      if (createdEventIds.length) {
        await prisma.parishEvent.deleteMany({
          where: { id: { in: createdEventIds } },
        });
      }
      if (createdTemplateIds.length) {
        await prisma.massScheduleTemplate.deleteMany({
          where: { id: { in: createdTemplateIds } },
        });
      }
      if (createdScheduleIds.length) {
        await prisma.scheduleHistory.deleteMany({
          where: { scheduleId: { in: createdScheduleIds } },
        });
        await prisma.schedule.deleteMany({
          where: { id: { in: createdScheduleIds } },
        });
      }
      if (createdUserIds.length) {
        await prisma.activityLog.deleteMany({
          where: { actorId: { in: createdUserIds } },
        });
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      }
      if (createdParishIds.length) {
        await prisma.parishCouncilConfiguration.deleteMany({
          where: { parishId: { in: createdParishIds } },
        });
        await prisma.parish.deleteMany({
          where: { id: { in: createdParishIds } },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  }
});
