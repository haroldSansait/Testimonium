// Unit test suite for Scheduling Availability Helpers and State Transition Logic

import {
  CANONICAL_SCHEDULING_SERVICES,
  areParishRulesEqual,
  areServiceRulesEqual,
  isWeeklyAvailabilityDirty,
  isDateExceptionDraftActive,
  formatFriendlyDate,
} from '../schedulingAvailabilityHelpers.ts';

function runTests() {
  console.log('--- Running Scheduling Availability Helpers Unit Tests ---');

  // Test 1: Canonical 16 services
  console.assert(CANONICAL_SCHEDULING_SERVICES.length === 16, 'Must contain exactly 16 services');
  const expectedServices = [
    'WEDDING', 'MARRIAGE_SPECIAL', 'BAPTISM', 'CONFIRMATION',
    'FIRST_COMMUNION', 'CONFESSION', 'ANOINTING_OF_THE_SICK', 'PRIVATE_MASS',
    'MASS_INTENTION', 'WAKE_MASS', 'FUNERAL', 'MASS_OF_HOLY_SPIRIT',
    'FIESTA', 'THANKSGIVING', 'BLESSING', 'DELIVERANCE'
  ];
  for (const id of expectedServices) {
    const found = CANONICAL_SCHEDULING_SERVICES.find(s => s.id === id);
    console.assert(Boolean(found), `Service ${id} must exist in canonical list`);
  }
  console.log('✓ Test 1: 16 Canonical ScheduleEventType values and labels verified');

  // Test 2: Parish rules equality and normalization
  const baseParishRules = [
    { weekday: 'MONDAY', isAvailable: true },
    { weekday: 'TUESDAY', isAvailable: true },
    { weekday: 'WEDNESDAY', isAvailable: true },
    { weekday: 'THURSDAY', isAvailable: true },
    { weekday: 'FRIDAY', isAvailable: true },
    { weekday: 'SATURDAY', isAvailable: true },
    { weekday: 'SUNDAY', isAvailable: false },
  ];

  // Same content, different order
  const shuffledParishRules = [
    { weekday: 'SUNDAY', isAvailable: false },
    { weekday: 'FRIDAY', isAvailable: true },
    { weekday: 'MONDAY', isAvailable: true },
    { weekday: 'WEDNESDAY', isAvailable: true },
    { weekday: 'TUESDAY', isAvailable: true },
    { weekday: 'THURSDAY', isAvailable: true },
    { weekday: 'SATURDAY', isAvailable: true },
  ];

  console.assert(areParishRulesEqual(baseParishRules, shuffledParishRules) === true, 'Order-independent parish rules comparison');

  const modifiedParishRules = baseParishRules.map(r => r.weekday === 'TUESDAY' ? { ...r, isAvailable: false } : r);
  console.assert(areParishRulesEqual(baseParishRules, modifiedParishRules) === false, 'Toggling Tuesday detects difference');
  console.log('✓ Test 2: Parish weekday rules order-independent equality verified');

  // Test 3: Service overrides equality and normalization
  const baseServiceRules = [
    { eventType: 'WEDDING', weekday: 'SUNDAY', isAvailable: false },
    { eventType: 'BAPTISM', weekday: 'SATURDAY', isAvailable: true },
  ];

  const shuffledServiceRules = [
    { eventType: 'BAPTISM', weekday: 'SATURDAY', isAvailable: true },
    { eventType: 'WEDDING', weekday: 'SUNDAY', isAvailable: false },
  ];

  console.assert(areServiceRulesEqual(baseServiceRules, shuffledServiceRules) === true, 'Order-independent service rules comparison');

  const modifiedServiceRules = [
    { eventType: 'BAPTISM', weekday: 'SATURDAY', isAvailable: true },
    // Wedding Sunday removed (Inherit)
  ];
  console.assert(areServiceRulesEqual(baseServiceRules, modifiedServiceRules) === false, 'Removing service override detects dirty state');
  console.log('✓ Test 3: Service weekday overrides order-independent equality verified');

  // Test 4: isWeeklyAvailabilityDirty
  const mockBaseline = {
    id: 1,
    schedulingConfigVersion: 10,
    weekdayRules: baseParishRules,
    serviceWeekdayRules: baseServiceRules,
    scheduleDateRules: [],
  };

  console.assert(isWeeklyAvailabilityDirty(baseParishRules, baseServiceRules, mockBaseline) === false, 'Initial state clean');
  console.assert(isWeeklyAvailabilityDirty(modifiedParishRules, baseServiceRules, mockBaseline) === true, 'Parish rule change marks dirty');
  console.assert(isWeeklyAvailabilityDirty(baseParishRules, modifiedServiceRules, mockBaseline) === true, 'Service rule change marks dirty');
  console.log('✓ Test 4: Weekly availability dirty state logic verified');

  // Test 5: Date exception draft activity detection
  const emptyNewDraft = {
    editingRuleId: null,
    date: '',
    baseMode: 'INHERIT',
    reason: '',
    serviceOverrides: {},
  };
  console.assert(isDateExceptionDraftActive(emptyNewDraft, []) === false, 'Empty new draft is inactive');

  const typedDateDraft = { ...emptyNewDraft, date: '2026-12-25' };
  console.assert(isDateExceptionDraftActive(typedDateDraft, []) === true, 'Date selected marks draft active');

  const mockExistingDateRule = {
    id: 42,
    exceptionDate: '2026-12-25T00:00:00.000Z',
    baseMode: 'UNAVAILABLE',
    reason: 'Christmas Day',
    serviceOverrides: [{ eventType: 'MASS_INTENTION', mode: 'AVAILABLE' }],
  };

  const editingUnchangedDraft = {
    editingRuleId: 42,
    date: '2026-12-25',
    baseMode: 'UNAVAILABLE',
    reason: 'Christmas Day',
    serviceOverrides: { MASS_INTENTION: 'AVAILABLE' },
  };
  console.assert(isDateExceptionDraftActive(editingUnchangedDraft, [mockExistingDateRule]) === false, 'Editing with unchanged values is clean');

  const editingModifiedReasonDraft = { ...editingUnchangedDraft, reason: 'Christmas Day (Updated)' };
  console.assert(isDateExceptionDraftActive(editingModifiedReasonDraft, [mockExistingDateRule]) === true, 'Editing with modified reason is dirty');

  const editingModifiedOverrideDraft = { ...editingUnchangedDraft, serviceOverrides: { MASS_INTENTION: 'AVAILABLE', WEDDING: 'UNAVAILABLE' } };
  console.assert(isDateExceptionDraftActive(editingModifiedOverrideDraft, [mockExistingDateRule]) === true, 'Editing with added override is dirty');
  console.log('✓ Test 5: Date exception draft activity detection verified');

  // Test 6: formatFriendlyDate
  const formatted = formatFriendlyDate('2026-08-30');
  console.assert(formatted.formatted === 'Aug 30, 2026', `Expected Aug 30, 2026, got ${formatted.formatted}`);
  console.assert(formatted.weekdayName === 'Sunday', `Expected Sunday, got ${formatted.weekdayName}`);
  console.log('✓ Test 6: Friendly date formatting verified');

  console.log('--- All 6 Test Groups Passed Successfully! ---');
}

runTests();
