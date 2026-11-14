import test from "node:test";
import assert from "node:assert/strict";
import { ChatbotService } from "../services/ChatbotService.js";
import { LiveToolRegistry } from "../services/ai/liveTools/LiveToolRegistry.js";
import { LiveToolRouter } from "../services/ai/liveTools/LiveToolRouter.js";
import { TOOL_IDS } from "../services/ai/liveTools/liveToolSchemas.js";
import { ConversationContextManager } from "../services/ai/ConversationContextManager.js";
import { CaloyResponseComposer } from "../services/ai/CaloyResponseComposer.js";
import { validateFactPreservation } from "../services/ai/canonicalFactValidator.js";
import { resolveManilaDate, extractPriestReference } from "../services/ai/semanticValidationHelper.js";
import { manilaClock, resolveOfficeDay } from "../services/ai/CaloyCalendar.js";
import { localizedFactFallback } from "../services/ai/languageMirroring.js";
import { buildComposerSystemInstruction } from "../services/ai/CaloyPolicy.js";

const now = new Date("2026-11-14T03:12:00Z"); // Saturday 11:12 Manila
const parish = { id: 1, parishName: "St. Joseph Parish", isActive: true, officeHours: { Saturday: { open: "08:00", close: "17:00" }, Sunday: { isClosed: true } } };
const priest = "Rev. Fr. Julius L. Montaño";
const base = { isActive: true, occurrenceRevision: 1, occurrenceOverrides: [], layMinisterAssigned: false, priestResponseStatus: "PENDING" };
const templates = [
  { ...base, id: 1, dayType: "SUNDAY", timeSlot: "05:00 AM", label: "Sunday Early Mass", assignedPriest: { fullName: "Vinz Avila" } },
  { ...base, id: 2, dayType: "WEEKDAY", timeSlot: "05:15 PM", label: "Evening Mass", assignedPriest: { fullName: priest } },
];
function fixture() {
  const queries = [];
  const db = {
    parish: { findMany: async () => [parish], findUnique: async () => parish },
    parishEvent: { findMany: async () => [] },
    massScheduleTemplate: { findMany: async args => { queries.push(args); return structuredClone(templates); } },
  };
  const registry = new LiveToolRegistry({ prismaClient: db, now: () => now });
  const router = new LiveToolRouter({ registry, prismaClient: db, now: () => now, responseComposerFactory: () => null });
  return { db, registry, router, queries };
}
const proposal = (entities = {}, usesPreviousContext = false) => ({ route: "LIVE_TOOL", intent: TOOL_IDS.GET_MASS_PRIEST_ASSIGNMENTS, entities, usesPreviousContext });
const validate = (facts, answer, userMessage) => validateFactPreservation({ structuredFacts: facts, composedAnswer: answer, userMessage });

test("explicit Manila weekdays and local tomorrow expressions override conflicting semantic ISO dates", async () => {
  const { router } = fixture();
  for (const [phrase, date] of [["on Sunday", "2026-11-15"], ["this Sunday", "2026-11-15"], ["next Sunday", "2026-11-22"], ["Wednesday", "2026-11-18"], ["tomorrow", "2026-11-15"], ["bwas", "2026-11-15"], ["ugma", "2026-11-15"], ["sa Domingo", "2026-11-15"]]) {
    assert.equal(resolveManilaDate(phrase, now), date);
    const result = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: `Who is assigned to the 5 AM Mass ${phrase}?`, semanticProposal: proposal({ datePhrase: "2026-11-16", timePhrase: "5 AM" }) });
    assert.equal(result.executedParams.date, date, phrase);
    assert.equal(result.executedParams.timeSlot, "05:00 AM");
    if (date === "2026-11-18") assert.equal(result.liveData.massSchedules.length, 0);
    else {
      assert.equal(result.liveData.massSchedules[0].priestName, "Vinz Avila");
      assert.equal(result.liveData.massSchedules[0].assignmentStatus, "PENDING");
    }
  }
});

