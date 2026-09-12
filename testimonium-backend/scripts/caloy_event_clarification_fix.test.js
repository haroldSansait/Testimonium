import test from "node:test";
import assert from "node:assert/strict";
import { LiveToolRouter } from "../services/ai/liveTools/LiveToolRouter.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";
import { TOOL_IDS } from "../services/ai/liveTools/liveToolSchemas.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { ConversationContextManager } from "../services/ai/ConversationContextManager.js";
import { FakeSemanticRouter } from "../services/ai/FakeSemanticRouter.js";
import { FakeCaloyResponseComposer } from "../services/ai/FakeCaloyResponseComposer.js";
import { CaloyResponseComposer } from "../services/ai/CaloyResponseComposer.js";
import { getParishSchedulingConfiguration } from "../services/SchedulingConfiguration.js";

// Fixture matching St. Joseph Parish live configuration
const ST_JOSEPH_AVAILABLE_EVENTS = [
  "MARRIAGE_SPECIAL",
  "WAKE_MASS",
  "PRIVATE_MASS",
  "ANOINTING_OF_THE_SICK",
  "FIESTA",
  "BLESSING",
  "DELIVERANCE",
  "THANKSGIVING",
  "FIRST_COMMUNION",
  "MASS_OF_HOLY_SPIRIT",
  "CONFIRMATION",
  "CONFESSION",
  "BAPTISM",
  "FUNERAL",
];

const mockStJosephParish = {
  id: 1,
  parishName: "St. Joseph Parish",
  isActive: true,
  eventSettings: {
    availableEvents: ST_JOSEPH_AVAILABLE_EVENTS,
    timeSlots: ["09:00 AM", "10:00 AM", "02:00 PM", "03:00 PM"],
    capacitySettings: { dailyLimit: 10, slotCapacity: 2 },
  },
};

const mockParishA = {
  id: 10,
  parishName: "Parish A",
  isActive: true,
  eventSettings: {
    availableEvents: ["WAKE_MASS", "BAPTISM"],
    timeSlots: ["09:00 AM"],
    capacitySettings: { dailyLimit: 5, slotCapacity: 1 },
  },
};

const mockParishB = {
  id: 20,
  parishName: "Parish B",
  isActive: true,
  eventSettings: {
    availableEvents: ["CONFESSION", "MARRIAGE_SPECIAL"],
    timeSlots: ["02:00 PM"],
    capacitySettings: { dailyLimit: 5, slotCapacity: 1 },
  },
};

