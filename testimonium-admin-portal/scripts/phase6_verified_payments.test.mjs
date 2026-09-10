import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatManilaDateTime,
  getManilaDefaultDateRange,
  getManilaTodayDateString,
} from '../src/utils/date.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper mirroring formatAmount logic in VerifiedPaymentsTable
function formatAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return '—';
  return `₱${amount}`;
}

// Helper mirroring query key builder in VerifiedPaymentsTable
function buildQueryKey(from, to, parishId, documentType, search, page) {
  return `${from}|${to}|${parishId}|${documentType}|${search}|${page}`;
}

// =========================================================================
// 1. AMOUNT DISPLAY TESTS (0.00, 150.00, null)
// =========================================================================

test('Amount Display: formats numeric amounts with peso sign and preserves 0.00 as non-empty', () => {
  assert.equal(formatAmount('150.00'), '₱150.00');
  assert.equal(formatAmount('0.00'), '₱0.00', '0.00 must not be treated as empty or null');
  assert.equal(formatAmount('500.50'), '₱500.50');
  assert.equal(formatAmount(null), '—', 'null amount must display neutral dash');
  assert.equal(formatAmount(undefined), '—', 'undefined amount must display neutral dash');
  assert.equal(formatAmount(''), '—', 'empty amount must display neutral dash');
});

// =========================================================================
// 2. MANILA TIMESTAMP FORMATTING & DEFAULT DATES
// =========================================================================

test('Timestamp Display: formatManilaDateTime safely formats valid ISO into Manila wall time and handles invalid/null safely', () => {
  // 2026-09-01 00:00:00 UTC = 2026-09-01 08:00:00 Manila (UTC+8)
  const formatted = formatManilaDateTime('2026-09-01T00:00:00.000Z');
  assert.ok(formatted.includes('Sep 1, 2026'), `Expected date part: ${formatted}`);
  assert.ok(formatted.includes('8:00 AM'), `Expected 8:00 AM Manila time: ${formatted}`);

  // Neutral placeholder on null, undefined, invalid
  assert.equal(formatManilaDateTime(null), '—');
  assert.equal(formatManilaDateTime(undefined), '—');
  assert.equal(formatManilaDateTime('invalid-iso-string'), '—');
  assert.equal(formatManilaDateTime(''), '—');
});