test("real service preserves pending Mass parameters, clears broad weekday filters, and finds Father Julius", async () => {
  const { db, router } = fixture();
  const interpretations = [
    proposal({ datePhrase: "2026-11-16", timePhrase: "5 AM" }),
    { ...proposal({ parishName: "St. Joseph", datePhrase: "2026-11-16", timePhrase: "7 AM" }, true), pendingRelation: "ANSWER_PENDING" },
    proposal({ datePhrase: "2026-11-16", timePhrase: "5 AM", priestName: "Old Priest" }, true),
    proposal({ priestName: "Father Julius", datePhrase: "2026-11-15", timePhrase: "5 AM" }, true),
    proposal({ datePhrase: "2026-11-20" }, true),
    proposal({ timePhrase: "5 PM", datePhrase: "2026-11-16", priestName: "Julius" }, true),
  ];
  const service = new ChatbotService({ isEnabled: true, prismaClient: db, liveToolRouter: router, semanticRouter: { interpret: async () => interpretations.shift() },
    contextManager: new ConversationContextManager(), aiQuotaTracker: { consume: () => ({ allowed: true }) }, logRepository: { logQuery: async () => {} } });
  const ask = question => service.handleQuery({ question, userId: 11, sessionId: "mass-fix" });
  const first = await ask("Who is assigned to Sunday's 5 AM Mass?");
  assert.equal(first.responseType, "CLARIFICATION");
  assert.equal(first.structuredClarification.collected.date, "2026-11-15");
  const clarified = await ask("At St. Joseph.");
  assert.match(clarified.answer, /Vinz Avila.*Pending/);
  assert.equal(clarified.conversationContext.lastDatePhrase, "2026-11-15");
  assert.equal(clarified.conversationContext.lastTimePhrase, "05:00 AM");
  const wednesday = await ask("How about Wednesday Masses?");
  assert.match(wednesday.answer, /05:15 PM/);
  assert.match(wednesday.answer, /Julius/);
  assert.equal(wednesday.conversationContext.lastTimePhrase, null);
  assert.equal(wednesday.conversationContext.lastPriestName, null);
  const julius = await ask("What Mass is Father Julius assigned to?");
  assert.equal(julius.liveData.massSchedules.length, 2);
  assert.equal(julius.conversationContext.lastDatePhrase, "2026-11-14");
  assert.equal(julius.conversationContext.lastEndDate, "2026-11-20");
  assert.equal(julius.conversationContext.lastTimePhrase, null);
  const friday = await ask("How about Friday?");
  assert.equal(friday.liveData.massSchedules.length, 1);
  assert.equal(friday.conversationContext.lastEndDate, null);
  assert.equal(friday.conversationContext.lastPriestName, "Julius");
  const evening = await ask("What about the evening Mass?");
  assert.equal(evening.liveData.massSchedules.length, 1);
  assert.equal(evening.liveData.massSchedules[0].timeSlot, "05:15 PM");
  assert.equal(evening.conversationContext.lastDatePhrase, "2026-11-20");
  assert.equal(evening.conversationContext.lastPriestName, "Julius");
});

test("parish correction after a completed lookup preserves Sunday and 5 AM despite semantic Monday", async () => {
  const { router } = fixture();
  const result = await router.validateAndExecute({ normalizedQuestion: "on St. Joseph I mean", semanticProposal: proposal({ parishName: "St. Joseph", datePhrase: "2026-11-16" }, true),
    conversationContext: { lastIntent: TOOL_IDS.GET_MASS_PRIEST_ASSIGNMENTS, lastDatePhrase: "2026-11-15", lastTimePhrase: "05:00 AM" } });
  assert.equal(result.executedParams.date, "2026-11-15");
  assert.match(result.answer, /Vinz Avila/);
});

test("public Mass questions use recurring assignments, never private availability or Wedding", async () => {
  const { router, queries } = fixture();
  for (const question of ["Who is assigned to the 5 AM Sunday Mass?", "Sino ang pari sa 5 AM misa sa Domingo?", "What are the Wednesday Masses at St. Joseph?", "Is Father Julius assigned to a Mass on Wednesday?"]) {
    const result = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: question, semanticProposal: { ...proposal({}), intent: TOOL_IDS.CHECK_PRIEST_AVAILABILITY } });
    assert.equal(result.executedParams.intentId, TOOL_IDS.GET_MASS_PRIEST_ASSIGNMENTS);
    assert.equal(result.liveData.massSchedules.length, 1);
  }
  assert.ok(queries.every(query => query.where.parishId === 1 && query.where.isActive));
  assert.equal(extractPriestReference("What Mass is Father Julius assigned to?"), "Julius");
  assert.equal(extractPriestReference("Is Rev. Fr. Julius L. Montaño available?"), "Julius L. Montaño");
});

