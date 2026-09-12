import test from "node:test";
import assert from "node:assert/strict";
import { formatClergyName, humanizeParishType } from "../services/ai/liveTools/enumFormatters.js";
import { TOOL_IDS } from "../services/ai/liveTools/liveToolSchemas.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";
import { LiveToolRouter } from "../services/ai/liveTools/LiveToolRouter.js";
import { FakeSemanticRouter } from "../services/ai/FakeSemanticRouter.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { ConversationContextManager } from "../services/ai/ConversationContextManager.js";
import { ScheduleService } from "../services/ScheduleService.js";
import { prisma } from "../config/db.js";
import {
  resolveManilaDate,
  resolveScheduleEventType,
  resolveManilaTimeSlot,
  extractTimeSlotFromText,
  extractPriestReference,
} from "../services/ai/semanticValidationHelper.js";

test("Caloy Scheduling Intelligence & Live Directory Correction Pass", async (t) => {
  // =========================================================================
  // Test 1: Clergy Name Formatter (Section 35 & 56)
  // =========================================================================
  await t.test("Clergy Formatter prevents duplicate honorifics and produces exactly one title", () => {
    // 1. Duplicate title: "Fr. Rev. Fr. Julius L. Montaño"
    const duplicate1 = formatClergyName("Fr. Rev. Fr. Julius L. Montaño");
    assert.equal(duplicate1, "Rev. Fr. Julius L. Montaño", "Must remove duplicate 'Fr. Rev. Fr.'");

    // 2. Another duplicate variant: "Rev. Fr. Fr. Pedro Santos"
    const duplicate2 = formatClergyName("Rev. Fr. Fr. Pedro Santos");
    assert.equal(duplicate2, "Rev. Fr. Pedro Santos", "Must normalize multi-prefix to single title");

    // 3. Stored with single title: "Rev. Fr. Julius L. Montaño"
    const single1 = formatClergyName("Rev. Fr. Julius L. Montaño");
    assert.equal(single1, "Rev. Fr. Julius L. Montaño", "Preserves single Rev. Fr.");

    // 4. Stored with Fr.: "Fr. Pedro Santos"
    const single2 = formatClergyName("Fr. Pedro Santos");
    assert.equal(single2, "Fr. Pedro Santos", "Preserves single Fr.");

    // 5. Stored without title: "Julius L. Montaño"
    const noTitle = formatClergyName("Julius L. Montaño");
    assert.equal(noTitle, "Fr. Julius L. Montaño", "Adds default Fr. title once");

    // 6. Monsignor / Bishop
    assert.equal(formatClergyName("Msgr. Juan Dela Cruz"), "Msgr. Juan Dela Cruz");
    assert.equal(formatClergyName("Most Rev. Patricio Buzon"), "Most Rev. Patricio Buzon");
  });

  // =========================================================================
  // Test 2: False No-Slot Bug Fix & Authoritative Scheduling Reuse (Sections 5, 47, 48)
  // =========================================================================
  await t.test("False No-Slot Bug Fix: string slots from ScheduleService are correctly parsed and returned", async () => {
    let getAvailableSlotsCalled = false;
    let receivedParishId = null;
    let receivedDate = null;
    let receivedEventType = null;

    // Mock canonical ScheduleService
    const mockScheduleService = {
      getAvailableSlots: async (parishId, date, eventType) => {
        getAvailableSlotsCalled = true;
        receivedParishId = parishId;
        receivedDate = date;
        receivedEventType = eventType;
        // ScheduleService.getAvailableSlots canonically returns string array!
        return ["08:00 AM", "10:00 AM", "01:30 PM", "03:30 PM"];
      },
    };

    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
          contactNumber: "0917-111-2222",
          email: "stjoseph@test.com",
        }),
      },
    };

    const registry = new LiveToolRegistry({
      prismaClient: mockPrisma,
      scheduleService: mockScheduleService,
    });

    const result = await registry.getCalendarSlotAvailability({
      parishId: 1,
      eventType: "WEDDING",
      date: "2026-09-14",
    });

    assert.ok(getAvailableSlotsCalled, "Must call ScheduleService.getAvailableSlots");
    assert.equal(receivedParishId, 1);
    assert.equal(receivedDate, "2026-09-14");
    assert.equal(receivedEventType, "WEDDING");

    // Must NOT say "No available slots"
    assert.ok(result.answer.includes("St. Joseph Parish"), "Must mention parish");
    assert.ok(result.answer.includes("available appointment slots"), "Must acknowledge available slots");
    assert.ok(result.answer.includes("08:00 AM"));
    assert.ok(result.answer.includes("10:00 AM"));
    assert.ok(result.answer.includes("01:30 PM"));
    assert.ok(result.answer.includes("03:30 PM"));
    assert.equal(result.liveData.slots.length, 4);
    assert.equal(result.liveData.totalAvailable, 4);
  });

  // =========================================================================
  // Test 3: Specific Time Slot Availability & Safe Alternatives (Sections 9, 49)
  // =========================================================================
  await t.test("Specific Time Check: evaluates requested time slot and offers safe alternatives when unavailable", async () => {
    const mockScheduleService = {
      getAvailableSlots: async () => ["09:00 AM", "10:30 AM", "01:00 PM", "03:00 PM"],
    };

    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
        }),
      },
    };

    const registry = new LiveToolRegistry({
      prismaClient: mockPrisma,
      scheduleService: mockScheduleService,
    });

    // Case A: 10:30 AM is available
    const availResult = await registry.getCalendarSlotAvailability({
      parishId: 1,
      eventType: "WEDDING",
      date: "2026-09-14",
      timeSlot: "10:30 AM",
    });

    assert.equal(availResult.liveData.isAvailable, true);
    assert.ok(availResult.answer.includes("available"));
    assert.ok(availResult.answer.includes("10:30 AM"));

    // Case B: 2:00 PM is NOT available -> returns UNAVAILABLE with safe alternatives
    const unavailResult = await registry.getCalendarSlotAvailability({
      parishId: 1,
      eventType: "WEDDING",
      date: "2026-09-14",
      timeSlot: "2:00 PM",
    });

    assert.equal(unavailResult.liveData.isAvailable, false);
    assert.ok(unavailResult.answer.includes("unavailable"));
    assert.ok(unavailResult.answer.includes("Available alternative times"));
    assert.ok(unavailResult.answer.includes("09:00 AM"));
    assert.ok(unavailResult.answer.includes("01:00 PM"));
  });

  // =========================================================================
  // Test 4: Privacy Invariant in Calendar Availability & Conflicts (Sections 10, 11, 43, 58)
  // =========================================================================
  await t.test("Privacy: unavailable slot response NEVER leaks other parishioners' names, tracking numbers, or private details", async () => {
    const mockScheduleService = {
      getAvailableSlots: async () => ["09:00 AM", "11:00 AM"],
    };

    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
        }),
      },
    };

    const registry = new LiveToolRegistry({
      prismaClient: mockPrisma,
      scheduleService: mockScheduleService,
    });

    const result = await registry.getCalendarSlotAvailability({
      parishId: 1,
      eventType: "WEDDING",
      date: "2026-09-14",
      timeSlot: "2:00 PM",
    });

    const answerLower = result.answer.toLowerCase();
    assert.ok(!answerLower.includes("juan dela cruz"), "Must not leak parishioner name");
    assert.ok(!answerLower.includes("tracking"), "Must not leak tracking number");
    assert.ok(!answerLower.includes("sr-"), "Must not leak reference number");
    assert.ok(!answerLower.includes("conflict with"), "Must not expose conflicting booking details");
  });

  // =========================================================================
  // Test 5: Priest Availability & Conflict Engine Integration (Sections 12, 14, 15, 50)
  // =========================================================================
  await t.test("Priest Availability: checks active clergy, evaluates conflicts, and hides conflict reasons", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
        }),
      },
      user: {
        findMany: async () => [
          {
            id: 101,
            fullName: "Rev. Fr. Julius L. Montaño",
            isAssistant: false,
          },
          {
            id: 102,
            fullName: "Rev. Fr. Pedro Santos",
            isAssistant: true,
          },
        ],
      },
      parishAvailability: {
        findMany: async () => [],
      },
      parishEvent: {
        findMany: async () => [],
      },
      massScheduleTemplate: {
        findMany: async () => [],
      },
      priestPersonalSchedule: {
        findMany: async () => [],
      },
      schedule: {
        // Fr. Julius (101) has an appointment at 2:00 PM on 2026-09-14
        findMany: async ({ where }) => {
          if (where.assignedPriestId === 101) {
            return [
              {
                id: 999,
                trackingNumber: "SR-2026-CONFIDENTIAL",
                applicantName: "Confidential Parishioner",
                status: "CONFIRMED",
                eventType: "WEDDING",
                startDatetime: new Date("2026-09-14T14:00:00+08:00"),
                operationalEndDatetime: new Date("2026-09-14T15:30:00+08:00"),
              },
            ];
          }
          return [];
        },
      },
    };

    const mockScheduleService = {
      getAvailableSlots: async () => ["10:00 AM", "02:00 PM", "03:30 PM"],
    };

    const registry = new LiveToolRegistry({
      prismaClient: mockPrisma,
      scheduleService: mockScheduleService,
    });

    // Fr. Julius at 2:00 PM -> Conflict!
    const conflictResult = await registry.checkPriestAvailability({
      parishId: 1,
      priestName: "Fr. Julius",
      date: "2026-09-14",
      timeSlot: "2:00 PM",
      eventType: "WEDDING",
    });

    assert.equal(conflictResult.liveData.isAvailable, false);
    assert.ok(conflictResult.answer.includes("not available") && conflictResult.answer.includes("2:00 PM"));
    assert.ok(!conflictResult.answer.toLowerCase().includes("confidential parishioner"));
    assert.ok(!conflictResult.answer.includes("SR-2026-CONFIDENTIAL"));

    // Fr. Pedro (102) at 2:00 PM -> Free!
    const freeResult = await registry.checkPriestAvailability({
      parishId: 1,
      priestName: "Fr. Pedro",
      date: "2026-09-14",
      timeSlot: "2:00 PM",
      eventType: "WEDDING",
    });

    assert.equal(freeResult.liveData.isAvailable, true);
    assert.ok(freeResult.answer.includes("currently **available**"));
    assert.ok(freeResult.answer.includes("Rev. Fr. Pedro Santos"));
  });

  // =========================================================================
  // Test 6: Available Priests for Slot (Sections 16, 50)
  // =========================================================================
  await t.test("Available Priests for Slot: returns only eligible clergy who are free at the requested time", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
        }),
      },
      user: {
        findMany: async () => [
          {
            id: 101,
            fullName: "Rev. Fr. Julius L. Montaño",
            isAssistant: false,
          },
          {
            id: 102,
            fullName: "Rev. Fr. Pedro Santos",
            isAssistant: true,
          },
        ],
      },
      parishAvailability: {
        findMany: async () => [],
      },
      parishEvent: {
        findMany: async () => [],
      },
      massScheduleTemplate: {
        findMany: async () => [],
      },
      priestPersonalSchedule: {
        findMany: async () => [],
      },
      schedule: {
        findMany: async ({ where }) => {
          // Fr. Julius is busy at 2:00 PM
          if (where.assignedPriestId === 101) {
            return [
              {
                id: 999,
                status: "CONFIRMED",
                startDatetime: new Date("2026-09-14T14:00:00+08:00"),
                operationalEndDatetime: new Date("2026-09-14T15:30:00+08:00"),
              },
            ];
          }
          return [];
        },
      },
    };

    const mockScheduleService = {
      getAvailableSlots: async () => ["02:00 PM"],
    };

    const registry = new LiveToolRegistry({
      prismaClient: mockPrisma,
      scheduleService: mockScheduleService,
    });

    const result = await registry.getAvailablePriestsForSlot({
      parishId: 1,
      date: "2026-09-14",
      timeSlot: "2:00 PM",
      eventType: "WEDDING",
    });

    assert.equal(result.liveData.availablePriests.length, 1);
    assert.equal(result.liveData.availablePriests[0].name, "Rev. Fr. Pedro Santos");
    assert.ok(result.answer.includes("Rev. Fr. Pedro Santos"));
    assert.ok(!result.answer.includes("Rev. Fr. Julius L. Montaño"));
  });

  // =========================================================================
  // Test 7: Priest Eligibility Filtering (Section 51)
  // =========================================================================
  await t.test("Priest Eligibility: filters out inactive priests and unassigned priests", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
        }),
      },
      user: {
        findMany: async ({ where }) => {
          assert.equal(where.status, "ACTIVE", "Must strictly filter for ACTIVE status");
          return [
            {
              id: 101,
              fullName: "Rev. Fr. Active Priest",
              isAssistant: false,
            },
          ];
        },
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: mockPrisma });
    const result = await registry.getActiveParishPriests({ parishId: 1 });

    assert.ok(result.answer.includes("Rev. Fr. Active Priest"));
    assert.ok(!result.answer.includes("Rev. Fr. Inactive Priest"), "Inactive priest must be excluded");
  });

  // =========================================================================
  // Test 8: Active Parishes Directory Tool (Sections 20, 21, 52)
  // =========================================================================
  await t.test("GET_ACTIVE_PARISHES: returns active parishes, quasi-parishes, and mission stations, excluding inactive", async () => {
    const mockPrisma = {
      parish: {
        findMany: async ({ where }) => {
          assert.equal(where.isActive, true, "Must strictly query isActive: true");
          return [
            { id: 1, parishName: "St. Joseph Parish", type: "PARISH", municipalityCity: "Manila", province: "Metro Manila" },
            { id: 2, parishName: "San Roque Quasi-Parish", type: "QUASI_PARISH", municipalityCity: "Quezon City", province: "Metro Manila" },
            { id: 3, parishName: "Holy Family Mission Station", type: "MISSION_STATION", municipalityCity: "Caloocan", province: "Metro Manila" },
          ];
        },
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: mockPrisma });
    const result = await registry.getActiveParishes();

    assert.ok(result.answer.includes("St. Joseph Parish") && result.answer.includes("Parish"));
    assert.ok(result.answer.includes("San Roque Quasi-Parish") && result.answer.includes("Quasi-Parish"));
    assert.ok(result.answer.includes("Holy Family Mission Station") && result.answer.includes("Mission Station"));
    assert.equal(result.liveData.parishes.length, 3);
  });

  // =========================================================================
  // Test 9: Active Parishes Semantic Wording (Section 53)
  // =========================================================================
  await t.test("Parish Directory Semantic Router: natural language queries resolve to GET_ACTIVE_PARISHES", () => {
    const fakeRouter = new FakeSemanticRouter();

    const directoryQueries = [
      "What parishes are part of Testimonium?",
      "Which churches can I select?",
      "Show me the parishes in the system",
      "What are the parishes present in Testimonium?",
      "Can you show me all member parishes?",
    ];

    for (const query of directoryQueries) {
      const result = fakeRouter._inferDefaultInterpretation(query);
      assert.equal(result.route, "LIVE_TOOL", `Query "${query}" must route to LIVE_TOOL`);
      assert.equal(result.intent, TOOL_IDS.GET_ACTIVE_PARISHES, `Query "${query}" must have intent GET_ACTIVE_PARISHES`);
    }
  });

  // =========================================================================
  // Test 10: Payment Verification RAG Pipeline & Preservation of Question (Sections 30, 31, 32, 54)
  // =========================================================================
  await t.test("Payment Verification RAG: question is preserved without distortion, DIOCESE scope included", async () => {
    let queryPassedToRetrieval = null;
    let selectedParishIdPassed = null;

    const mockRetrievalService = {
      retrieveKnowledge: async ({ normalizedQuestion, selectedParishId }) => {
        queryPassedToRetrieval = normalizedQuestion;
        selectedParishIdPassed = selectedParishId;
        return {
          candidates: [
            {
              chunkId: 50,
              sourceId: 10,
              title: "Payment Verification Guidelines",
              content: "Payment verification requires uploading a valid GCash or bank transfer receipt. Parish staff reviews the reference number.",
              semanticScore: 0.88,
              scope: "DIOCESE",
            },
          ],
          hasSufficientEvidence: true,
          category: "PROCEDURE",
          embeddingProvider: "gemini",
          embeddingModel: "gemini-embedding-2",
        };
      },
    };

    const mockChatProvider = {
      providerName: "fake",
      modelName: "gemini-3.5-flash-lite",
      generateGroundedAnswer: async () => ({
        answer: "To verify payment, upload your payment receipt or reference number via the portal for staff review.",
        citedChunkIds: [50],
      }),
    };

    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
        }),
      },
    };

    const mockSemanticRouter = {
      interpret: async () => ({
        route: "RAG",
        intent: null,
        entities: { parishName: null, documentType: null, scheduleEvent: null, datePhrase: null, trackingNumberPresent: false },
        usesPreviousContext: false,
      }),
    };

    const service = new ChatbotService({
      retrievalService: mockRetrievalService,
      chatProvider: mockChatProvider,
      semanticRouter: mockSemanticRouter,
      prismaClient: mockPrisma,
      logRepository: { logQuery: async () => {} },
    });

    const userQuestion = "How does payment verification works?";
    const response = await service.handleQuery({
      question: userQuestion,
      selectedParishId: 1, // Parish selected in UI
    });

    assert.equal(queryPassedToRetrieval, userQuestion, "Must preserve original normalized question for embedding");
    assert.equal(selectedParishIdPassed, 1, "Selected parish must be forwarded");
    assert.equal(response.responseType, "RAG");
    assert.equal(response.fallback, false);
    assert.ok(response.answer.includes("payment receipt"));
    assert.ok(response.diagnostics, "Must provide safe internal diagnostic metadata");
    assert.equal(response.diagnostics.hasSufficientEvidence, true);
    assert.deepEqual(response.diagnostics.retrievedChunkIds, [50]);
  });

  // =========================================================================
  // Test 11: Topic Change Hygiene (Sections 55)
  // =========================================================================
  await t.test("Topic Change: switching from scheduling to payment verification clears scheduling context", async () => {
    const contextManager = new ConversationContextManager();
    const sessionId = "test-session-topic-change";

    // Turn 1: Scheduling inquiry creates scheduling context
    contextManager.updateContext(sessionId, {
      lastIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      lastParishId: 1,
      lastParishName: "St. Joseph Parish",
      lastScheduleEvent: "WEDDING",
      lastDatePhrase: "Monday",
      lastTimePhrase: "2:00 PM",
      lastResponseType: "LIVE_DATA",
    });

    const turn1Ctx = contextManager.getContext(sessionId);
    assert.equal(turn1Ctx.lastScheduleEvent, "WEDDING");
    assert.equal(turn1Ctx.lastDatePhrase, "Monday");

    const fakeRouter = new FakeSemanticRouter();

    // Turn 2: General procedural question
    const interpretation = fakeRouter._inferDefaultInterpretation("How does payment verification work?", turn1Ctx);
    assert.equal(interpretation.route, "RAG");
    assert.equal(interpretation.usesPreviousContext, false, "Topic change must not use previous scheduling context");

    // ChatbotService handles Turn 2
    const mockRetrievalService = {
      retrieveKnowledge: async () => ({
        candidates: [{ chunkId: 1, sourceId: 1, title: "Payment", content: "Payment guide", semanticScore: 0.85 }],
        hasSufficientEvidence: true,
        category: "PROCEDURE",
      }),
    };

    const mockChatProvider = {
      providerName: "fake",
      modelName: "gemini-3.5-flash-lite",
      generateGroundedAnswer: async () => ({
        answer: "Staff verifies GCash payments through the admin portal.",
        citedChunkIds: [1],
      }),
    };

    const service = new ChatbotService({
      retrievalService: mockRetrievalService,
      chatProvider: mockChatProvider,
      semanticRouter: fakeRouter,
      contextManager,
      logRepository: { logQuery: async () => {} },
      prismaClient: { parish: { findUnique: async () => ({ id: 1, parishName: "St. Joseph Parish", isActive: true }) } },
    });

    await service.handleQuery({
      question: "How does payment verification work?",
      sessionId,
      selectedParishId: 1,
    });

    const turn2Ctx = contextManager.getContext(sessionId);
    assert.equal(turn2Ctx.lastIntent, null, "lastIntent must be cleared on RAG route");
    assert.equal(turn2Ctx.lastScheduleEvent, null, "lastScheduleEvent must be cleared");
    assert.equal(turn2Ctx.lastDatePhrase, null, "lastDatePhrase must be cleared");
    assert.equal(turn2Ctx.lastTimePhrase, null, "lastTimePhrase must be cleared");
  });

  // =========================================================================
  // Test 12: Contextual Follow-up for Priest Availability (Section 57)
  // =========================================================================
  await t.test("Contextual Follow-up: inherits parish, event type, and date from prior turn", async () => {
    const contextManager = new ConversationContextManager();
    const sessionId = "test-session-followup";

    // Turn 1 context
    const priorContext = {
      lastIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      lastParishId: 1,
      lastParishName: "St. Joseph Parish",
      lastScheduleEvent: "WEDDING",
      lastDatePhrase: "Monday",
      lastResponseType: "LIVE_DATA",
    };

    const fakeRouter = new FakeSemanticRouter();
    // Turn 2 question: "Is Fr. Julius free at 2?"
    const turn2Interpretation = fakeRouter._inferDefaultInterpretation("Is Fr. Julius free at 2?", priorContext);

    assert.equal(turn2Interpretation.route, "LIVE_TOOL");
    assert.equal(turn2Interpretation.intent, TOOL_IDS.CHECK_PRIEST_AVAILABILITY);
    assert.equal(turn2Interpretation.entities.scheduleEvent, "WEDDING", "Inherited from Turn 1");
    assert.equal(turn2Interpretation.entities.datePhrase, "Monday", "Inherited from Turn 1");
    assert.equal(turn2Interpretation.entities.parishName, "St. Joseph Parish", "Inherited from Turn 1");
    assert.ok(turn2Interpretation.entities.priestName.includes("Julius"));
    assert.ok(turn2Interpretation.entities.timePhrase.includes("2:00 PM"));
    assert.equal(turn2Interpretation.usesPreviousContext, true);
  });

  // =========================================================================
  // Test 13: Time Slot Resolution Helper (Section 27)
  // =========================================================================
  await t.test("Time Slot Parsing: converts natural time phrases to canonical 12-hour format", () => {
    assert.equal(resolveManilaTimeSlot("2 PM"), "02:00 PM");
    assert.equal(resolveManilaTimeSlot("2:00 PM"), "02:00 PM");
    assert.equal(resolveManilaTimeSlot("10 in the morning"), "10:00 AM");
    assert.equal(resolveManilaTimeSlot("10:30 AM"), "10:30 AM");
    assert.equal(resolveManilaTimeSlot("afternoon"), "02:00 PM");
    assert.equal(resolveManilaTimeSlot("morning"), "09:00 AM");

    assert.equal(extractTimeSlotFromText("Can I book at 2 PM Monday?"), "02:00 PM");
    assert.equal(extractTimeSlotFromText("Is 10:00 AM available tomorrow?"), "10:00 AM");
  });

  // =========================================================================
  // Test 14: Public Events Visibility Classification (Sections 17, 18)
  // =========================================================================
  await t.test("Calendar Events: strictly exposes only PUBLIC events and hides PARISH_PRIVATE events", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
        }),
      },
      parishEvent: {
        findMany: async ({ where }) => {
          // Verify that query strictly enforces PUBLIC visibility
          assert.equal(where.visibility, "PUBLIC");
          assert.equal(where.isActive, true);
          assert.ok(where.eventDate?.gte instanceof Date);
          assert.ok(where.eventDate?.lt instanceof Date);
          return [
            {
              id: 10,
              parishId: 1,
              title: "Feast Day Mass & Procession",
              eventType: "FIESTA",
              visibility: "PUBLIC",
              location: "Main Church",
              eventDate: new Date("2026-09-14T00:00:00.000Z"),
              startTime: "09:00 AM",
              endTime: "11:00 AM",
              description: "Annual parish feast celebration.",
            },
          ];
        },
      },
      massScheduleTemplate: {
        findMany: async ({ where }) => {
          assert.deepEqual(where, { parishId: 1, isActive: true });
          return [
          {
            id: 20,
            dayType: "WEEKDAY",
            timeSlot: "06:00 AM",
            label: "Morning Mass",
            language: "Tagalog",
            location: "Main Church",
          },
          ];
        },
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: mockPrisma });
    const result = await registry.getParishEventsForDate({
      parishId: 1,
      date: "2026-09-14",
    });

    assert.ok(result.answer.includes("Feast Day Mass & Procession"));
    assert.ok(result.answer.includes("06:00 AM"));
    assert.equal(result.liveData.publicEvents.length, 1);
    assert.equal(result.liveData.massSchedules.length, 1);
  });

  await t.test("Date typo validation: a minor misspelling of tomorrow resolves safely in Manila", () => {
    const reference = new Date("2026-09-11T08:00:00+08:00");
    assert.equal(resolveManilaDate("tommorow", reference), "2026-09-12");
    assert.equal(resolveManilaDate("tommorow please", reference), "2026-09-12");
    assert.equal(resolveManilaDate("borrow please", reference), null);
  });

  await t.test("Schedule event normalization prefers exact specific aliases over generic substrings", () => {
    assert.equal(resolveScheduleEventType("Wedding"), "WEDDING");
    assert.equal(resolveScheduleEventType("Marriage"), "WEDDING");
    assert.equal(resolveScheduleEventType("Marriage Special"), "MARRIAGE_SPECIAL");
    assert.equal(resolveScheduleEventType("special wedding"), "MARRIAGE_SPECIAL");
  });

  await t.test("ScheduleService real contract: (parishId, date, eventType) returns string[] and classifies no-window/service-disabled", async () => {
    const originalParishFindUnique = prisma.parish.findUnique;
    const originalScheduleFindMany = prisma.schedule.findMany;
    let officeClosed = false;
    let serviceEnabled = true;
    const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
      .map((weekday) => ({ weekday, isAvailable: true }));

    prisma.parish.findUnique = async () => ({
      id: 2,
      isActive: true,
      eventSettings: {
        availableEvents: serviceEnabled ? ["WEDDING"] : ["BAPTISM"],
        timeSlots: ["09:00 AM", "10:30 AM"],
        capacitySettings: { dailyLimit: 10, slotCapacity: 1 },
      },
      officeHours: {
        Monday: { openTime: "08:00 AM", closeTime: "05:00 PM", isClosed: officeClosed },
      },
      availabilities: [],
      weekdayRules: weekdays,
      serviceWeekdayRules: [],
      scheduleDateRules: [],
    });
    prisma.schedule.findMany = async () => [];

    try {
      const service = new ScheduleService();
      const slots = await service.getAvailableSlots(2, "2026-09-14", "WEDDING");
      assert.deepEqual(slots, ["09:00 AM", "10:30 AM"]);
      assert.ok(slots.every((slot) => typeof slot === "string"));

      const detailed = await service.getAvailableSlotsDetailed(2, "2026-09-14", "WEDDING");
      assert.equal(detailed.candidateSlots.length, 2);
      assert.equal(detailed.slots.length, 2);
      assert.equal(detailed.reasonCode, null);

      officeClosed = true;
      const closed = await service.getAvailableSlotsDetailed(2, "2026-09-14", "WEDDING");
      assert.deepEqual(closed.slots, []);
      assert.equal(closed.reasonCode, "PARISH_CLOSED");

      officeClosed = false;
      serviceEnabled = false;
      const disabled = await service.getAvailableSlotsDetailed(2, "2026-09-14", "WEDDING");
      assert.deepEqual(disabled.slots, []);
      assert.equal(disabled.reasonCode, "EVENT_NOT_OFFERED");
    } finally {
      prisma.parish.findUnique = originalParishFindUnique;
      prisma.schedule.findMany = originalScheduleFindMany;
    }
  });

  await t.test("Clarification continuation retains parish/event, and Monday follow-up replaces only the date", async () => {
    const executions = [];
    const mockPrisma = {
      parish: {
        findMany: async () => [{ id: 1, parishName: "St. Joseph Parish" }],
      },
    };
    const registry = {
      prisma: mockPrisma,
      getCalendarSlotAvailability: async (params) => {
        executions.push(params);
        return { answer: "ok", liveData: {} };
      },
    };
    const router = new LiveToolRouter({ registry, prismaClient: mockPrisma });
    const baseProposal = {
      route: "LIVE_TOOL",
      intent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      entities: {
        parishName: "St. Joseph Parish",
        scheduleEvent: "WEDDING",
        datePhrase: null,
      },
      usesPreviousContext: false,
    };

    const clarification = await router.validateAndExecute({
      semanticProposal: baseProposal,
      normalizedQuestion: "Is St. Joseph available for a wedding?",
    });
    assert.equal(clarification.responseType, "CLARIFICATION");
    assert.equal(clarification.structuredClarification.collected.parishId, 1);
    assert.equal(clarification.structuredClarification.collected.eventType, "WEDDING");

    const tomorrow = await router.validateAndExecute({
      structuredClarification: clarification.structuredClarification,
      normalizedQuestion: "tomorrow please",
    });
    assert.equal(tomorrow.executedParams.parishId, 1);
    assert.equal(tomorrow.executedParams.eventType, "WEDDING");
    assert.equal(tomorrow.executedParams.date, resolveManilaDate("tomorrow"));

    const context = {
      lastIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      lastParishId: 1,
      lastParishName: "St. Joseph Parish",
      lastScheduleEvent: "WEDDING",
      lastDatePhrase: tomorrow.executedParams.date,
    };
    const fake = new FakeSemanticRouter();
    const mondayProposal = fake._inferDefaultInterpretation("how about on monday", context);
    const monday = await router.validateAndExecute({
      semanticProposal: mondayProposal,
      normalizedQuestion: "how about on monday",
      conversationContext: context,
    });
    assert.equal(monday.executedParams.parishId, 1);
    assert.equal(monday.executedParams.eventType, "WEDDING");
    assert.equal(monday.executedParams.date, resolveManilaDate("monday"));
    assert.equal(executions.length, 2);
  });

  await t.test("GET_AVAILABLE_DATES changes exact-date context into a bounded canonical range search", async () => {
    const calls = [];
    const mockPrisma = {
      parish: {
        findMany: async () => [{ id: 1, parishName: "St. Joseph Parish" }],
        findUnique: async () => ({ id: 1, parishName: "St. Joseph Parish", isActive: true }),
      },
    };
    const scheduleService = {
      getAvailableDatesInRange: async (parishId, eventType, startDate, rangeDays) => {
        calls.push({ parishId, eventType, startDate, rangeDays });
        return {
          serviceAvailable: true,
          reasonCode: null,
          startDate: "2026-09-11",
          endDate: "2026-09-24",
          rangeDays: 14,
          dates: [
            { date: "2026-09-14", slots: ["09:00 AM"] },
            { date: "2026-09-16", slots: ["10:30 AM", "01:30 PM"] },
          ],
        };
      },
    };
    const registry = new LiveToolRegistry({ prismaClient: mockPrisma, scheduleService });
    const router = new LiveToolRouter({ registry, prismaClient: mockPrisma });
    const context = {
      lastIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      lastParishId: 1,
      lastParishName: "St. Joseph Parish",
      lastScheduleEvent: "WEDDING",
      lastDatePhrase: "2026-09-14",
    };
    const fake = new FakeSemanticRouter();
    for (const wording of [
      "what days are available?",
      "What dates have wedding openings?",
      "Any available days this week?",
      "Find me the next available wedding date.",
    ]) {
      assert.equal(fake._inferDefaultInterpretation(wording, context).intent, TOOL_IDS.GET_AVAILABLE_DATES, wording);
    }
    const proposal = fake._inferDefaultInterpretation("what days are available?", context);
    assert.equal(proposal.intent, TOOL_IDS.GET_AVAILABLE_DATES);
    assert.equal(proposal.entities.datePhrase, null);

    const result = await router.validateAndExecute({
      semanticProposal: proposal,
      normalizedQuestion: "what days are available?",
      conversationContext: context,
    });
    assert.equal(result.executedParams.eventType, "WEDDING");
    assert.equal(result.executedParams.startDate, null, "Must not inherit Monday as range start");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { parishId: 1, eventType: "WEDDING", startDate: null, rangeDays: 14 });
    assert.ok(result.answer.includes("September 14"));
    assert.ok(result.answer.includes("September 16"));
  });
});
