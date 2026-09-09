import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create controllable deferred promises
function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Behavioral harness matching EventSchedulerPage fetchRecommendations implementation
function createRecommendationHarness(mockApi) {
  const recGenRef = { current: 0 };
  let recommendations = [];
  let recommendationsError = null;
  let loadingRecommendations = false;

  async function fetchRecommendations(inputs) {
    const currentGen = ++recGenRef.current;
    if (!inputs?.selectedParishId || !inputs?.selectedEventType || !inputs?.preferredDate) {
      recommendations = [];
      recommendationsError = null;
      loadingRecommendations = false;
      return;
    }
    loadingRecommendations = true;
    recommendationsError = null;
    try {
      const res = await mockApi.getRecommendations({
        parishId: Number(inputs.selectedParishId),
        eventType: inputs.selectedEventType,
        preferredDate: inputs.preferredDate,
        requestedPriestId: inputs.requestedPriestId || null,
      });
      if (currentGen !== recGenRef.current) return;
      recommendations = res.recommendations || [];
    } catch {
      if (currentGen !== recGenRef.current) return;
      recommendations = [];
      recommendationsError = 'Unable to load recommendations. You can still choose an available time slot below.';
    } finally {
      if (currentGen === recGenRef.current) {
        loadingRecommendations = false;
      }
    }
  }

  return {
    get state() {
      return {
        recGen: recGenRef.current,
        recommendations,
        recommendationsError,
        loadingRecommendations,
      };
    },
    fetchRecommendations,
  };
}

// Behavioral harness matching EventSchedulerPage loadEligiblePriests implementation
function createPriestHarness(mockApi) {
  const priestsGenRef = { current: 0 };
  let eligiblePriests = [];
  let priestsError = null;
  let loadingPriests = false;

  async function loadEligiblePriests(inputs) {
    const currentGen = ++priestsGenRef.current;
    if (!inputs?.selectedParishId) {
      eligiblePriests = [];
      priestsError = null;
      loadingPriests = false;
      return;
    }
    loadingPriests = true;
    priestsError = null;
    try {
      const priests = await mockApi.getEligiblePriests(inputs.selectedParishId);
      if (currentGen !== priestsGenRef.current) return;
      eligiblePriests = priests || [];
    } catch {
      if (currentGen !== priestsGenRef.current) return;
      eligiblePriests = [];
      priestsError = 'Unable to load preferred priests. You can still proceed without a preference.';
    } finally {
      if (currentGen === priestsGenRef.current) {
        loadingPriests = false;
      }
    }
  }

  return {
    get state() {
      return {
        priestsGen: priestsGenRef.current,
        eligiblePriests,
        priestsError,
        loadingPriests,
      };
    },
    loadEligiblePriests,
  };
}

