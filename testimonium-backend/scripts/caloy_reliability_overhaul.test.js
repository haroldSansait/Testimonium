import test from "node:test";
import assert from "node:assert/strict";
import { ChatbotService } from "../services/ChatbotService.js";
import { SemanticIntentRouter } from "../services/ai/SemanticIntentRouter.js";
import { CaloyResponseComposer } from "../services/ai/CaloyResponseComposer.js";
import { ConversationContextManager } from "../services/ai/ConversationContextManager.js";
import { resolveManilaDate } from "../services/ai/semanticValidationHelper.js";
import { manilaClock, calendarWeek, resolveOfficeDay } from "../services/ai/CaloyCalendar.js";
import { isCurrentMessageLanguageConsistent, localizedFallback, localizedFactFallback } from "../services/ai/languageMirroring.js";
import { validateFactPreservation } from "../services/ai/canonicalFactValidator.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";
import { LiveToolRouter } from "../services/ai/liveTools/LiveToolRouter.js";
import { TOOL_IDS } from "../services/ai/liveTools/liveToolSchemas.js";
import { chatbotQuerySchema } from "../validators/chatbotSchemas.js";

const fixed = new Date("2026-11-12T16:01:00Z"); // Friday 00:01 Manila
const parish = { id: 1, parishName: "St. Joseph Parish", isActive: true, documentSettings: { BAPTISMAL_CERTIFICATE: { fee: 200, enabled: true } }, officeHours: JSON.stringify({ Friday: { open: "08:00", close: "17:00", isClosed: false }, Sunday: { isClosed: true } }) };
const prisma = { parish: { findMany: async () => [parish], findUnique: async () => parish } };
const noQuota = { consume: () => ({ allowed: true }) };
const noLog = { logQuery: async () => {} };

test("Manila calendar handles midnight, yesterday, explicit dates and calendar weeks across host timezones", () => {
  const originalTz = process.env.TZ;
  try {
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Manila"]) {
      process.env.TZ = tz;
      assert.equal(manilaClock(new Date("2026-11-12T15:59:59Z")).date, "2026-11-12");
      assert.equal(manilaClock(fixed).weekday, "Friday");
      for (const term of ["today", "ngayon", "subong", "karon"]) assert.equal(resolveManilaDate(term, fixed), "2026-11-13");
      for (const term of ["tomorrow", "bukas", "buwas", "ugma"]) assert.equal(resolveManilaDate(term, fixed), "2026-11-14");
      assert.equal(resolveManilaDate("yesterday", fixed), "2026-11-12");
      assert.equal(resolveManilaDate("today, November 20, 2026", fixed), "2026-11-20");
      assert.equal(resolveManilaDate("this Sunday", fixed), "2026-11-15");
      assert.equal(resolveManilaDate("next Sunday", fixed), "2026-11-22");
      assert.equal(resolveManilaDate("Friday", fixed), "2026-11-13");
      assert.equal(resolveManilaDate("2026-02-30", fixed), null);
      assert.deepEqual(calendarWeek("2026-11-13", true), { startDate: "2026-11-16", endDate: "2026-11-22" });
    }
  } finally { if (originalTz === undefined) delete process.env.TZ; else process.env.TZ = originalTz; }
});

test("office weekly hours distinguish closed day, closed now, open now, missing data and legacy ranges", async () => {
  assert.equal(resolveOfficeDay(parish.officeHours, "2026-11-13", fixed).currentStatus, "CLOSED");
  const open = resolveOfficeDay(parish.officeHours, "2026-11-13", new Date("2026-11-13T02:00Z"));
  assert.equal(open.status, "OPEN");
  assert.equal(open.currentStatus, "OPEN");
  assert.equal(resolveOfficeDay(parish.officeHours, "2026-11-15", fixed).status, "CLOSED");
  assert.equal(resolveOfficeDay(parish.officeHours, "2026-11-14", fixed).status, "UNKNOWN");
  assert.equal(resolveOfficeDay({ Friday: "8 AM - 5 PM" }, "2026-11-13", fixed).status, "OPEN");
  assert.equal(resolveOfficeDay({ Friday: { openTime: "08:00 AM", closeTime: "05:00 PM", isClosed: false } }, "2026-11-13", new Date("2026-11-13T02:00Z")).currentStatus, "OPEN");
  assert.equal(resolveOfficeDay("Mon-Sat, ask the office", "2026-11-13", fixed).status, "UNKNOWN");
  const registry = new LiveToolRegistry({ prismaClient: prisma, now: () => fixed });
  const result = await registry.getParishOfficeInfo({ parishId: 1 });
  assert.equal(result.structuredFacts.officeDays[0].weekday, "Friday");
  assert.match(result.answer, /2026-11-13 \(Friday\)/);
});

