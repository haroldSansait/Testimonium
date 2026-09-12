import test from "node:test";
import assert from "node:assert/strict";
import { resolveManilaDate } from "../services/ai/semanticValidationHelper.js";
import { FakeSemanticRouter } from "../services/ai/FakeSemanticRouter.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";
import { TOOL_IDS } from "../services/ai/liveTools/liveToolSchemas.js";
import { ConversationContextManager } from "../services/ai/ConversationContextManager.js";
import { ChatbotService } from "../services/ChatbotService.js";
import { validateFactPreservation } from "../services/ai/canonicalFactValidator.js";
import {
  isDuplicateOrRedundantFollowUp,
  isLanguageConsistent,
} from "../services/ai/CaloyResponseComposer.js";
import { FakeCaloyResponseComposer } from "../services/ai/FakeCaloyResponseComposer.js";
import { detectSocialIntent, SOCIAL_RESPONSES } from "../services/ai/socialIntentClassifier.js";
import { CALOY_PERSONALITY } from "../services/ai/CaloyPolicy.js";

test("Caloy Conversational Correctness & Owner QA Fixes Suite", async (t) => {
  // =========================================================================
  // 1. Natural Absolute Dates & Local Relative Dates (Owner QA #A & #B)
  // =========================================================================
  await t.test("1.1 Natural absolute dates resolve correctly in Asia/Manila", () => {
    const dates = [
      "September 17",
      "Sept 17",
      "September 17th",
      "on September 17",
      "17 September",
      "september 17",
      "sept 17",
    ];

    for (const d of dates) {
      const resolved = resolveManilaDate(d);
      assert.ok(resolved, `Expected '${d}' to resolve to a date string`);
      assert.match(resolved, /^\d{4}-09-17$/, `Expected '${d}' to resolve to -09-17, got ${resolved}`);
    }
  });

  await t.test("1.2 Local-language relative dates resolve correctly without hardcoded dictionaries", () => {
    const tomorrowResolved = resolveManilaDate("tomorrow");
    const bukasResolved = resolveManilaDate("bukas");
    const ugmaResolved = resolveManilaDate("ugma");

    assert.ok(tomorrowResolved, "tomorrow should resolve");
    assert.ok(bukasResolved, "bukas should resolve");
    assert.ok(ugmaResolved, "ugma should resolve");

    assert.equal(bukasResolved, tomorrowResolved, "bukas should match tomorrow");
    assert.equal(ugmaResolved, tomorrowResolved, "ugma should match tomorrow");
  });

  await t.test("1.3 Semantic router extracts normalized date phrases for natural dates", async () => {
    const router = new FakeSemanticRouter();

    const r1 = await router.interpret({ sanitizedQuestion: "can you check the time slots for september 17?" });
    assert.equal(r1.intent, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);
    assert.equal(r1.entities?.datePhrase, "2026-09-17");

    const r2 = await router.interpret({
      sanitizedQuestion: "september 17",
      conversationContext: {
        lastIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        lastParishId: 1,
        lastParishName: "St. Joseph Parish",
        lastScheduleEvent: "WAKE_MASS",
        pendingClarificationIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
        pendingMissingParam: "date",
      },
    });
    assert.equal(r2.intent, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);
    assert.equal(r2.entities?.datePhrase, "2026-09-17");
    assert.equal(r2.pendingRelation, "ANSWER_PENDING");
  });

  // =========================================================================
  // 2. Pending Clarification Interruption & Topic Changes (Section 5, 6, 40)
  // =========================================================================
  await t.test("2.1 Answering pending clarification with 'bukas' or 'September 17' preserves flow", async () => {
    const router = new FakeSemanticRouter();
    const context = {
      lastIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      lastParishId: 1,
      lastParishName: "St. Joseph Parish",
      lastScheduleEvent: "WAKE_MASS",
      pendingClarificationIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      pendingMissingParam: "date",
    };

    const resBukas = await router.interpret({ sanitizedQuestion: "bukas", conversationContext: context });
    assert.equal(resBukas.pendingRelation, "ANSWER_PENDING");
    assert.equal(resBukas.intent, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);

    const resSept = await router.interpret({ sanitizedQuestion: "September 17", conversationContext: context });
    assert.equal(resSept.pendingRelation, "ANSWER_PENDING");
    assert.equal(resSept.intent, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);
    assert.equal(resSept.entities?.datePhrase, "2026-09-17");
  });

  await t.test("2.2 New question during pending clarification acts as NEW_TOPIC and clears stale context", async () => {
    const router = new FakeSemanticRouter();
    const context = {
      lastIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      lastParishId: 1,
      lastParishName: "St. Joseph Parish",
      lastScheduleEvent: "WAKE_MASS",
      pendingClarificationIntent: TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY,
      pendingMissingParam: "date",
    };

    // User asks schedulable events question instead of answering date
    const resEvents = await router.interpret({
      sanitizedQuestion: "Anong mga event ang pwede i schedule sa St. Joseph?",
      conversationContext: context,
    });
    assert.equal(resEvents.pendingRelation, "NEW_TOPIC");
    assert.equal(resEvents.intent, TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS);

    // User asks document fee question instead of answering date
    const resBanns = await router.interpret({
      sanitizedQuestion: "How much is Marriage Banns?",
      conversationContext: context,
    });
    assert.equal(resBanns.pendingRelation, "NEW_TOPIC");
    assert.equal(resBanns.intent, TOOL_IDS.GET_DOCUMENT_FEE);
  });

  // =========================================================================
  // 3. Schedulable Events vs Document Offerings (Section 7, 8, 9, 11, 41)
  // =========================================================================
  await t.test("3.1 GET_PARISH_SCHEDULABLE_EVENTS returns enabled event types and NEVER documents", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
          eventSettings: {
            availableEvents: ["WAKE_MASS", "WEDDING_SPECIAL", "BAPTISM_SPECIAL"],
            timeSlots: ["09:00 AM", "02:00 PM"],
            capacitySettings: { dailyLimit: 5, slotCapacity: 1 },
          },
          availableDocuments: ["BAPTISMAL_CERTIFICATE", "MARRIAGE_CERTIFICATE"],
        }),
      },
    };

    const registry = new LiveToolRegistry({ prismaClient: mockPrisma });
    const result = await registry.getParishSchedulableEvents({ parishId: 1 });

    assert.ok(result.answer.includes("St. Joseph Parish"));
    assert.ok(result.structuredFacts.schedulableEvents.length > 0);

    // Verify it includes schedulable events
    const factsJoined = result.structuredFacts.schedulableEvents.join(", ");
    assert.ok(factsJoined.includes("Wake Mass") || factsJoined.includes("Wedding"));

    // Verify it does NOT include document offerings
    assert.ok(!factsJoined.includes("Certificate of Baptism"));
    assert.ok(!factsJoined.includes("Baptismal Certificate"));
    assert.ok(!factsJoined.includes("Marriage Certificate"));
  });

  await t.test("3.2 General schedulable event inquiry does NOT require a date", async () => {
    const router = new FakeSemanticRouter();
    const res = await router.interpret({ sanitizedQuestion: "What events can I schedule at St. Joseph?" });
    assert.equal(res.intent, TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS);
    assert.equal(res.route, "LIVE_TOOL");
  });

  // =========================================================================
  // 4. Wake Mass Routing Consistency (Section 10, 36, 42)
  // =========================================================================
  await t.test("4.1 Natural Wake Mass queries consistently route to scheduling intent", async () => {
    const router = new FakeSemanticRouter();

    const q1 = await router.interpret({ sanitizedQuestion: "Pwede ba ako mag request ng schedule para sa isang wake mass?" });
    assert.equal(q1.intent, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);
    assert.equal(q1.entities?.scheduleEvent, "WAKE_MASS");

    const q2 = await router.interpret({ sanitizedQuestion: "pwede ba ako mag sched ng wake mass sa St joseph?" });
    assert.equal(q2.intent, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);
    assert.equal(q2.entities?.scheduleEvent, "WAKE_MASS");

    const q3 = await router.interpret({ sanitizedQuestion: "Pwede ba sa monday mag schedule ng wake mass?" });
    assert.equal(q3.intent, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);
    assert.equal(q3.entities?.scheduleEvent, "WAKE_MASS");

    const q4 = await router.interpret({
      sanitizedQuestion: "How about Wake Mass at St. Joseph?",
      conversationContext: {
        lastIntent: TOOL_IDS.GET_PARISH_SCHEDULABLE_EVENTS,
        lastParishId: 1,
        lastParishName: "St. Joseph Parish",
      },
    });
    assert.equal(q4.intent, TOOL_IDS.GET_CALENDAR_SLOT_AVAILABILITY);
    assert.equal(q4.entities?.scheduleEvent, "WAKE_MASS");
  });

  // =========================================================================
  // 5. Availability Reasons Distinction (Section 13, 14, 43)
  // =========================================================================
  await t.test("5.1 Disjunctive 'not offered or no slots' statement is rejected by fact validator", () => {
    const structuredFacts = {
      parishName: "St. Joseph Parish",
      eventType: "MASS_INTENTION",
      date: "2026-09-17",
      isAvailable: false,
      reasonCode: "EVENT_NOT_OFFERED",
      safeReason: "EVENT_NOT_OFFERED",
    };

    // Model produced disjunctive combination
    const badAnswer = "Mass Intention at St. Joseph Parish is currently not offered or has no available slots.";
    const isValid = validateFactPreservation({
      structuredFacts,
      composedAnswer: badAnswer,
      responseType: "LIVE_DATA",
    });

    assert.equal(isValid, false, "Fact validator must reject 'not offered or no available slots'");
  });

  await t.test("5.2 Contradictory reasons are rejected by fact validator", () => {
    // Case 1: EVENT_NOT_OFFERED -> claiming fully booked is rejected
    const notOfferedFacts = {
      parishName: "St. Joseph Parish",
      eventType: "MASS_INTENTION",
      date: "2026-09-17",
      isAvailable: false,
      reasonCode: "EVENT_NOT_OFFERED",
    };
    const claimingFullyBooked = "Mass Intention is fully booked at St. Joseph Parish on 2026-09-17.";
    assert.equal(
      validateFactPreservation({ structuredFacts: notOfferedFacts, composedAnswer: claimingFullyBooked }),
      false
    );

    // Case 2: PARISH_CLOSED -> claiming not offered is rejected
    const closedFacts = {
      parishName: "St. Joseph Parish",
      eventType: "WEDDING_SPECIAL",
      date: "2026-09-17",
      isAvailable: false,
      reasonCode: "PARISH_CLOSED",
    };
    const claimingNotOffered = "Wedding is not offered at St. Joseph Parish.";
    assert.equal(
      validateFactPreservation({ structuredFacts: closedFacts, composedAnswer: claimingNotOffered }),
      false
    );

    // Case 3: NO_AVAILABLE_SLOTS -> claiming not offered is rejected
    const noSlotsFacts = {
      parishName: "St. Joseph Parish",
      eventType: "WEDDING_SPECIAL",
      date: "2026-09-17",
      isAvailable: false,
      reasonCode: "NO_AVAILABLE_SLOTS",
    };
    const claimingServiceUnavailable = "Wedding service is not offered at St. Joseph Parish.";
    assert.equal(
      validateFactPreservation({ structuredFacts: noSlotsFacts, composedAnswer: claimingServiceUnavailable }),
      false
    );

    // Case 4: Approved single reasons pass cleanly
    const goodNotOffered = "Mass Intention isn't currently offered for scheduling at St. Joseph Parish.";
    assert.equal(
      validateFactPreservation({ structuredFacts: notOfferedFacts, composedAnswer: goodNotOffered }),
      true
    );

    const goodNoSlots = "Wedding is offered, but there are no available slots at St. Joseph Parish on 2026-09-17.";
    assert.equal(
      validateFactPreservation({ structuredFacts: noSlotsFacts, composedAnswer: goodNoSlots }),
      true
    );
  });

  // =========================================================================
  // 6. Follow-up Discipline & Deduplication (Section 15-21, 44)
  // =========================================================================
  await t.test("6.1 isDuplicateOrRedundantFollowUp catches duplicate next-step prompts", () => {
    const mainWithPrompt = "There are no slots on September 17. Would you like to check another day?";
    const followUpSame = "Would you like to see available dates?";

    assert.equal(isDuplicateOrRedundantFollowUp(mainWithPrompt, followUpSame), true);

    const mainWithoutPrompt = "The standard fee for Marriage Banns at St. Joseph Parish is ₱200.00.";
    const followUpValid = "Would you like to see the required documents for Marriage Banns?";
    assert.equal(isDuplicateOrRedundantFollowUp(mainWithoutPrompt, followUpValid), false);
  });

  await t.test("6.2 Duplicate follow-up is discarded, rendering only the main valid prompt", async () => {
    const composer = new FakeCaloyResponseComposer();
    composer.setMockResult({
      answer: "There are no open slots on 2026-09-17. Would you like to check another day?",
      followUp: {
        capability: TOOL_IDS.GET_AVAILABLE_DATES,
        text: "Would you like to see available dates?",
      },
    });

    const res = await composer.compose({
      responseType: "LIVE_DATA",
      structuredFacts: {
        parishName: "St. Joseph Parish",
        eventType: "WEDDING_SPECIAL",
        date: "2026-09-17",
        isAvailable: false,
        reasonCode: "NO_AVAILABLE_SLOTS",
      },
      capabilityHints: [TOOL_IDS.GET_AVAILABLE_DATES],
      userMessage: "Are there slots on September 17?",
    });

    // Follow-up was discarded because main answer already contained the prompt
    assert.equal(res.answer, "There are no open slots on 2026-09-17. Would you like to check another day?");
    assert.equal(res.followUpCapability, null);
  });

  await t.test("6.3 Simple negative and status checks accept null follow-up cleanly", async () => {
    const composer = new FakeCaloyResponseComposer();
    composer.setMockResult({
      answer: "Your document request SR-2026-000001 is currently under review by parish staff.",
      followUp: null,
    });

    const res = await composer.compose({
      responseType: "LIVE_DATA",
      structuredFacts: {
        trackingNumber: "SR-2026-000001",
        safeStatus: "under review",
      },
      capabilityHints: [TOOL_IDS.TRACK_DOCUMENT_REQUEST],
      userMessage: "Check status of SR-2026-000001",
    });

    assert.equal(res.answer, "Your document request SR-2026-000001 is currently under review by parish staff.");
    assert.equal(res.followUpCapability, null);
  });

  // =========================================================================
  // 7. Language Consistency (Section 22-26, 45)
  // =========================================================================
  await t.test("7.1 isLanguageConsistent rejects Hiligaynon main answer with English follow-up", () => {
    const hiligaynonMain = "May ara gid sa St. Joseph Parish. Ang Marriage Banns didto may fee nga ₱200.00.";
    const englishFollowUp = "Would you like to see the requirements?";

    assert.equal(isLanguageConsistent(hiligaynonMain, englishFollowUp), false);

    const hiligaynonFollowUp = "Gusto mo bala makita ang mga requirements para sa Marriage Banns?";
    assert.equal(isLanguageConsistent(hiligaynonMain, hiligaynonFollowUp), true);
  });

  await t.test("7.2 Fake composer discards language-mismatched follow-up", async () => {
    const composer = new FakeCaloyResponseComposer();
    composer.setMockResult({
      answer: "May ara gid sa St. Joseph Parish. Ang Marriage Banns didto may fee nga ₱200.00.",
      followUp: {
        capability: TOOL_IDS.GET_DOCUMENT_REQUIREMENTS,
        text: "Would you like to check the requirements?",
      },
    });

    const res = await composer.compose({
      responseType: "LIVE_DATA",
      structuredFacts: {
        parishName: "St. Joseph Parish",
        documentType: "MARRIAGE_BANNS",
        fee: "₱200.00",
        feeAmount: 200,
      },
      capabilityHints: [TOOL_IDS.GET_DOCUMENT_REQUIREMENTS],
      userMessage: "Tagpila naman ang marriage banns dira sa St. Joseph parish?",
    });

    // English follow-up discarded because main answer is Hiligaynon
    assert.equal(res.answer, "May ara gid sa St. Joseph Parish. Ang Marriage Banns didto may fee nga ₱200.00.");
    assert.equal(res.followUpCapability, null);
  });

  // =========================================================================
  // 8. Social Intent Distinction ("No, thanks" & Greetings) (Section 27-30, 46)
  // =========================================================================
  await t.test("8.1 'No, thanks' and variations resolve to DECLINE_OR_CLOSE, not GREETING", () => {
    const declines = ["No, thanks", "No thanks", "Okay, thanks", "Sige, salamat", "Way kaso ah", "Okay lang"];

    for (const d of declines) {
      const match = detectSocialIntent(d);
      const intent = match?.intent;
      assert.ok(
        intent === "DECLINE_OR_CLOSE" || intent === "THANKS",
        `Expected '${d}' to be DECLINE_OR_CLOSE or THANKS, got ${intent}`
      );
      assert.notEqual(intent, "GREETING", `'${d}' must NEVER be classified as GREETING`);
    }
  });

  await t.test("8.2 DECLINE_OR_CLOSE returns a warm closing without greeting reset or follow-up", () => {
    assert.ok(SOCIAL_RESPONSES.DECLINE_OR_CLOSE);
    assert.ok(!SOCIAL_RESPONSES.DECLINE_OR_CLOSE.includes("How can I help you with TESTIMONIUM today?"));
    assert.ok(SOCIAL_RESPONSES.DECLINE_OR_CLOSE.includes("welcome") || SOCIAL_RESPONSES.DECLINE_OR_CLOSE.includes("assist"));
  });

  // =========================================================================
  // 9. Repeated Greeting Prevention Mid-Conversation (Section 30, 47)
  // =========================================================================
  await t.test("9.1 Policy and composer prompt explicitly instruct no repeated greetings mid-conversation", () => {
    assert.match(CALOY_PERSONALITY, /Do NOT repeatedly greet with "Hello!"/i);
    assert.match(CALOY_PERSONALITY, /Greet ONLY on the very first turn/i);
  });

  // =========================================================================
  // 10. End-to-End ChatbotService Multi-Turn Correctness
  // =========================================================================
  await t.test("10.1 Multi-turn: pending date clarification interrupted by new topic clears stale date state", async () => {
    const mockPrisma = {
      parish: {
        findUnique: async () => ({
          id: 1,
          parishName: "St. Joseph Parish",
          isActive: true,
          eventSettings: {
            availableEvents: ["WAKE_MASS", "WEDDING_SPECIAL"],
            timeSlots: ["09:00 AM", "02:00 PM"],
            capacitySettings: { dailyLimit: 5, slotCapacity: 1 },
          },
          availableDocuments: ["MARRIAGE_BANNS"],
        }),
        findMany: async () => [
          { id: 1, parishName: "St. Joseph Parish", isActive: true },
        ],
      },
    };

    const contextManager = new ConversationContextManager();
    const service = new ChatbotService({
      prismaClient: mockPrisma,
      contextManager,
      semanticRouter: new FakeSemanticRouter(),
      responseComposer: new FakeCaloyResponseComposer(),
    });

    const sessionId = "session-test-qa-001";

    // Turn 1: User asks to schedule Wake Mass without date -> returns date clarification
    const turn1 = await service.handleQuery({
      sessionId,
      userId: "user-123",
      question: "pwede ba ako mag sched ng wake mass sa St joseph?",
      selectedParishId: 1,
    });

    assert.equal(turn1.category, "CLARIFICATION");
    assert.ok(turn1.answer.includes("date") || turn1.structuredClarification?.parameter === "date");

    // Turn 2: Instead of giving a date, user asks for available events -> NEW_TOPIC
    const turn2 = await service.handleQuery({
      sessionId,
      userId: "user-123",
      question: "Anong mga event ang pwede i schedule sa St. Joseph?",
      selectedParishId: 1,
      structuredClarification: turn1.structuredClarification, // Client passes back storage clarification
    });

    // Caloy must NOT ask for a date again! Must answer the new question!
    assert.notEqual(turn2.category, "CLARIFICATION");
    assert.equal(turn2.category, "LIVE_DATA");
    assert.ok(turn2.answer.includes("St. Joseph Parish"));
    assert.ok(turn2.answer.includes("Wake Mass"));
  });

  await t.test("10.2 Social 'No, thanks' in ChatbotService returns brief acknowledgement without greeting", async () => {
    const service = new ChatbotService({
      contextManager: new ConversationContextManager(),
      semanticRouter: new FakeSemanticRouter(),
      responseComposer: new FakeCaloyResponseComposer(),
    });

    const res = await service.handleQuery({
      sessionId: "session-test-qa-002",
      userId: "user-123",
      question: "No, thanks",
    });

    assert.equal(res.category, "SOCIAL");
    assert.ok(!res.answer.includes("How can I help you with TESTIMONIUM today?"));
    assert.ok(!res.answer.includes("Hi! 👋"));
  });
});