test("Caloy Structured Clarification & Event Option Fix Suite", async (t) => {
  // =========================================================================
  // TEST A, B, C, D: Authoritative Parish Schedulable Events in Clarification
  // =========================================================================
  await t.test("TEST A & D: St. Joseph selected -> clarification options exactly match authoritative enabled events without truncation", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 1) return mockStJosephParish;
          return null;
        },
        findMany: async () => [mockStJosephParish],
      },
    };

    const router = new LiveToolRouter({ prismaClient: mockPrisma });
    const result = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: {
          parishId: 1,
          date: "2026-09-17",
          // eventType missing -> triggers SCHEDULE_EVENT clarification
        },
      },
    });

    assert.equal(result.responseType, "CLARIFICATION");
    assert.equal(result.structuredClarification?.missing, "eventType");
    assert.ok(result.clarificationOptions, "Must provide clarificationOptions");

    // All 14 enabled events must be present (no truncation to 6)
    assert.equal(result.clarificationOptions.length, 14, "Must contain all 14 enabled events");

    const expectedConfig = getParishSchedulingConfiguration(mockStJosephParish);
    const expectedValues = expectedConfig.enabledServices;
    const actualValues = result.clarificationOptions.map((opt) => opt.value);

    assert.deepEqual(actualValues, expectedValues, "Clarification option values must match getParishSchedulingConfiguration");
  });

  await t.test("TEST B: WEDDING is disabled for St. Joseph and must NOT appear in clarification options", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 1) return mockStJosephParish;
          return null;
        },
        findMany: async () => [mockStJosephParish],
      },
    };

    const router = new LiveToolRouter({ prismaClient: mockPrisma });
    const result = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: {
          parishId: 1,
          date: "2026-09-17",
        },
      },
    });

    const actualValues = result.clarificationOptions.map((opt) => opt.value);
    assert.ok(!actualValues.includes("WEDDING"), "Disabled WEDDING must not appear in clarification options");
  });

  await t.test("TEST C: WAKE_MASS is enabled and appears with friendly label 'Wake Mass'", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 1) return mockStJosephParish;
          return null;
        },
        findMany: async () => [mockStJosephParish],
      },
    };

    const router = new LiveToolRouter({ prismaClient: mockPrisma });
    const result = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: {
          parishId: 1,
          date: "2026-09-17",
        },
      },
    });

    const wakeMassOption = result.clarificationOptions.find((opt) => opt.value === "WAKE_MASS");
    assert.ok(wakeMassOption, "WAKE_MASS must be present in clarification options");
    assert.equal(wakeMassOption.label, "Wake Mass");
  });

  await t.test("TEST E: Stale or manual submission of disabled WEDDING is rejected as not offered", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 1) return mockStJosephParish;
          return null;
        },
        findMany: async () => [mockStJosephParish],
      },
    };

    const router = new LiveToolRouter({ prismaClient: mockPrisma });
    const result = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: {
          parishId: 1,
          eventType: "WEDDING",
          date: "2026-09-17",
        },
      },
    });

    assert.equal(result.responseType, "FALLBACK");
    assert.equal(result.fallbackReason, "EVENT_NOT_OFFERED");
    assert.ok(result.answer.includes("does not currently offer"), "Must explicitly reject unsupported event");
  });

  // =========================================================================
  // TEST 25: Preserve Original Date Context Across Clarification Steps
  // =========================================================================
  await t.test("TEST 25: Original date '2026-09-17' survives parish and event clarification steps", async () => {
    let capturedToolExecution = null;

    const mockScheduleService = {
      getAvailableSlots: async (parishId, date, eventType) => {
        capturedToolExecution = { parishId, date, eventType };
        return ["09:00 AM", "02:00 PM"];
      },
    };

    const mockPrisma = {
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 1) return mockStJosephParish;
          return null;
        },
        findMany: async () => [mockStJosephParish],
      },
      schedule: {
        findMany: async () => [],
      },
    };

    const contextManager = new ConversationContextManager();
    const liveToolRouter = new LiveToolRouter({
      registry: new LiveToolRegistry({
        prismaClient: mockPrisma,
        scheduleService: mockScheduleService,
      }),
      prismaClient: mockPrisma,
      responseComposer: new FakeCaloyResponseComposer(),
    });

    const service = new ChatbotService({
      prismaClient: mockPrisma,
      liveToolRouter,
      contextManager,
      semanticRouter: new FakeSemanticRouter(),
      responseComposer: new FakeCaloyResponseComposer(),
    });

    const sessionId = "session-test-preserve-date";

    // Step 1: User asks "can you check the time slots for september 17?"
    // Semantic context extracts date = 2026-09-17, asks for parish
    const step1 = await service.handleQuery({
      sessionId,
      userId: "user-test",
      question: "can you check the time slots for september 17?",
    });

    assert.equal(step1.category, "CLARIFICATION");
    assert.equal(step1.structuredClarification?.missing, "parishId");

    // Step 2: User selects St. Joseph Parish from clarification
    const step2 = await service.handleQuery({
      sessionId,
      userId: "user-test",
      question: "St. Joseph Parish",
      selectedParishId: 1,
      structuredClarification: {
        ...step1.structuredClarification,
        selectedValue: 1,
        isButtonSelection: true,
      },
    });

    assert.equal(step2.category, "CLARIFICATION");
    assert.equal(step2.structuredClarification?.missing, "eventType");

    // Verify date is preserved in context
    const ctxAfterStep2 = contextManager.getContext(sessionId);
    assert.equal(ctxAfterStep2.lastDatePhrase, "2026-09-17", "Date must be retained in context after parish selection");

    // Step 3: User selects Wake Mass from clarification
    const step3 = await service.handleQuery({
      sessionId,
      userId: "user-test",
      question: "Wake Mass",
      selectedParishId: 1,
      structuredClarification: {
        ...step2.structuredClarification,
        selectedValue: "WAKE_MASS",
        isButtonSelection: true,
      },
    });

    // Step 3 should execute the availability check tool using preserved date 2026-09-17
    assert.notEqual(step3.category, "CLARIFICATION");
    assert.equal(step3.category, "LIVE_DATA");

    assert.ok(step3.executedParams, "Tool executedParams must be present");
    assert.equal(step3.executedParams.parishId, 1);
    assert.equal(step3.executedParams.eventType, "WAKE_MASS");
    assert.equal(step3.executedParams.date, "2026-09-17", "Date 2026-09-17 must survive both clarification steps");
  });

  // =========================================================================
  // TEST 26: Clarification Duplication Prevention & Single Emission
  // =========================================================================
  await t.test("TEST 26: Clarification has stable identity and is emitted once per turn without duplicate loops", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async () => mockStJosephParish,
        findMany: async () => [mockStJosephParish],
      },
    };

    const router = new LiveToolRouter({ prismaClient: mockPrisma });
    const res1 = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: {
          parishId: 1,
          date: "2026-09-17",
        },
      },
    });

    assert.equal(res1.responseType, "CLARIFICATION");
    assert.ok(res1.structuredClarification?.id, "Must have stable clarification id");
    assert.equal(res1.structuredClarification.id, "clarify_GET_CALENDAR_SLOT_AVAILABILITY_eventType_1");

    // Re-evaluating identical proposal produces identical stable clarificationId
    const res2 = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: {
          parishId: 1,
          date: "2026-09-17",
        },
      },
    });
    assert.equal(res2.structuredClarification.id, res1.structuredClarification.id);
  });

  // =========================================================================
  // TEST 27: Parish Change Must Refresh Event Options
  // =========================================================================
  await t.test("TEST 27: Changing parish refreshes event options to match new parish configuration", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async ({ where }) => {
          if (where.id === 10) return mockParishA;
          if (where.id === 20) return mockParishB;
          return null;
        },
        findMany: async () => [mockParishA, mockParishB],
      },
    };

    const router = new LiveToolRouter({ prismaClient: mockPrisma });

    // 1. Select Parish A
    const resA = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: { parishId: 10, date: "2026-09-17" },
      },
    });
    assert.equal(resA.responseType, "CLARIFICATION");
    const optionsA = resA.clarificationOptions.map((o) => o.value);
    assert.deepEqual(optionsA, ["WAKE_MASS", "BAPTISM"], "Parish A options must match Parish A config");

    // 2. Select Parish B
    const resB = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: { parishId: 20, date: "2026-09-17" },
      },
    });
    assert.equal(resB.responseType, "CLARIFICATION");
    const optionsB = resB.clarificationOptions.map((o) => o.value);
    assert.deepEqual(optionsB, ["CONFESSION", "MARRIAGE_SPECIAL"], "Parish B options must match Parish B config");

    // No stale options from Parish A in Parish B
    assert.ok(!optionsB.includes("WAKE_MASS"));
    assert.ok(!optionsB.includes("BAPTISM"));
  });

  // =========================================================================
  // TEST 30: Terminology Check ("event or service", no "sacramental event")
  // =========================================================================
  await t.test("TEST 30: Terminology uses 'event or service', not narrow 'sacramental event'", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async () => mockStJosephParish,
        findMany: async () => [mockStJosephParish],
      },
    };

    const router = new LiveToolRouter({ prismaClient: mockPrisma });
    const result = await router.validateAndExecute({
      structuredClarification: {
        toolId: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        collected: { parishId: 1, date: "2026-09-17" },
      },
    });

    assert.equal(result.answer, "Which event or service would you like to check?");
    assert.ok(!result.answer.toLowerCase().includes("sacramental event"), "Must not use 'sacramental event'");
    assert.ok(!result.answer.toLowerCase().includes("wedding"), "Must not contain hardcoded examples like Wedding");
  });

  // =========================================================================
  // TEST 31: Booking Capability Follow-up Safety
  // =========================================================================
  await t.test("TEST 31: Caloy has no booking capability; composer discards follow-up claiming booking", async () => {
    class CapturingFakeGeminiClient {
      constructor(cannedResponse) {
        this.cannedResponse = cannedResponse;
        this.models = {
          generateContent: async () => ({
            text: () => JSON.stringify(this.cannedResponse),
          }),
        };
      }
    }

    // Model tries to claim booking capability in follow-up
    const cannedWithBookingFollowUp = {
      answer: "The 3:00 PM slot for Wake Mass at St. Joseph Parish on 2026-09-17 is currently available.",
      followUp: {
        capability: TOOL_IDS.CHECK_PRIEST_AVAILABILITY,
        text: "Let's book the 3 PM slot now for your schedule.",
      },
    };

    const composer = new CaloyResponseComposer({
      geminiClient: new CapturingFakeGeminiClient(cannedWithBookingFollowUp),
    });

    const res = await composer.compose({
      responseType: "GET_CALENDAR_SLOT_AVAILABILITY",
      structuredFacts: {
        timeSlot: "03:00 PM",
        isAvailable: true,
        parishName: "St. Joseph Parish",
        humanEventType: "Wake Mass",
        date: "2026-09-17",
      },
      fallbackAnswer: "The 3:00 PM slot for Wake Mass at St. Joseph Parish on 2026-09-17 is available.",
      conversationContext: {},
      capabilityHints: [TOOL_IDS.CHECK_PRIEST_AVAILABILITY],
      userMessage: "Available ba ang 3pm?",
    });

    // Follow-up must be discarded because Caloy cannot book
    assert.equal(res.followUp, null, "Booking claim in follow-up must be discarded");
    assert.ok(!res.answer.includes("Let's book"), "Main answer must not include booking claim");
  });

  await t.test("TEST 31.2: Model rawAnswer implying direct booking falls back safely", async () => {
    class CapturingFakeGeminiClient {
      constructor(cannedResponse) {
        this.cannedResponse = cannedResponse;
        this.models = {
          generateContent: async () => ({
            text: () => JSON.stringify(this.cannedResponse),
          }),
        };
      }
    }

    // Model hallucinates booking in main answer
    const cannedWithBookingAnswer = {
      answer: "Na-book ko na po ang inyong schedule para sa Wake Mass sa ganap na 3 PM.",
      followUp: null,
    };

    const composer = new CaloyResponseComposer({
      geminiClient: new CapturingFakeGeminiClient(cannedWithBookingAnswer),
    });

    const res = await composer.compose({
      responseType: "GET_CALENDAR_SLOT_AVAILABILITY",
      structuredFacts: {
        timeSlot: "03:00 PM",
        isAvailable: true,
        parishName: "St. Joseph Parish",
        humanEventType: "Wake Mass",
        date: "2026-09-17",
      },
      fallbackAnswer: "The 3:00 PM slot for Wake Mass at St. Joseph Parish on 2026-09-17 is available.",
      conversationContext: {},
      capabilityHints: [],
      userMessage: "Available ba ang 3pm?",
    });

    // Must fall back to safe deterministic fallback answer
    assert.equal(res.answer, "The 3:00 PM slot for Wake Mass at St. Joseph Parish on 2026-09-17 is available.");
  });

  await t.test("TEST 31.3: Harmless priest availability follow-up is preserved", async () => {
    class CapturingFakeGeminiClient {
      constructor(cannedResponse) {
        this.cannedResponse = cannedResponse;
        this.models = {
          generateContent: async () => ({
            text: () => JSON.stringify(this.cannedResponse),
          }),
        };
      }
    }

    const cannedHarmless = {
      answer: "The 3:00 PM slot for Wake Mass at St. Joseph Parish on 2026-09-17 is currently available.",
      followUp: {
        capability: TOOL_IDS.CHECK_PRIEST_AVAILABILITY,
        text: "Would you like to check if a priest is available for this slot?",
      },
    };

    const composer = new CaloyResponseComposer({
      geminiClient: new CapturingFakeGeminiClient(cannedHarmless),
    });

    const res = await composer.compose({
      responseType: "GET_CALENDAR_SLOT_AVAILABILITY",
      structuredFacts: {
        timeSlot: "03:00 PM",
        isAvailable: true,
        parishName: "St. Joseph Parish",
        humanEventType: "Wake Mass",
        date: "2026-09-17",
      },
      fallbackAnswer: "The 3:00 PM slot for Wake Mass at St. Joseph Parish on 2026-09-17 is available.",
      conversationContext: {},
      capabilityHints: [TOOL_IDS.CHECK_PRIEST_AVAILABILITY],
      userMessage: "Available ba ang 3pm?",
    });

    // Harmless availability follow-up is kept
    assert.equal(res.followUpCapability, TOOL_IDS.CHECK_PRIEST_AVAILABILITY);
    assert.ok(res.answer.includes("Would you like to check if a priest is available for this slot?"));
  });
});