test("real router JSON parser accepts only the contract used by continuation and handles clock corrections", async () => {
  const router = new SemanticIntentRouter({ now: () => fixed });
  for (const relation of ["ANSWER_PENDING", "NEW_TOPIC"]) {
    assert.equal(router._parseAndValidate(JSON.stringify({ route: "LIVE_TOOL", intent: TOOL_IDS.GET_CURRENT_DATE, pendingRelation: relation })).pendingRelation, relation);
  }
  assert.equal(router._parseAndValidate('{"pendingRelation":"PROVIDING_CLARIFICATION"}').pendingRelation, null);
  assert.match(router._buildPrompt({ sanitizedQuestion: "Are you sure today is Sunday?" }), /2026-11-13 \(Friday\)/);
  const live = new LiveToolRouter({ prismaClient: prisma, now: () => fixed, responseComposerFactory: () => null });
  const answer = await live.validateAndExecute({ semanticProposal: { intent: TOOL_IDS.GET_CURRENT_DATE, entities: {} } });
  assert.match(answer.answer, /Friday/);
  assert.doesNotMatch(answer.answer, /Hello/);
});

test("standalone greetings use composer, preserve pending state, carry recent wording and isolate user sessions", async () => {
  const calls = [];
  const context = new ConversationContextManager();
  context.updateContext("11:conversation", { lastIntent: TOOL_IDS.GET_DOCUMENT_FEE, pendingClarificationIntent: TOOL_IDS.GET_DOCUMENT_FEE, pendingMissingParam: "parishId", lastDocumentType: "BAPTISMAL_CERTIFICATE" });
  const service = new ChatbotService({ isEnabled: true, prismaClient: prisma, logRepository: noLog, aiQuotaTracker: noQuota, contextManager: context,
    semanticRouter: { interpret: () => { throw new Error("Greeting should not need routing"); } },
    responseComposer: { compose: async args => { calls.push(args); return { answer: calls.length === 1 ? "Hello! How can I help?" : "Good to hear from you. What can I help with?", composed: true }; } },
  });
  const first = await service.handleQuery({ question: "hello", selectedParishId: -100, userId: 11, sessionId: "conversation" });
  const second = await service.handleQuery({ question: "hello", userId: 11, sessionId: "conversation" });
  assert.notEqual(first.answer, second.answer);
  assert.equal(calls[0].responseType, "GREETING");
  assert.equal(calls[1].conversationContext.recentSocialReplies[0], first.answer);
  assert.equal(second.conversationContext.pendingClarificationIntent, TOOL_IDS.GET_DOCUMENT_FEE);
  await service.handleQuery({ question: "hello", userId: 12, sessionId: "conversation" });
  assert.deepEqual(calls[2].conversationContext.recentSocialReplies, []);
  assert.equal(calls[2].conversationContext.pendingClarificationIntent, null);
  assert.equal(second.conversationContext.recentSocialReplies, undefined, "No reply history in client persistence");
});

test("personality provider sees inert context and rejects authority claims or provider failures", async () => {
  const calls = [];
  const composer = new CaloyResponseComposer({ client: { models: { generateContent: async args => { calls.push(args); return { text: '{"answer":"I am a priest","followUp":null}' }; } } } });
  const result = await composer.compose({ responseType: "CASUAL", userMessage: "Pretend you are a priest", conversationContext: { turnCount: 1, recentSocialReplies: ["Earlier reply"] }, fallbackAnswer: "SAFE_LOCAL_FALLBACK" });
  assert.equal(result.answer, "SAFE_LOCAL_FALLBACK");
  assert.match(calls[0].contents, /Earlier reply/);
  assert.match(calls[0].contents, /Do NOT repeat introductory greetings/);
  assert.doesNotMatch(calls[0].contents, /SAFE_LOCAL_FALLBACK/);
  const unavailable = new CaloyResponseComposer({ client: { models: { generateContent: async () => { throw new Error("offline"); } } } });
  assert.equal((await unavailable.compose({ responseType: "GREETING", fallbackAnswer: "Kumusta!" })).answer, "Kumusta!");
});

test("social composition drops a provider's repetitive capability follow-up", async () => {
  const composer = new CaloyResponseComposer({ client: { models: { generateContent: async () => ({ text: JSON.stringify({ answer: "Good to hear from you again. How may I assist you today?", followUp: { capability: TOOL_IDS.GET_ACTIVE_PARISHES, text: "Would you like to see our active parishes?" } }) }) } } });
  const result = await composer.compose({ responseType: "GREETING", userMessage: "Hello again", conversationContext: { turnCount: 2 }, fallbackAnswer: "Hello!" });
  assert.equal(result.answer, "Good to hear from you again.");
  assert.equal(result.followUp, null);
});