test("empty schedules, time misses, priest misses and failed lookups stay distinct", async () => {
  const { registry, db, router } = fixture();
  assert.equal((await registry.getMassPriestAssignments({ parishId: 1, date: "2026-11-16" })).structuredFacts.resultCode, "NO_MASS_SCHEDULES");
  const timeMiss = await registry.getMassPriestAssignments({ parishId: 1, date: "2026-11-18", timeSlot: "5 AM" });
  assert.equal(timeMiss.structuredFacts.resultCode, "NO_TIME_MATCH");
  assert.match(timeMiss.answer, /Mass schedules exist/);
  assert.equal(validate(timeMiss.structuredFacts, "There are no Mass schedules."), false);
  assert.equal(validate(timeMiss.structuredFacts, "No time matched; Father Other is assigned, PENDING."), false);
  const priestMiss = await registry.getMassPriestAssignments({ parishId: 1, date: "2026-11-18", priestName: "Father Other" });
  assert.equal(priestMiss.structuredFacts.resultCode, "NO_PRIEST_ASSIGNMENT");
  const found = await registry.getMassPriestAssignments({ parishId: 1, date: "2026-11-18", priestName: "Father Julius", timeSlot: "5:15pm" });
  assert.equal(found.structuredFacts.massSchedules.length, 1);
  db.massScheduleTemplate.findMany = async () => { throw new Error("offline"); };
  const failed = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: "Who is assigned to Wednesday Mass?", semanticProposal: proposal() });
  assert.equal(failed.fallbackReason, "LIVE_DATA_UNAVAILABLE");
  assert.doesNotMatch(failed.answer, /no.*Mass/i);
});

test("natural current-day answers pass composition while wrong localized dates and yes/no claims fail", async () => {
  const facts = { currentClock: manilaClock(now) };
  for (const answer of ["Hindi, Sabado ngayon, November 14.", "Sabado ngayon.", "Saturday today, November 14, 2026.", "Sabado subong, Nobyembre 14.", "Sabado karon, 14 Nobyembre 2026.", "It's Saturday, not Sunday."]) assert.equal(validate(facts, answer), true, answer);
  for (const answer of ["Linggo ngayon.", "Sabado ngayon, November 16.", "Sabado ngayon, November 14, 2027.", "2026-11-16", "Sabado ngayon, 12:12.", "Yes, Saturday today."]) assert.equal(validate(facts, answer, "Sunday ba ngayon?"), false, answer);
  const composer = new CaloyResponseComposer({ now: () => now, client: { models: { generateContent: async () => ({ text: JSON.stringify({ answer: "Hindi, Sabado ngayon, November 14.", followUp: null }) }) } } });
  const result = await composer.compose({ responseType: "LIVE_DATA", structuredFacts: facts, userMessage: "Sunday ba ngayon?", fallbackAnswer: "FALLBACK" });
  assert.equal(result.composed, true);
  assert.equal(result.answer, "Hindi, Sabado ngayon, November 14.");
});

test("natural Mass prose preserves exact priest identity, normalized time, date and distinct acceptance status", () => {
  const mass = { date: "2026-11-18", timeSlot: "05:15 PM", priestName: priest, assignmentStatus: "PENDING" };
  const facts = { date: mass.date, massSchedules: [mass] };
  const good = `Sa Wednesday, November 18, 5:15 PM, si ${priest} ang naka-assign; nagaulat pa sang pagbaton, indi pa kumpirmado.`;
  assert.equal(validate(facts, good), true);
  for (const answer of [good.replace("November 18", "November 19"), good.replace("Wednesday", "Monday"), good.replace("5:15 PM", "5 PM"), good.replace(priest, "Father Other"), good.replace("nagaulat pa sang pagbaton, indi pa kumpirmado", "ACCEPTED and confirmed; PENDING")]) assert.equal(validate(facts, answer), false, answer);
  for (const [status, description] of [["ACCEPTED", "accepted"], ["REJECTED", "rejected; not a confirmed assignment"], ["WITHDRAWN", "withdrawn; not confirmed"]]) {
    assert.equal(validate({ ...facts, massSchedules: [{ ...mass, assignmentStatus: status }] }, `November 18, 5:15 PM: ${priest} — ${description}.`), true, status);
  }
  const two = { massSchedules: [mass, { ...mass, timeSlot: "07:00 PM", assignmentStatus: "ACCEPTED" }] };
  assert.equal(validate(two, `${good}\nNovember 18, 7 PM: ${priest}, accepted.`), true);
  assert.equal(validate(two, `${good}\nNovember 18, 7 PM: ${priest}, pending acceptance.`), false);
});