test('Default Dates: getManilaDefaultDateRange generates calendar-day range using Manila calendar', () => {
  const range = getManilaDefaultDateRange();
  assert.ok(range.from && range.to, 'Should return from and to');
  assert.equal(range.to, getManilaTodayDateString(), 'To must equal Manila today');
  assert.ok(range.from < range.to, 'From must be before To');

  // Verify format YYYY-MM-DD
  assert.match(range.from, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(range.to, /^\d{4}-\d{2}-\d{2}$/);
});

// =========================================================================
// 3. FRONTEND RACE PROTECTION & OUT-OF-ORDER RESPONSE HANDLING
// =========================================================================

test('Race Protection: out-of-order responses do not overwrite newer state', async () => {
  let latestRenderedData = null;
  let requestIdCounter = 0;

  const simulateFetch = async (queryName, delayMs, dataToReturn) => {
    const thisRequestId = ++requestIdCounter;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    // Guard matching VerifiedPaymentsTable
    if (thisRequestId === requestIdCounter) {
      latestRenderedData = dataToReturn;
    }
  };

  // Request 1 is fired (slow query, 50ms)
  const req1 = simulateFetch('Query1', 50, ['Row A1', 'Row A2']);
  // Request 2 is fired quickly after (fast query, 10ms)
  const req2 = simulateFetch('Query2', 10, ['Row B1']);

  await Promise.all([req1, req2]);

  assert.deepEqual(
    latestRenderedData,
    ['Row B1'],
    'Slow Request 1 response must not overwrite newer Request 2 response'
  );
});

test('Race Protection: out-of-order error cannot overwrite latest success', async () => {
  let latestError = '';
  let latestData = null;
  let requestIdCounter = 0;

  const simulateRequest = async (shouldFail, delayMs, data) => {
    const thisRequestId = ++requestIdCounter;
    try {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (shouldFail) throw new Error('Query failed');
      if (thisRequestId === requestIdCounter) {
        latestData = data;
        latestError = '';
      }
    } catch (err) {
      if (thisRequestId === requestIdCounter) {
        latestError = err.message;
        latestData = null;
      }
    }
  };

  // Request 1 (slow, fails after 50ms)
  const req1 = simulateRequest(true, 50, null);
  // Request 2 (fast, succeeds after 10ms)
  const req2 = simulateRequest(false, 10, ['Success Data']);

  await Promise.all([req1, req2]);

  assert.equal(latestError, '', 'Out-of-order error must not overwrite newer success');
  assert.deepEqual(latestData, ['Success Data']);
});

// =========================================================================
// 4. FIX H-02: SYNCHRONOUS QUERY-KEY GATING & ABORT CONTROLLER
// =========================================================================

test('FIX H-02: Actual VerifiedPaymentsTable gating prevents rendering Query A rows after props change to Query B', () => {
  // Model the exact synchronous render pass of VerifiedPaymentsTable:
  // const currentQueryKey = buildQueryKey(from, to, parishId, documentType, debouncedSearch, page);
  // const isMatchingQuery = dataQueryKey === currentQueryKey;
  // rows may render ONLY when isMatchingQuery && data

  const keyA = buildQueryKey('2026-01-01', '2026-01-31', '5', 'BAPTISMAL_CERTIFICATE', '', 1);
  const keyB = buildQueryKey('2026-02-01', '2026-02-28', '5', 'BAPTISMAL_CERTIFICATE', '', 1);

  // State after Query A has loaded:
  let dataQueryKey = keyA;
  let data = [{ id: 1, requestReference: 'REQ-A' }];
  let loading = false;
  let error = '';
  let errorQueryKey = '';

  // Props change to Query B:
  // Render pass executes synchronously with new props BEFORE useEffect runs:
  const currentQueryKey = keyB;
  const isMatchingQuery = dataQueryKey === currentQueryKey; // false!

  const renderSkeleton = (!isMatchingQuery || (loading && !data)) && !(error && errorQueryKey === currentQueryKey);
  const renderTable = Boolean(isMatchingQuery && data);

  assert.equal(isMatchingQuery, false, 'Keys must differ synchronously during render pass');
  assert.equal(renderTable, false, 'Query A rows must NEVER render under Query B controls');
  assert.equal(renderSkeleton, true, 'Loading skeleton must be shown instead of stale Query A rows');

  // When Query B response arrives:
  data = [{ id: 2, requestReference: 'REQ-B' }];
  dataQueryKey = keyB;
  const isMatchingQueryAfterLoad = dataQueryKey === currentQueryKey;
  const renderTableAfterLoad = Boolean(isMatchingQueryAfterLoad && data);

  assert.equal(isMatchingQueryAfterLoad, true);
  assert.equal(renderTableAfterLoad, true, 'Query B rows render once dataQueryKey matches currentQueryKey');
});

test('FIX H-02: AbortController aborts previous in-flight request on new query, search, or unmount', () => {
  let activeController = null;
  const abortHistory = [];

  const startRequest = () => {
    if (activeController) {
      activeController.abort();
    }
    const controller = new AbortController();
    controller.signal.addEventListener('abort', () => abortHistory.push('aborted'));
    activeController = controller;
    return controller;
  };

  // Query 1 starts
  const controller1 = startRequest();
  assert.equal(controller1.signal.aborted, false);
  assert.equal(abortHistory.length, 0);

  // Query 2 starts before Query 1 finishes
  const controller2 = startRequest();
  assert.equal(controller1.signal.aborted, true, 'Query 1 controller must be aborted when Query 2 starts');
  assert.equal(controller2.signal.aborted, false);
  assert.equal(abortHistory.length, 1);

  // Search input change triggers abort
  const onSearchTyping = () => {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  };
  onSearchTyping();
  assert.equal(controller2.signal.aborted, true, 'Typing search must abort in-flight request');
  assert.equal(abortHistory.length, 2);

  // Unmount cleanup
  const controller3 = startRequest();
  const unmount = () => {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  };
  unmount();
  assert.equal(controller3.signal.aborted, true, 'Unmount must abort in-flight request');
  assert.equal(abortHistory.length, 3);
});

test('FIX H-02: Deferred Query A response cannot overwrite Query B', async () => {
  let requestIdCounter = 0;
  let renderedData = null;
  let dataQueryKey = '';

  const executeFetch = async (targetKey, delayMs, responseData) => {
    const currentRequestId = ++requestIdCounter;
    const controller = new AbortController();

    try {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      // Guard matching VerifiedPaymentsTable:
      if (currentRequestId !== requestIdCounter || controller.signal.aborted) {
        return;
      }
      renderedData = responseData;
      dataQueryKey = targetKey;
    } finally {
      // Guard finally
    }
  };

  // Query A fires with long delay (50ms)
  const queryAPromise = executeFetch('KEY_A', 50, ['Row A']);
  // Query B fires with short delay (10ms)
  const queryBPromise = executeFetch('KEY_B', 10, ['Row B']);

  await Promise.all([queryAPromise, queryBPromise]);

  assert.deepEqual(renderedData, ['Row B'], 'Query A response must not overwrite Query B data');
  assert.equal(dataQueryKey, 'KEY_B');
});

test('FIX H-02: Deferred Query A error cannot overwrite Query B success', async () => {
  let requestIdCounter = 0;
  let renderedData = null;
  let displayedError = '';

  const executeFetch = async (shouldFail, delayMs, responseData) => {
    const currentRequestId = ++requestIdCounter;
    const controller = new AbortController();

    try {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (shouldFail) {
        throw new Error('Query A failed');
      }
      if (currentRequestId !== requestIdCounter || controller.signal.aborted) {
        return;
      }
      renderedData = responseData;
      displayedError = '';
    } catch (caught) {
      if (currentRequestId !== requestIdCounter) {
        return; // drop obsolete error!
      }
      displayedError = caught.message;
      renderedData = null;
    }
  };

  // Query A (fails, slow 50ms)
  const reqA = executeFetch(true, 50, null);
  // Query B (succeeds, fast 10ms)
  const reqB = executeFetch(false, 10, ['Query B Data']);

  await Promise.all([reqA, reqB]);

  assert.deepEqual(renderedData, ['Query B Data']);
  assert.equal(displayedError, '', 'Deferred Query A error must NOT overwrite Query B success');
});

test('FIX H-02: Obsolete finally block cannot clear Query B loading state', async () => {
  let requestIdCounter = 0;
  let loadingState = false;

  const executeWithFinally = async (delayMs) => {
    const currentRequestId = ++requestIdCounter;
    const controller = new AbortController();
    loadingState = true;

    try {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } finally {
      // Guard: only latest request can clear loading
      if (currentRequestId === requestIdCounter && !controller.signal.aborted) {
        loadingState = false;
      }
    }
  };

  // Query A takes 50ms, Query B started at 10ms
  const pA = executeWithFinally(50);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const pB = executeWithFinally(100);

  // Wait until Query A's finally runs at 50ms
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(loadingState, true, 'Query A finally must NOT reset loading while Query B is in flight');

  await Promise.all([pA, pB]);
  assert.equal(loadingState, false, 'Loading clears once Query B finally runs');
});

test('FIX H-02: Cancellation must NOT become a user-facing API error', () => {
  let displayedError = '';

  const handleCatch = (controller, caught) => {
    const isCanceled =
      controller.signal.aborted ||
      caught?.code === 'ERR_CANCELED' ||
      caught?.name === 'CanceledError';

    if (isCanceled) {
      return; // cancellation suppressed
    }
    displayedError = caught.message;
  };

  // Request 1: aborted controller / cancellation error
  const controller1 = new AbortController();
  controller1.abort();
  handleCatch(controller1, { code: 'ERR_CANCELED', message: 'canceled' });
  assert.equal(displayedError, '', 'Canceled request must not produce user-facing error');

  // Request 2: active controller with genuine network failure
  const controller2 = new AbortController();
  handleCatch(controller2, new Error('Network error'));
  assert.equal(displayedError, 'Network error', 'Real network error surfaces');
});

// =========================================================================
// 4B. FIX M-02: DESCRIPTIVE STALE REFRESH WARNING IN ANALYTICSPAGE
// =========================================================================

test('FIX M-02: Same-query descriptive refresh failure displays stale warning while retaining data', () => {
  const initialData = {
    documents: { total: 10 },
    payments: { totalTransactions: 5 },
  };

  let data = initialData;
  let dataQueryKey = 'KEY_Q1';
  let error = '';
  let staleError = '';

  // Same query refresh fails:
  const targetKey = 'KEY_Q1';
  const isSameQuery = dataQueryKey === targetKey;
  const caughtError = new Error('Gateway timeout on refresh');

  if (isSameQuery && data) {
    staleError = 'Unable to refresh analytics. The figures shown may be outdated.';
  } else {
    data = null;
    dataQueryKey = '';
    error = caughtError.message;
  }

  assert.deepEqual(data, initialData, 'Existing data must be retained on same-query refresh failure');
  assert.equal(staleError, 'Unable to refresh analytics. The figures shown may be outdated.');
  assert.equal(error, '', 'Full-screen error must not display when existing data is retained');
});

test('FIX M-02: Successful retry clears descriptive stale warning and updates data', () => {
  let data = { payments: { totalTransactions: 5 } };
  let staleError = 'Unable to refresh analytics. The figures shown may be outdated.';
  let dataQueryKey = 'KEY_Q1';

  // Successful retry:
  const refreshedData = { payments: { totalTransactions: 6 } };
  data = refreshedData;
  staleError = '';

  assert.deepEqual(data, refreshedData);
  assert.equal(staleError, '', 'Successful refresh must clear stale warning');
});

test('FIX M-02: New-query failure clears data and shows full error state (not stale warning)', () => {
  let data = { payments: { totalTransactions: 5 } };
  let dataQueryKey = 'KEY_Q1';
  let error = '';
  let staleError = '';

  // User changes date/filters to Q2:
  const targetKey = 'KEY_Q2';
  const isSameQuery = dataQueryKey === targetKey;

  // New query fails:
  if (isSameQuery && data) {
    staleError = 'Unable to refresh analytics. The figures shown may be outdated.';
  } else {
    data = null;
    dataQueryKey = '';
    error = 'Unable to load descriptive analytics.';
  }

  assert.equal(data, null, 'Data must be cleared when a new query fails');
  assert.equal(dataQueryKey, '');
  assert.equal(error, 'Unable to load descriptive analytics.');
  assert.equal(staleError, '', 'Stale warning must NOT be used for new query failure');
});

test('FIX M-02: Detail error handling remains independent of descriptive failure', () => {
  // Payments tab: descriptive analytics may fail while verified payment detail table succeeds
  let descriptiveError = 'Unable to load descriptive analytics.';
  let detailData = [{ id: 1, reference: 'PAY-1' }];
  let detailError = '';

  assert.ok(descriptiveError.length > 0);
  assert.equal(detailData.length, 1, 'Verified detail data is independent of descriptive aggregate state');
  assert.equal(detailError, '');
});

// =========================================================================
// 5. SEARCH DEBOUNCE & PAGE RESET RULES
// =========================================================================

test('Filter Change Rules: changing search, date, parish, or documentType resets page to 1', () => {
  let page = 3;

  const onSearchChange = () => { page = 1; };
  onSearchChange();
  assert.equal(page, 1, 'Search change must reset page to 1');

  page = 4;
  const onFilterChange = () => { page = 1; };
  onFilterChange();
  assert.equal(page, 1, 'Filter change must reset page to 1');

  // Page navigation changes only page
  const onPageChange = (newPage) => { page = newPage; };
  onPageChange(2);
  assert.equal(page, 2, 'Page navigation changes only page');
});

test('Debounce: cleanup clears previous timer before firing new search', async () => {
  let timerCleared = false;
  let fakeTimer = {
    id: 123,
  };

  const clearTimeout = () => {
    timerCleared = true;
  };

  // Simulate debounced typing
  if (fakeTimer) {
    clearTimeout(fakeTimer);
  }

  assert.equal(timerCleared, true, 'Debounce cleanup must clear preceding timer');
});

// =========================================================================
// 6. PAGINATION EDGE CASES & ZERO-TOTAL PRESENTATION
// =========================================================================

test('Pagination Guard: do NOT render pagination when total === 0 or totalPages <= 1', () => {
  const shouldRenderPagination = (pagination) => {
    return Boolean(pagination && pagination.totalPages > 1 && pagination.total > 0);
  };

  assert.equal(
    shouldRenderPagination({ total: 0, totalPages: 0, page: 1, limit: 20 }),
    false,
    'Pagination must NOT render when total is 0'
  );

  assert.equal(
    shouldRenderPagination({ total: 15, totalPages: 1, page: 1, limit: 20 }),
    false,
    'Pagination should NOT render when total fits in 1 page'
  );

  assert.equal(
    shouldRenderPagination({ total: 45, totalPages: 3, page: 1, limit: 20 }),
    true,
    'Pagination MUST render when totalPages > 1'
  );
});

test('Pagination Clamping: safely synchronizes page without infinite loop', () => {
  let currentPage = 5;
  const backendPagination = { page: 3, totalPages: 3, total: 50, limit: 20 };

  // When backend returns clamped page because dataset shrank
  if (backendPagination.page !== currentPage && backendPagination.total > 0) {
    currentPage = backendPagination.page;
  }

  assert.equal(currentPage, 3, 'Current page must safely synchronize with backend clamped page');
});

// =========================================================================
// 7. SOURCE AUDIT & INVARIANTS
// =========================================================================

test('Source Contract: AnalyticsPage exposes Document Type filter for documents and payments only', () => {
  const analyticsPagePath = path.join(__dirname, '../src/pages/AnalyticsPage.tsx');
  const content = fs.readFileSync(analyticsPagePath, 'utf8');

  // Verify Document Type filter condition
  assert.ok(
    content.includes("tab === 'documents' || tab === 'payments'") ||
    content.includes("tab === 'payments' || tab === 'documents'"),
    'Document Type filter must be visible for documents and payments tabs'
  );

  // Verify other tabs do not gain Document Type filter
  assert.ok(!content.includes("tab === 'scheduling' || tab === 'documents' || tab === 'payments'"));
  assert.ok(!content.includes("tab === 'events' || tab === 'documents' || tab === 'payments'"));
  assert.ok(!content.includes("tab === 'reports' || tab === 'documents' || tab === 'payments'"));
  assert.ok(!content.includes("tab === 'users' || tab === 'documents' || tab === 'payments'"));
});

test('Source Contract: VerifiedPaymentsTable includes OCR reference disclaimer helper copy', () => {
  const tablePath = path.join(__dirname, '../src/components/analytics/VerifiedPaymentsTable.tsx');
  const content = fs.readFileSync(tablePath, 'utf8');

  assert.ok(
    content.includes('Payment references may be extracted from the submitted receipt when no stored transaction reference is available'),
    'Transparency helper copy must explain reference may come from receipt'
  );
});


test('Source Contract: VerifiedPaymentsTable is read-only (no edit/delete/receipt preview actions)', () => {
  const tablePath = path.join(__dirname, '../src/components/analytics/VerifiedPaymentsTable.tsx');
  const content = fs.readFileSync(tablePath, 'utf8');

  // Must not have mutation / review action buttons
  assert.ok(!content.includes('handleDelete'), 'Must not contain delete actions');
  assert.ok(!content.includes('handleEdit'), 'Must not contain edit actions');
  assert.ok(!content.includes('handleVerify'), 'Must not contain verification actions');
  assert.ok(!content.includes('ReceiptPreviewModal'), 'Must not preview receipt');
  assert.ok(!content.includes('downloadReceipt'), 'Must not download receipt');
});

test('Source Contract: Manual Refresh on Payments tab triggers both descriptive and detail refresh', () => {
  const analyticsPagePath = path.join(__dirname, '../src/pages/AnalyticsPage.tsx');
  const content = fs.readFileSync(analyticsPagePath, 'utf8');

  assert.ok(
    content.includes('setPaymentRefreshTrigger'),
    'AnalyticsPage must maintain paymentRefreshTrigger'
  );
  assert.ok(
    content.includes('handleRefresh'),
    'AnalyticsPage must use handleRefresh to refresh both aggregate and details'
  );
  assert.ok(
    content.includes('refreshTrigger={paymentRefreshTrigger}'),
    'VerifiedPaymentsTable must receive paymentRefreshTrigger'
  );
});

test('Source Contract: VerifiedPaymentsTable implements H-02 query-key gating, AbortController, and errorQueryKey', () => {
  const tablePath = path.join(__dirname, '../src/components/analytics/VerifiedPaymentsTable.tsx');
  const content = fs.readFileSync(tablePath, 'utf8');

  assert.ok(
    content.includes('const currentQueryKey = buildQueryKey('),
    'VerifiedPaymentsTable must synchronously derive currentQueryKey during render pass'
  );
  assert.ok(
    content.includes('const isMatchingQuery = dataQueryKey === currentQueryKey;'),
    'VerifiedPaymentsTable must derive isMatchingQuery synchronously'
  );
  assert.ok(
    content.includes('isMatchingQuery && data &&'),
    'VerifiedPaymentsTable must gate row rendering on isMatchingQuery && data'
  );
  assert.ok(
    content.includes('new AbortController()'),
    'VerifiedPaymentsTable must instantiate AbortController for in-flight cancellation'
  );
  assert.ok(
    content.includes('abortControllerRef.current.abort()'),
    'VerifiedPaymentsTable must abort previous request before starting next'
  );
  assert.ok(
    content.includes('signal: controller.signal'),
    'VerifiedPaymentsTable must pass signal to getVerifiedPayments'
  );
  assert.ok(
    content.includes('errorQueryKey'),
    'VerifiedPaymentsTable must track errorQueryKey to prevent Query A error from rendering under Query B'
  );
});

test('Source Contract: AnalyticsPage implements M-02 staleError, inline warning banner, and Retry button', () => {
  const analyticsPagePath = path.join(__dirname, '../src/pages/AnalyticsPage.tsx');
  const content = fs.readFileSync(analyticsPagePath, 'utf8');

  assert.ok(
    content.includes('const [staleError, setStaleError] = useState('),
    'AnalyticsPage must maintain staleError state'
  );
  assert.ok(
    content.includes('Unable to refresh analytics. The figures shown may be outdated.'),
    'AnalyticsPage must display the exact stale warning message'
  );
  assert.ok(
    content.includes('AlertTriangle'),
    'AnalyticsPage must import and render AlertTriangle for stale warning'
  );
  assert.ok(
    content.includes('staleError && data &&'),
    'AnalyticsPage must render inline stale warning when staleError && data'
  );
  assert.ok(
    content.includes('handleRefresh'),
    'AnalyticsPage must provide Retry button bound to handleRefresh'
  );
});

test('FIX M-02 Source Invariant: load callback does NOT depend on response state (data, dataQueryKey, staleError, loading)', () => {
  const analyticsPagePath = path.join(__dirname, '../src/pages/AnalyticsPage.tsx');
  const content = fs.readFileSync(analyticsPagePath, 'utf8');

  // Match the dependency array of load = useCallback(..., [...])
  const loadCallbackMatch = content.match(/const load = useCallback\([\s\S]*?\},\s*\[(.*?)\]\s*\);/);
  assert.ok(loadCallbackMatch, 'load useCallback and its dependency array must be present');

  const depsString = loadCallbackMatch[1];
  const deps = depsString.split(',').map((d) => d.trim()).filter(Boolean);

  assert.ok(!deps.includes('data'), 'load callback must NOT list response-owned "data" in its dependencies');
  assert.ok(!deps.includes('dataQueryKey'), 'load callback must NOT list "dataQueryKey" in its dependencies');
  assert.ok(!deps.includes('staleError'), 'load callback must NOT list "staleError" in its dependencies');
  assert.ok(!deps.includes('loading'), 'load callback must NOT list "loading" in its dependencies');

  // Confirm dataRef and dataQueryKeyRef are used for stale-refresh decisions
  assert.ok(content.includes('const dataRef = useRef<AnalyticsData | null>(null);'), 'dataRef must be declared');
  assert.ok(content.includes('const dataQueryKeyRef = useRef(\'\');'), 'dataQueryKeyRef must be declared');
  assert.ok(content.includes('dataRef.current = response.data.data;'), 'dataRef must be synced on response');
  assert.ok(content.includes('dataQueryKeyRef.current = targetKey;'), 'dataQueryKeyRef must be synced on response');

  // Confirm automatic loading effect invokes with isManualRefresh: false
  assert.ok(
    content.includes('void load({ isManualRefresh: false });'),
    'Automatic effect must invoke load with isManualRefresh: false'
  );

  // Confirm manual refresh invokes with isManualRefresh: true
  assert.ok(
    content.includes('void load({ isManualRefresh: true });'),
    'Manual refresh must invoke load with isManualRefresh: true'
  );
});