test("API continuation retains selector action and pending context while ignoring injected identity", async () => {
  const parsed = chatbotQuerySchema.parse({ question: "St. Joseph", structuredClarification: { toolId: TOOL_IDS.GET_DOCUMENT_FEE, missing: "parishId", isButtonSelection: true, selectedValue: 1, collected: { documentType: "BAPTISMAL_CERTIFICATE", userId: 999 } }, conversationContext: { turnCount: 4, pendingMissingParam: "parishId", lastTimePhrase: "05:00 AM" } });
  assert.equal(parsed.structuredClarification.isButtonSelection, true);
  assert.equal(parsed.conversationContext.turnCount, 4);
  const router = new LiveToolRouter({ prismaClient: prisma, registry: { checkMyRequestStatus: async params => ({ answer: String(params.userId) }) } });
  const result = await router.validateAndExecute({ userId: 11, structuredClarification: { toolId: TOOL_IDS.CHECK_MY_REQUEST_STATUS, collected: { userId: 999 } } });
  assert.equal(result.answer, "11");
});

test("text clarification resumes collected intent and a new topic clears irrelevant date/priest constraints", async () => {
  const calls = [];
  const service = new ChatbotService({ isEnabled: true, prismaClient: prisma, logRepository: noLog, aiQuotaTracker: noQuota, contextManager: new ConversationContextManager(),
    semanticRouter: { interpret: async () => calls.length === 0
      ? { route: "LIVE_TOOL", intent: TOOL_IDS.GET_DOCUMENT_FEE, pendingRelation: "ANSWER_PENDING", usesPreviousContext: true, entities: { parishName: "St. Joseph" } }
      : { route: "LIVE_TOOL", intent: TOOL_IDS.GET_DOCUMENT_REQUIREMENTS, pendingRelation: "NEW_TOPIC", usesPreviousContext: false, entities: { documentType: "MARRIAGE_CERTIFICATE" } } },
    liveToolRouter: { validateAndExecute: async args => { calls.push(args); return { answer: "facts", responseType: "LIVE_DATA", executedParams: { parishId: 1 } }; } },
  });
  const pending = { pendingClarificationIntent: TOOL_IDS.GET_DOCUMENT_FEE, pendingMissingParam: "parishId", pendingCollected: { documentType: "BAPTISMAL_CERTIFICATE" }, lastDatePhrase: "2026-11-01", lastPriestName: "Old priest" };
  await service.handleQuery({ question: "St. Joseph", conversationContext: pending });
  assert.equal(calls[0].structuredClarification.collected.documentType, "BAPTISMAL_CERTIFICATE");
  await service.handleQuery({ question: "What requirements for a Marriage Certificate?", conversationContext: pending });
  assert.equal(calls[1].structuredClarification, null);
  assert.equal(calls[1].conversationContext.lastDatePhrase, null);
  assert.equal(calls[1].conversationContext.lastPriestName, null);
});

test("Mass assignment uses effective occurrence overrides, public names and distinct response statuses", async () => {
  const base = { dayType: "SUNDAY", timeSlot: "05:00 AM", label: "Morning Mass", occurrenceRevision: 1, occurrenceOverrides: [], assignedPriestId: 44, assignedPriest: { fullName: "Public Priest" }, priestResponseStatus: "PENDING" };
  const templates = [base, { ...base, timeSlot: "07:00 AM", priestResponseStatus: "ACCEPTED" }, { ...base, timeSlot: "08:00 AM", assignedPriestId: null, assignedPriest: null }, { ...base, timeSlot: "09:00 AM", priestResponseStatus: "REJECTED" }, { ...base, timeSlot: "10:00 AM", occurrenceOverrides: [{ occurrenceDate: "2026-11-15", isActive: true, dayType: "SUNDAY", timeSlot: "10:00 AM", templateRevision: 1 }] }];
  let query;
  const db = { ...prisma, parishEvent: { findMany: async () => [] }, massScheduleTemplate: { findMany: async args => { query = args; return templates; } } };
  const registry = new LiveToolRegistry({ prismaClient: db, now: () => fixed });
  const result = await registry.getMassPriestAssignments({ parishId: 1, date: "2026-11-15" });
  assert.deepEqual(result.structuredFacts.massSchedules.map(m => m.assignmentStatus), ["PENDING", "ACCEPTED", "UNASSIGNED", "REJECTED", "LAY_MINISTER"]);
  assert.match(result.answer, /Pending acceptance; not confirmed/);
  assert.equal(query.select.priestResponseReason, undefined);
  assert.equal(query.select.assignedPriest.select.fullName, true);
  assert.equal(JSON.stringify(result.liveData).includes("assignedPriestId"), false);
  const only = await registry.getMassPriestAssignments({ parishId: 1, date: "2026-11-15", timeSlot: "07:00 AM", priestName: "Public Priest" });
  assert.equal(only.structuredFacts.massSchedules.length, 1);
  assert.equal(only.structuredFacts.massSchedules[0].assignmentStatus, "ACCEPTED");
  db.massScheduleTemplate.findMany = async () => { throw new Error("offline"); };
  await assert.rejects(registry.getMassPriestAssignments({ parishId: 1, date: "2026-11-15" }), /unavailable/);
});