test("natural Mass and office replies survive the real composer with a mocked provider", async () => {
  const { db, registry } = fixture();
  let answer = "For Sunday's 5 AM Mass, Vinz Avila is assigned and pending acceptance, not confirmed.";
  const composer = new CaloyResponseComposer({ now: () => now, client: { models: { generateContent: async () => ({ text: JSON.stringify({ answer, followUp: null }) }) } } });
  const router = new LiveToolRouter({ registry, prismaClient: db, now: () => now, responseComposer: composer });
  const mass = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: "Who is assigned to Sunday's 5 AM Mass?", semanticProposal: proposal() });
  assert.equal(mass.answer, answer);
  answer = "Sirado ang opisina bwas suno sa weekly schedule.";
  const office = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: "bwas ya?", semanticProposal: { ...proposal({ datePhrase: "2026-11-16" }), intent: TOOL_IDS.GET_PARISH_OFFICE_INFO }, conversationContext: { languageStyle: "HILIGAYNON" } });
  assert.equal(office.answer, answer);
  const facts = await registry.getMassPriestAssignments({ parishId: 1, date: "2026-11-15", timeSlot: "5 AM" });
  assert.equal(validate(facts.structuredFacts, "Tomorrow, 5 AM: Vinz Avila, pending acceptance."), true);
  assert.equal(validate(facts.structuredFacts, "Today, 5 AM: Vinz Avila, pending acceptance."), false);
});

test("Mass filters do not leak from unrelated appointments, and private tools retain their intent", async () => {
  const { router } = fixture();
  const unrelated = await router.validateAndExecute({ selectedParishId: 1, normalizedQuestion: "Who is assigned to the 5 AM Mass?", semanticProposal: proposal({}, true), conversationContext: { lastIntent: TOOL_IDS.CHECK_PRIEST_AVAILABILITY, lastDatePhrase: "2026-11-15", lastTimePhrase: "02:00 PM", lastPriestName: "Old Priest" } });
  assert.equal(unrelated.clarificationType, "DATE");
  assert.equal(unrelated.structuredClarification.collected.priestName, null);
  const privateRouter = new LiveToolRouter({ registry: { getMyUpcomingSchedules: async ({ userId }) => ({ answer: `Owner ${userId}` }) }, responseComposerFactory: () => null });
  const owned = await privateRouter.validateAndExecute({ userId: 11, normalizedQuestion: "When is my Mass appointment?", semanticProposal: { intent: TOOL_IDS.GET_MY_UPCOMING_SCHEDULES, entities: {} } });
  assert.equal(owned.executedParams.intentId, TOOL_IDS.GET_MY_UPCOMING_SCHEDULES);
  assert.equal(owned.answer, "Owner 11");
  assert.equal(validate({ startDate: "2026-11-14", endDate: "2026-11-20", availableDates: ["2026-11-18"] }, "November 18 is available."), true);
});

test("closed Sunday fallback never adds unknown wording, and natural office replies distinguish all states", () => {
  const clock = manilaClock(now);
  const closed = { currentClock: clock, officeDays: [resolveOfficeDay(parish.officeHours, "2026-11-15", now)] };
  const fallback = localizedFactFallback(closed, "fallback", "bwas ya?", "HILIGAYNON");
  assert.match(fallback, /CLOSED/);
  assert.doesNotMatch(fallback, /mapat-od|UNKNOWN/);
  assert.equal(validate(closed, "Sirado ang opisina bwas suno sa weekly schedule."), true);
  assert.equal(validate(closed, "Closed tomorrow according to weekly hours. Holiday exceptions are not recorded."), true);
  assert.equal(validate(closed, "Sirado bwas; indi pa mapat-od."), false);
  assert.equal(validate(closed, "Abri ang opisina bwas."), false);
  const opened = { currentClock: clock, officeDays: [resolveOfficeDay(parish.officeHours, clock.date, now)] };
  assert.equal(validate(opened, "Abri ang opisina subong, 08:00 - 17:00 suno sa weekly hours."), true);
  assert.equal(validate(opened, "Abri subong, 09:00 - 17:00."), false);
  const late = new Date("2026-11-14T12:00:00Z");
  const closedNow = { currentClock: manilaClock(late), officeDays: [resolveOfficeDay(parish.officeHours, clock.date, late)] };
  assert.equal(validate(closedNow, "Sarado na ngayon; bukas ang opisina 08:00 - 17:00 sa Sabado."), true);
  assert.equal(validate(closedNow, "Abri subong."), false);
  const unknown = { currentClock: clock, officeDays: [resolveOfficeDay({}, clock.date, now)] };
  assert.equal(validate(unknown, "Indi pa mapat-od ang oras sang opisina."), true);
  assert.equal(validate(unknown, "Sirado subong."), false);
});

test("natural factual presentation is restricted to LIVE_DATA; default social policy is unchanged", () => {
  const normal = buildComposerSystemInstruction();
  assert.equal(buildComposerSystemInstruction({ naturalLiveFacts: false }), normal);
  assert.doesNotMatch(normal, /LIVE FACT PRESENTATION/);
  const live = buildComposerSystemInstruction({ naturalLiveFacts: true });
  assert.match(live, /LIVE FACT PRESENTATION/);
  assert.doesNotMatch(live, /Render each officeDays|Render each massSchedules/);
});