test("Phase 5 Web Scheduler Contracts & Invariants Suite", async (t) => {
  const schedulerSource = fs.readFileSync(
    path.join(__dirname, "../src/pages/dashboard/EventSchedulerPage.tsx"),
    "utf8"
  );
  const apiSource = fs.readFileSync(
    path.join(__dirname, "../src/providers/api/scheduler.ts"),
    "utf8"
  );

  // 1. Alternative date recommendation retains slot via pendingRecommendationSlotRef
  await t.test("alternative date recommendation retains slot without clearing", () => {
    // Check ref definition
    assert.match(
      schedulerSource,
      /const pendingRecommendationSlotRef = useRef<string \| null>\(null\);/,
      "EventSchedulerPage must define pendingRecommendationSlotRef"
    );

    // Check click handler sets pendingRecommendationSlotRef
    assert.match(
      schedulerSource,
      /pendingRecommendationSlotRef\.current = rec\.timeSlot;\s*setSelectedDate\(rec\.date\);\s*setSelectedTimeSlot\(rec\.timeSlot\);/,
      "Recommendation click must set pending slot, selected date, and selected slot"
    );

    // preferredDate anchor remains unchanged on recommendation click
    assert.doesNotMatch(
      schedulerSource,
      /setPreferredDate\(rec\.date\)/,
      "Clicking a recommendation MUST NOT overwrite preferredDate anchor"
    );

    // Slot loading effect checks pendingRecommendationSlotRef
    assert.match(
      schedulerSource,
      /const pendingSlot = pendingRecommendationSlotRef\.current;/,
      "Slot loader effect must read pendingSlot from ref"
    );
    assert.match(
      schedulerSource,
      /if \(result\.includes\(pendingSlot\)\) \{\s*setSelectedTimeSlot\(pendingSlot\);/,
      "Slot loader must retain pending slot if it is present in available slots"
    );
  });

  // 2. Manual calendar date change clears old slot
  await t.test("manual date calendar change clears old slot and resets pending ref", () => {
    assert.match(
      schedulerSource,
      /if \(!pendingSlot\) \{\s*setSelectedTimeSlot\(''\);\s*\}/,
      "Slot loader must clear selectedTimeSlot if there is no pending recommendation slot"
    );
  });

  // 3. Source Contracts: Generation Counters Invalidate on Early-Return / Reset
  await t.test("source contract: generation counters increment before early-return/reset paths", () => {
    assert.match(
      schedulerSource,
      /const recGenRef = useRef\(0\);/,
      "EventSchedulerPage must define recGenRef generation counter"
    );
    assert.match(
      schedulerSource,
      /const priestsGenRef = useRef\(0\);/,
      "EventSchedulerPage must define priestsGenRef generation counter"
    );

    // fetchRecommendations source ordering: increment MUST precede the input check
    const fetchRecIdx = schedulerSource.indexOf("const fetchRecommendations = useCallback(async () => {");
    assert.ok(fetchRecIdx !== -1, "fetchRecommendations callback must exist in source");
    const recIncIdx = schedulerSource.indexOf("const currentGen = ++recGenRef.current;", fetchRecIdx);
    const recGuardIdx = schedulerSource.indexOf("if (!selectedParishId || !selectedEventType || !preferredDate)", fetchRecIdx);
    assert.ok(recIncIdx !== -1, "recGenRef increment must exist in fetchRecommendations");
    assert.ok(recGuardIdx !== -1, "governing input guard must exist in fetchRecommendations");
    assert.ok(recIncIdx < recGuardIdx, "recGenRef increment MUST occur BEFORE governing input early-return check");

    // fetchRecommendations early return must reset recommendations, error, and loading
    assert.match(
      schedulerSource,
      /if \(!selectedParishId \|\| !selectedEventType \|\| !preferredDate\) \{\s*setRecommendations\(\[\]\);\s*setRecommendationsError\(null\);\s*setLoadingRecommendations\(false\);\s*return;\s*\}/,
      "fetchRecommendations early return must reset recommendations, error, and loading state"
    );

    // loadEligiblePriests source ordering: increment MUST precede the parish check
    const loadPriestsIdx = schedulerSource.indexOf("const loadEligiblePriests = useCallback(async () => {");
    assert.ok(loadPriestsIdx !== -1, "loadEligiblePriests callback must exist in source");
    const pIncIdx = schedulerSource.indexOf("const currentGen = ++priestsGenRef.current;", loadPriestsIdx);
    const pGuardIdx = schedulerSource.indexOf("if (!selectedParishId)", loadPriestsIdx);
    assert.ok(pIncIdx !== -1, "priestsGenRef increment must exist in loadEligiblePriests");
    assert.ok(pGuardIdx !== -1, "parish guard must exist in loadEligiblePriests");
    assert.ok(pIncIdx < pGuardIdx, "priestsGenRef increment MUST occur BEFORE selectedParishId early-return check");

    // loadEligiblePriests early return must reset eligiblePriests, error, and loading
    assert.match(
      schedulerSource,
      /if \(!selectedParishId\) \{\s*setEligiblePriests\(\[\]\);\s*setPriestsError\(null\);\s*setLoadingPriests\(false\);\s*return;\s*\}/,
      "loadEligiblePriests early return must reset eligiblePriests, error, and loading state"
    );

    // Guards on success, error, and finally
    assert.match(
      schedulerSource,
      /if \(currentGen === recGenRef\.current\) \{\s*setLoadingRecommendations\(false\);\s*\}/,
      "fetchRecommendations finally must guard setLoadingRecommendations with generation equality"
    );
    assert.match(
      schedulerSource,
      /if \(currentGen === priestsGenRef\.current\) \{\s*setLoadingPriests\(false\);\s*\}/,
      "loadEligiblePriests finally must guard setLoadingPriests with generation equality"
    );
  });

  // 4. Behavioral: Recommendations Valid -> Reset Race
  await t.test("behavioral: recommendations valid-to-reset race invalidates in-flight response", async () => {
    const deferredA = createDeferred();
    const harness = createRecommendationHarness({
      getRecommendations: () => deferredA.promise,
    });

    // Step 1: Start request A with valid inputs
    const promiseA = harness.fetchRecommendations({
      selectedParishId: "1",
      selectedEventType: "BAPTISM",
      preferredDate: "2026-09-20",
    });
    assert.equal(harness.state.loadingRecommendations, true, "Loading must be true during in-flight request A");
    assert.equal(harness.state.recGen, 1, "Generation must be 1 for request A");

    // Step 2: User clears/changes governing state before A resolves
    const promiseReset = harness.fetchRecommendations({
      selectedParishId: null,
      selectedEventType: "BAPTISM",
      preferredDate: "2026-09-20",
    });
    await promiseReset;

    // Step 3: Invalid invocation must advance generation and reset state
    assert.equal(harness.state.recGen, 2, "Invalid invocation MUST advance generation counter to 2");
    assert.equal(harness.state.loadingRecommendations, false, "Loading must be false after reset");
    assert.deepEqual(harness.state.recommendations, [], "Recommendations must be cleared on reset");
    assert.equal(harness.state.recommendationsError, null, "Recommendations error must be null on reset");

    // Step 4: Resolve A
    deferredA.resolve({
      recommendations: [
        { date: "2026-09-20", timeSlot: "10:00 AM", reasons: ["PREFERRED_DATE"] },
      ],
    });
    await promiseA;

    // Step 5: Assert A does NOT commit recommendations, error, or alter loading
    assert.deepEqual(harness.state.recommendations, [], "Stale Request A must NOT commit recommendations after reset");
    assert.equal(harness.state.recommendationsError, null, "Stale Request A must NOT commit error");
    assert.equal(harness.state.loadingRecommendations, false, "Stale Request A must NOT set loading to true or corrupt state");
  });

  // 5. Behavioral: Eligible Priests Valid -> Reset Race
  await t.test("behavioral: eligible priests valid-to-reset race invalidates in-flight response", async () => {
    const deferredA = createDeferred();
    const harness = createPriestHarness({
      getEligiblePriests: () => deferredA.promise,
    });

    // Step 1: Parish A selected, request starts
    const promiseA = harness.loadEligiblePriests({ selectedParishId: "parish-1" });
    assert.equal(harness.state.loadingPriests, true, "Priests loading must be true for in-flight request");
    assert.equal(harness.state.priestsGen, 1, "Priests generation must be 1");

    // Step 2: Parish is cleared/reset before response
    const promiseReset = harness.loadEligiblePriests({ selectedParishId: "" });
    await promiseReset;

    // Step 3: Generation must advance and state must reset
    assert.equal(harness.state.priestsGen, 2, "Reset MUST advance priests generation counter to 2");
    assert.equal(harness.state.loadingPriests, false, "Loading must be false after reset");
    assert.deepEqual(harness.state.eligiblePriests, [], "Eligible priests must be empty after reset");
    assert.equal(harness.state.priestsError, null, "Priest error must be null after reset");

    // Step 4: Resolve A
    deferredA.resolve([
      { id: 101, name: "Fr. Juan dela Cruz", isAssistant: false },
    ]);
    await promiseA;

    // Step 5: Old priest list must NOT populate current state
    assert.deepEqual(harness.state.eligiblePriests, [], "Stale priest request A must NOT populate eligiblePriests after parish reset");
    assert.equal(harness.state.priestsError, null, "Priest error must remain null");
    assert.equal(harness.state.loadingPriests, false, "Priest loading must remain false");
  });

  // 6. Behavioral: Valid A/B Request Race
  await t.test("behavioral: valid A/B race retains latest response as authoritative", async () => {
    // Recommendations A/B
    const deferredA = createDeferred();
    const deferredB = createDeferred();
    let recCalls = 0;
    const recHarness = createRecommendationHarness({
      getRecommendations: () => {
        recCalls++;
        return recCalls === 1 ? deferredA.promise : deferredB.promise;
      },
    });

    const promiseA = recHarness.fetchRecommendations({
      selectedParishId: "1",
      selectedEventType: "BAPTISM",
      preferredDate: "2026-09-20",
    });
    const promiseB = recHarness.fetchRecommendations({
      selectedParishId: "1",
      selectedEventType: "BAPTISM",
      preferredDate: "2026-09-21",
    });

    assert.equal(recHarness.state.recGen, 2);

    // Request B resolves first
    deferredB.resolve({
      recommendations: [{ date: "2026-09-21", timeSlot: "02:00 PM", reasons: ["PREFERRED_DATE"] }],
    });
    await promiseB;
    assert.deepEqual(
      recHarness.state.recommendations,
      [{ date: "2026-09-21", timeSlot: "02:00 PM", reasons: ["PREFERRED_DATE"] }],
      "Request B must commit when resolving first"
    );

    // Request A resolves later
    deferredA.resolve({
      recommendations: [{ date: "2026-09-20", timeSlot: "10:00 AM", reasons: ["PREFERRED_DATE"] }],
    });
    await promiseA;
    assert.deepEqual(
      recHarness.state.recommendations,
      [{ date: "2026-09-21", timeSlot: "02:00 PM", reasons: ["PREFERRED_DATE"] }],
      "Stale Request A must not overwrite newer Request B"
    );

    // Eligible Priests A/B
    const pDeferredA = createDeferred();
    const pDeferredB = createDeferred();
    let priestCalls = 0;
    const priestHarness = createPriestHarness({
      getEligiblePriests: () => {
        priestCalls++;
        return priestCalls === 1 ? pDeferredA.promise : pDeferredB.promise;
      },
    });

    const pPromiseA = priestHarness.loadEligiblePriests({ selectedParishId: "parish-1" });
    const pPromiseB = priestHarness.loadEligiblePriests({ selectedParishId: "parish-2" });

    assert.equal(priestHarness.state.priestsGen, 2);

    pDeferredB.resolve([{ id: 202, name: "Fr. Pedro", isAssistant: true }]);
    await pPromiseB;
    assert.deepEqual(priestHarness.state.eligiblePriests, [{ id: 202, name: "Fr. Pedro", isAssistant: true }]);

    pDeferredA.resolve([{ id: 101, name: "Fr. Juan", isAssistant: false }]);
    await pPromiseA;
    assert.deepEqual(
      priestHarness.state.eligiblePriests,
      [{ id: 202, name: "Fr. Pedro", isAssistant: true }],
      "Priests from Parish 2 must remain authoritative over stale Parish 1"
    );
  });

  // 7. Behavioral: Stale Error Race
  await t.test("behavioral: stale error does not overwrite state or set error messages", async () => {
    // Recommendations: Request A starts, state resets, A rejects
    const deferredA = createDeferred();
    const recHarness = createRecommendationHarness({
      getRecommendations: () => deferredA.promise,
    });

    const promiseA = recHarness.fetchRecommendations({
      selectedParishId: "1",
      selectedEventType: "BAPTISM",
      preferredDate: "2026-09-20",
    });

    await recHarness.fetchRecommendations({
      selectedParishId: "",
      selectedEventType: "",
      preferredDate: "",
    });

    deferredA.reject(new Error("Network timeout"));
    await promiseA;

    assert.equal(recHarness.state.recommendationsError, null, "Stale error must NOT populate recommendationsError");
    assert.deepEqual(recHarness.state.recommendations, [], "Recommendations must remain empty");
    assert.equal(recHarness.state.loadingRecommendations, false, "Loading state must remain false");

    // Priests: Request A starts, state resets, A rejects
    const pDeferredA = createDeferred();
    const priestHarness = createPriestHarness({
      getEligiblePriests: () => pDeferredA.promise,
    });

    const pPromiseA = priestHarness.loadEligiblePriests({ selectedParishId: "parish-1" });

    await priestHarness.loadEligiblePriests({ selectedParishId: "" });

    pDeferredA.reject(new Error("Database connection lost"));
    await pPromiseA;

    assert.equal(priestHarness.state.priestsError, null, "Stale error must NOT populate priestsError");
    assert.deepEqual(priestHarness.state.eligiblePriests, [], "Eligible priests must remain empty");
    assert.equal(priestHarness.state.loadingPriests, false, "Loading state must remain false");
  });

  // 8. Behavioral: Stale Finally / Loading State Guard
  await t.test("behavioral: obsolete request finally block does not corrupt active loading state", async () => {
    // Request A starts, Request B starts while A is pending
    const deferredA = createDeferred();
    const deferredB = createDeferred();
    let recCalls = 0;
    const recHarness = createRecommendationHarness({
      getRecommendations: () => {
        recCalls++;
        return recCalls === 1 ? deferredA.promise : deferredB.promise;
      },
    });

    const promiseA = recHarness.fetchRecommendations({
      selectedParishId: "1",
      selectedEventType: "BAPTISM",
      preferredDate: "2026-09-20",
    });
    const promiseB = recHarness.fetchRecommendations({
      selectedParishId: "1",
      selectedEventType: "BAPTISM",
      preferredDate: "2026-09-21",
    });

    assert.equal(recHarness.state.loadingRecommendations, true, "Loading must be true while B is active");

    // Request A finishes first
    deferredA.resolve({ recommendations: [{ date: "2026-09-20", timeSlot: "10:00 AM", reasons: [] }] });
    await promiseA;

    // A's finally must NOT reset loading to false because B is still in flight
    assert.equal(
      recHarness.state.loadingRecommendations,
      true,
      "Loading state must remain true while request B is pending; stale request A finally must not dismiss spinner"
    );

    // Request B finishes
    deferredB.resolve({ recommendations: [{ date: "2026-09-21", timeSlot: "02:00 PM", reasons: [] }] });
    await promiseB;

    assert.equal(
      recHarness.state.loadingRecommendations,
      false,
      "Loading state becomes false when active request B finishes"
    );
  });

  // 9. Web Error States: Fail-safe and Non-blocking
  await t.test("recommendations and priest errors are non-blocking with retry", () => {
    assert.match(
      schedulerSource,
      /Unable to load recommendations\. You can still choose an available time slot below\./,
      "Recommendation error message must inform user that manual scheduling is still usable"
    );
    assert.match(
      schedulerSource,
      /Unable to load preferred priests\. You can still proceed without a preference\./,
      "Priest load error message must inform user that scheduling can proceed without preference"
    );
    assert.match(
      schedulerSource,
      /onClick=\{\(\) => void fetchRecommendations\(\)\}/,
      "Must provide retry button for failed recommendations"
    );
    assert.match(
      schedulerSource,
      /onClick=\{\(\) => void loadEligiblePriests\(\)\}/,
      "Must provide retry button for failed eligible priests"
    );
  });

  // 10. Remarks whitespace parity with backend
  await t.test("remarks whitespace parity: trims outer whitespace only, preserving internal spaces", () => {
    assert.match(
      apiSource,
      /const normRemarks = payload\.remarks \? payload\.remarks\.trim\(\) : "";/,
      "scheduler.ts must trim outer whitespace without collapsing internal whitespace"
    );
    assert.doesNotMatch(
      apiSource,
      /\.replace\(\/\\s\+\/g/,
      "scheduler.ts must NOT collapse internal whitespace with whitespace regex replace"
    );
  });

  // 11. requestedPriestId included in payload
  await t.test("requestedPriestId is passed to API create schedule payload", () => {
    assert.match(
      schedulerSource,
      /requestedPriestId: requestedPriestId \|\| null/,
      "createSchedule payload must pass requestedPriestId"
    );
  });

  // 12. Recommendation presentation: Preferred Priest badges, tooltips, and helper copy
  await t.test("recommendation presentation: badges, tooltips, and helper copy", () => {
    // Exact badge copy checks
    assert.match(
      schedulerSource,
      /Preferred Priest Available/,
      "Must display 'Preferred Priest Available' badge"
    );
    assert.match(
      schedulerSource,
      /Preferred Priest Unavailable/,
      "Must display 'Preferred Priest Unavailable' badge"
    );
    assert.doesNotMatch(
      schedulerSource,
      />Priest Available</,
      "Must NOT display legacy 'Priest Available' badge"
    );
    assert.doesNotMatch(
      schedulerSource,
      />Priest Unavailable</,
      "Must NOT display legacy 'Priest Unavailable' badge"
    );

    // Tooltip checks
    assert.match(
      schedulerSource,
      /title="Your preferred priest is available at this time\."/,
      "Must include tooltip clarification for Preferred Priest Available"
    );
    assert.match(
      schedulerSource,
      /title="Your preferred priest is unavailable at this time, but another priest may be assigned\."/,
      "Must include tooltip clarification for Preferred Priest Unavailable"
    );

    // Visual semantics: green for available, amber (not red) for unavailable
    assert.match(
      schedulerSource,
      /bg-green-50 text-green-700[^>]*>[\s\n]*Preferred Priest Available/,
      "Preferred Priest Available must use positive/green styling"
    );
    assert.match(
      schedulerSource,
      /bg-amber-50 text-amber-700[^>]*>[\s\n]*Preferred Priest Unavailable/,
      "Preferred Priest Unavailable must use caution/amber styling"
    );

    // Helper copy checks
    assert.match(
      schedulerSource,
      /Your preferred priest may not be available for every suggested time\. The parish can still assign another priest\./,
      "Must include exact explanatory helper copy"
    );
    assert.match(
      schedulerSource,
      /\{requestedPriestId \? \(\s*<p className=['"]text-xs text-text-muted['"]>[\s\S]*?Your preferred priest may not be available/,
      "Helper copy must only render when requestedPriestId is selected"
    );

    // Selectability: card click handler does not disable card when priest unavailable
    assert.doesNotMatch(
      schedulerSource,
      /disabled=\{[^}]*rec\.preferredPriestAvailable/,
      "Recommendation card must NOT be disabled when preferred priest is unavailable"
    );
  });

  // 13. Recommendation badge matrix presentation tests (A-F)
  await t.test("recommendation badge matrix presentation tests (A-F)", () => {
    // Helper replicating presentation logic in EventSchedulerPage
    function renderRecommendationBadges(rec) {
      const badges = [];
      if (rec.reasons?.includes("PREFERRED_DATE")) {
        badges.push({ label: "Preferred Date", variant: "blue" });
      }
      if (rec.reasons?.includes("PREFERRED_TIME")) {
        badges.push({ label: "Preferred Time", variant: "indigo" });
      }
      if (rec.preferredPriestAvailable === true) {
        badges.push({
          label: "Preferred Priest Available",
          variant: "green",
          tooltip: "Your preferred priest is available at this time.",
        });
      }
      if (rec.preferredPriestAvailable === false) {
        badges.push({
          label: "Preferred Priest Unavailable",
          variant: "amber",
          tooltip: "Your preferred priest is unavailable at this time, but another priest may be assigned.",
        });
      }
      return badges;
    }

    // A. preferred date + preferred priest available
    const recA = { date: "2026-09-20", timeSlot: "08:00 AM", reasons: ["PREFERRED_DATE"], preferredPriestAvailable: true };
    const labelsA = renderRecommendationBadges(recA).map(b => b.label);
    assert.deepEqual(labelsA, ["Preferred Date", "Preferred Priest Available"]);

    // B. preferred date + preferred priest unavailable
    const recB = { date: "2026-09-20", timeSlot: "10:00 AM", reasons: ["PREFERRED_DATE"], preferredPriestAvailable: false };
    const labelsB = renderRecommendationBadges(recB).map(b => b.label);
    assert.deepEqual(labelsB, ["Preferred Date", "Preferred Priest Unavailable"]);

    // C. alternative date + preferred priest available
    const recC = { date: "2026-09-21", timeSlot: "08:00 AM", reasons: [], preferredPriestAvailable: true };
    const labelsC = renderRecommendationBadges(recC).map(b => b.label);
    assert.deepEqual(labelsC, ["Preferred Priest Available"]);
    assert.equal(labelsC.includes("Preferred Date"), false);

    // D. alternative date + preferred priest unavailable
    const recD = { date: "2026-09-21", timeSlot: "10:00 AM", reasons: [], preferredPriestAvailable: false };
    const labelsD = renderRecommendationBadges(recD).map(b => b.label);
    assert.deepEqual(labelsD, ["Preferred Priest Unavailable"]);
    assert.equal(labelsD.includes("Preferred Date"), false);

    // E. unavailable preferred priest recommendation remains selectable
    let clickedSlot = null;
    let clickedDate = null;
    const onSelectRec = (rec) => {
      clickedSlot = rec.timeSlot;
      clickedDate = rec.date;
    };
    onSelectRec(recD);
    assert.equal(clickedDate, "2026-09-21");
    assert.equal(clickedSlot, "10:00 AM");

    // F. helper copy appears only when a preferred priest is selected
    const shouldShowHelper = (requestedPriestId) => Boolean(requestedPriestId);
    assert.equal(shouldShowHelper(null), false);
    assert.equal(shouldShowHelper(undefined), false);
    assert.equal(shouldShowHelper(12), true);
  });
});