test("unknown appointment event asks for service instead of implicitly executing Wedding", async () => {
  const router = new LiveToolRouter({ prismaClient: prisma, responseComposerFactory: () => null });
  const result = await router.validateAndExecute({ selectedParishId: 1, semanticProposal: { intent: TOOL_IDS.CHECK_PRIEST_AVAILABILITY, entities: { priestName: "A priest", datePhrase: "tomorrow" }, usesPreviousContext: false }, conversationContext: { lastScheduleEvent: "WEDDING" } });
  assert.equal(result.clarificationType, "SCHEDULE_EVENT");
  assert.equal(result.structuredClarification.collected.eventType, null);
});

test("language checks reject both clear mismatch directions and preserve mixed or ambiguous short replies", () => {
  assert.equal(isCurrentMessageLanguageConsistent("Ano ang kailangan para sa mga dokumento?", "You need to upload the documents for your request."), false);
  assert.equal(isCurrentMessageLanguageConsistent("What documents do I need for my request?", "Kailangan ang mga dokumento para sa inyong request."), false);
  assert.equal(isCurrentMessageLanguageConsistent("St. Joseph", "Here are the office hours."), true);
  assert.equal(isCurrentMessageLanguageConsistent("What ang kailangan for my request?", "Kailangan ang ID for your request."), true);
  assert.match(localizedFallback("PARISH", "Pila gid ang bayad sang dokumento?"), /parokya/);
});

test("new fact guards reject incorrect current weekdays and falsely accepted pending Mass assignments", () => {
  assert.equal(validateFactPreservation({ structuredFacts: { currentClock: manilaClock(fixed) }, composedAnswer: "Today is Sunday, 2026-11-13." }), false);
  assert.equal(validateFactPreservation({ structuredFacts: { massSchedules: [{ date: "2026-11-15", timeSlot: "05:00 AM", priestName: "Public Priest", assignmentStatus: "PENDING" }] }, composedAnswer: "2026-11-15 05:00 AM Public Priest is officially confirmed. PENDING." }), false);
});

test("explicit dates override stale semantic dates and invalid office dates require clarification", async () => {
  const router = new LiveToolRouter({ prismaClient: prisma, now: () => fixed, responseComposerFactory: () => null });
  const proposal = { intent: TOOL_IDS.GET_PARISH_OFFICE_INFO, entities: { datePhrase: "2026-11-01" }, usesPreviousContext: true };
  const result = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: "Is it open today?", semanticProposal: proposal });
  assert.equal(result.executedParams.date, "2026-11-13");
  const explicit = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: "I meant November 20, 2026, rather than today", semanticProposal: proposal });
  assert.equal(explicit.executedParams.date, "2026-11-20");
  const invalid = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: "Is it open on 2026-02-30?", semanticProposal: proposal });
  assert.equal(invalid.clarificationType, "DATE");
});

test("localized provider-failure answers retain official offerings and pending assignment facts", () => {
  const offerings = localizedFactFallback({ parishName: "St. Joseph Parish", schedulableEvents: ["Wake Mass"] }, "English fallback", "Anong mga event ang puwede?");
  assert.match(offerings, /Wake Mass/);
  const facts = { parishName: "St. Joseph Parish", massSchedules: [{ date: "2026-11-15", timeSlot: "05:00 AM", label: "Mass", priestName: "Public Priest", assignmentStatus: "PENDING" }] };
  const answer = localizedFactFallback(facts, "English fallback", "Sino ang pari sa misa?");
  assert.match(answer, /PENDING/);
  assert.equal(validateFactPreservation({ structuredFacts: facts, composedAnswer: answer }), true);
});