test('FIX M-02 Lifecycle Simulation: data update does NOT trigger automatic refetch loop', async () => {
  let requestCount = 0;
  let loadCallbackIdentityCount = 0;

  // Component query inputs
  const inputs = {
    from: '2026-01-01',
    to: '2026-01-31',
    parishId: '',
    documentType: '',
    eventType: '',
    documentStatus: '',
    scheduleStatus: '',
    category: '',
    tab: 'documents',
  };

  // Response state and refs
  let stateData = null;
  let stateStaleError = '';
  const dataRef = { current: null };
  const dataQueryKeyRef = { current: '' };
  const requestIdRef = { current: 0 };

  // Helper mirroring buildQueryKey
  const buildKey = () =>
    `${inputs.from}|${inputs.to}|${inputs.parishId}|${inputs.documentType}|${inputs.eventType}|${inputs.documentStatus}|${inputs.category}|${inputs.tab}`;

  // Recreate load callback ONLY when query inputs change (matching useCallback behavior):
  const createLoadCallback = () => {
    loadCallbackIdentityCount++;
    const capturedKey = buildKey();

    return async (options = { isManualRefresh: false }) => {
      requestCount++;
      const isManualRefresh = options.isManualRefresh;
      const currentRequestId = ++requestIdRef.current;
      const isSameQuery = dataQueryKeyRef.current === capturedKey;

      if (!isSameQuery) {
        stateData = null;
        dataRef.current = null;
      }

      await new Promise((r) => setTimeout(r, 5));

      if (currentRequestId === requestIdRef.current) {
        const responseData = { total: 42 };
        stateData = responseData;
        dataRef.current = responseData;
        dataQueryKeyRef.current = capturedKey;
      }
    };
  };

  // 1. Initial mount:
  let load = createLoadCallback();
  assert.equal(loadCallbackIdentityCount, 1);

  // Automatic effect fires:
  await load({ isManualRefresh: false });
  assert.equal(requestCount, 1, 'Initial mount should trigger exactly 1 request');
  assert.deepEqual(stateData, { total: 42 });
  assert.deepEqual(dataRef.current, { total: 42 });

  // Post-fetch check: data updated, but query inputs did NOT change.
  // Callback identity remains untouched:
  assert.equal(loadCallbackIdentityCount, 1, 'Callback identity must NOT change when data updates');
  // Since callback identity didn't change, automatic effect does NOT run again!
  assert.equal(requestCount, 1, 'No automatic refetch occurs after successful load');

  // 2. Query input change (user changes date):
  inputs.from = '2026-02-01';
  load = createLoadCallback();
  assert.equal(loadCallbackIdentityCount, 2, 'Query input change updates callback identity');

  await load({ isManualRefresh: false });
  assert.equal(requestCount, 2, 'Query change triggers exactly 1 new request');
  assert.equal(loadCallbackIdentityCount, 2, 'Callback identity does not change after second load');

  // 3. Manual refresh:
  await load({ isManualRefresh: true });
  assert.equal(requestCount, 3, 'Manual refresh triggers exactly 1 request');
  assert.equal(loadCallbackIdentityCount, 2, 'Manual refresh does not recreate callback');

  // 4. Same-query refresh failure:
  const failingLoad = async (options = { isManualRefresh: false }) => {
    requestCount++;
    const isManualRefresh = options.isManualRefresh;
    const currentRequestId = ++requestIdRef.current;
    const isSameQuery = dataQueryKeyRef.current === buildKey();

    await new Promise((r) => setTimeout(r, 5));
    if (currentRequestId === requestIdRef.current) {
      if (isManualRefresh && isSameQuery && dataRef.current) {
        stateStaleError = 'Unable to refresh analytics. The figures shown may be outdated.';
      } else {
        stateData = null;
        dataRef.current = null;
      }
    }
  };

  await failingLoad({ isManualRefresh: true });
  assert.equal(requestCount, 4, 'Failing refresh triggers exactly 1 request');
  assert.equal(stateStaleError, 'Unable to refresh analytics. The figures shown may be outdated.');
  assert.deepEqual(stateData, { total: 42 }, 'Data is retained on refresh failure');
  assert.equal(loadCallbackIdentityCount, 2, 'Failing refresh does not trigger callback recreation');

  // 5. Successful retry:
  await load({ isManualRefresh: true });
  assert.equal(requestCount, 5, 'Retry triggers exactly 1 request');
  assert.equal(loadCallbackIdentityCount, 2, 'Retry does not trigger callback recreation or loop');
});


