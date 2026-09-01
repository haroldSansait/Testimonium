import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getManilaCalendarDate,
  addCalendarDays,
  isWindowCrossMonth,
  formatEventCalendarDate,
  isEventUpcoming,
  isEventInRolling7Days,
  getEventCountdownLabel,
  parseEventDateTime,
} from '../src/utils/date.ts';

// ─── Pipeline Helper matching HomePage.tsx production implementation ────────
function computeHomepageEventBannerState({
  rawFeaturedCandidates,
  filterParishId = 'all',
  filterCategory = 'all',
  referenceDate = new Date('2026-09-01T10:00:00+08:00'),
}) {
  const upcomingCandidatesCount = rawFeaturedCandidates.filter(e => isEventUpcoming(e, referenceDate)).length;
  const upcomingWeeklyCandidates = rawFeaturedCandidates.filter(e => isEventInRolling7Days(e, referenceDate));
  const weeklyCandidateCount = upcomingWeeklyCandidates.length;

  const validUpcoming = upcomingWeeklyCandidates.filter(e => {
    if (filterParishId !== 'all' && String(e.parishId).trim() !== String(filterParishId).trim()) return false;
    if (filterCategory !== 'all' && e.category.toLowerCase() !== filterCategory.toLowerCase()) return false;
    return true;
  });

  const nonMassEvents = [];
  const massMap = {};

  validUpcoming.forEach(e => {
    if (e.category === 'Holy Mass') {
      const key = `${String(e.parishId)}_${e.startDate}`;
      if (!massMap[key]) massMap[key] = [];
      massMap[key].push(e);
    } else {
      nonMassEvents.push(e);
    }
  });

  const consolidatedMasses = Object.values(massMap).map(massList => {
    if (massList.length === 1) return massList[0];
    const sorted = [...massList].sort((a, b) => (parseEventDateTime(a.startDate, a.startTime)?.getTime() || 0) - (parseEventDateTime(b.startDate, b.startTime)?.getTime() || 0));
    const firstUpcoming = sorted[0];
    const allTimes = sorted.map(m => m.startTime).filter(Boolean).join(' • ');
    return {
      ...firstUpcoming,
      title: `${firstUpcoming.parishName} Holy Mass Schedule`,
      description: `Mass schedule times: ${allTimes}. Join our parish community for holy sacrifice and prayers.`,
      startTime: firstUpcoming.startTime,
      endTime: sorted[sorted.length - 1].endTime || firstUpcoming.endTime,
    };
  });

  const finalSlides = [...nonMassEvents, ...consolidatedMasses].sort((a, b) => {
    const startDifference = (parseEventDateTime(a.startDate, a.startTime)?.getTime() || 0)
      - (parseEventDateTime(b.startDate, b.startTime)?.getTime() || 0);
    return startDifference || a.id.localeCompare(b.id);
  });

  // Empty state resolution
  let emptyState = null;
  if (rawFeaturedCandidates.length === 0) {
    emptyState = {
      type: 'NO_MONTH_EVENTS',
      title: 'No upcoming events are scheduled for this month.',
      showClearFilters: false,
    };
  } else if (upcomingCandidatesCount === 0) {
    emptyState = {
      type: 'ALL_CONCLUDED',
      title: 'All events for this month have concluded.',
      showClearFilters: false,
    };
  } else if (weeklyCandidateCount === 0) {
    const todayStr = getManilaCalendarDate(referenceDate);
    const isCrossMonth = isWindowCrossMonth(todayStr, 7);
    if (isCrossMonth) {
      emptyState = {
        type: 'NO_REMAINING_MONTH_EVENTS',
        title: 'No upcoming events are posted for the remaining days of this month.',
        showClearFilters: false,
      };
    } else {
      emptyState = {
        type: 'NO_WEEKLY_EVENTS',
        title: 'No upcoming events in the next 7 days.',
        showClearFilters: false,
      };
    }
  } else if (finalSlides.length === 0) {
    emptyState = {
      type: 'FILTERED_EMPTY',
      title: 'No events match your current filters.',
      showClearFilters: true,
    };
  }

  return {
    rawCount: rawFeaturedCandidates.length,
    upcomingCandidatesCount,
    weeklyCandidateCount,
    finalSlides,
    visibleSlideCount: finalSlides.length,
    emptyState,
  };
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

test('Case 1: Reference date Sep 1 — Sep 1 included, Sep 7 included, Sep 8 excluded', () => {
  const refDate = new Date('2026-09-01T12:00:00+08:00');
  assert.equal(getManilaCalendarDate(refDate), '2026-09-01');
  assert.equal(addCalendarDays('2026-09-01', 6), '2026-09-07');

  const evSep1 = { id: '1', startDate: '2026-09-01', title: 'Day 1 Event' };
  const evSep7 = { id: '7', startDate: '2026-09-07', title: 'Day 7 Event' };
  const evSep8 = { id: '8', startDate: '2026-09-08', title: 'Day 8 Event' };

  assert.equal(isEventInRolling7Days(evSep1, refDate), true);
  assert.equal(isEventInRolling7Days(evSep7, refDate), true);
  assert.equal(isEventInRolling7Days(evSep8, refDate), false);
});

test('Case 2: Prior calendar-day event in current month is excluded', () => {
  const refDate = new Date('2026-09-05T12:00:00+08:00');
  const pastEvent = { id: 'past', startDate: '2026-09-04', endDate: '2026-09-04', title: 'Past' };
  assert.equal(isEventUpcoming(pastEvent, refDate), false);
  assert.equal(isEventInRolling7Days(pastEvent, refDate), false);
});

test('Case 3: Today event with start time already passed is STILL included (calendar-day based)', () => {
  const refDate = new Date('2026-09-02T18:00:00+08:00'); // 6:00 PM
  const morningEvent = {
    id: 'm1',
    startDate: '2026-09-02',
    endDate: '2026-09-02',
    startTime: '08:00 AM',
    endTime: '09:00 AM',
    status: 'upcoming',
  };
  assert.equal(isEventUpcoming(morningEvent, refDate), true);
  assert.equal(isEventInRolling7Days(morningEvent, refDate), true);
});

test('Case 4: Nearest-first ordering remains correct', () => {
  const refDate = new Date('2026-09-01T08:00:00+08:00');
  const events = [
    { id: '3', startDate: '2026-09-05', startTime: '09:00 AM', category: 'Seminar', parishId: 'p1' },
    { id: '1', startDate: '2026-09-01', startTime: '02:00 PM', category: 'Wedding', parishId: 'p1' },
    { id: '2', startDate: '2026-09-01', startTime: '06:00 AM', category: 'Fiesta', parishId: 'p1' },
  ];

  const state = computeHomepageEventBannerState({
    rawFeaturedCandidates: events,
    referenceDate: refDate,
  });

  assert.equal(state.finalSlides.length, 3);
  assert.equal(state.finalSlides[0].id, '2'); // Sep 1 06:00 AM
  assert.equal(state.finalSlides[1].id, '1'); // Sep 1 02:00 PM
  assert.equal(state.finalSlides[2].id, '3'); // Sep 5 09:00 AM
});

test('Case 5 & 6: Parish and Category filters operate inside weekly candidates', () => {
  const refDate = new Date('2026-09-01T08:00:00+08:00');
  const events = [
    { id: '1', startDate: '2026-09-02', category: 'Holy Mass', parishId: 'p1', parishName: 'Parish 1' },
    { id: '2', startDate: '2026-09-03', category: 'Wedding', parishId: 'p1', parishName: 'Parish 1' },
    { id: '3', startDate: '2026-09-04', category: 'Holy Mass', parishId: 'p2', parishName: 'Parish 2' },
    { id: '4', startDate: '2026-09-20', category: 'Holy Mass', parishId: 'p1', parishName: 'Parish 1' }, // outside 7-day
  ];

  // Parish filter 'p1'
  const stateParish = computeHomepageEventBannerState({
    rawFeaturedCandidates: events,
    filterParishId: 'p1',
    referenceDate: refDate,
  });
  assert.equal(stateParish.weeklyCandidateCount, 3); // id 1, 2, 3 in 7-day
  assert.equal(stateParish.finalSlides.length, 2); // id 1, 2 for p1
  assert.equal(stateParish.finalSlides.every(s => s.parishId === 'p1'), true);

  // Category filter 'wedding'
  const stateCategory = computeHomepageEventBannerState({
    rawFeaturedCandidates: events,
    filterCategory: 'wedding',
    referenceDate: refDate,
  });
  assert.equal(stateCategory.finalSlides.length, 1);
  assert.equal(stateCategory.finalSlides[0].id, '2');
});

test('Case 7 & 8: Multiple Mass occurrences consolidate and visible slide count reflects consolidated total', () => {
  const refDate = new Date('2026-09-01T08:00:00+08:00');
  const events = [
    { id: 'm1', startDate: '2026-09-03', startTime: '06:00 AM', endTime: '07:00 AM', category: 'Holy Mass', parishId: 'p1', parishName: 'San Isidro' },
    { id: 'm2', startDate: '2026-09-03', startTime: '08:30 AM', endTime: '09:30 AM', category: 'Holy Mass', parishId: 'p1', parishName: 'San Isidro' },
    { id: 'm3', startDate: '2026-09-03', startTime: '05:00 PM', endTime: '06:00 PM', category: 'Holy Mass', parishId: 'p1', parishName: 'San Isidro' },
    { id: 'w1', startDate: '2026-09-04', startTime: '10:00 AM', endTime: '11:30 AM', category: 'Wedding', parishId: 'p1', parishName: 'San Isidro' },
  ];

  const state = computeHomepageEventBannerState({
    rawFeaturedCandidates: events,
    referenceDate: refDate,
  });

  assert.equal(state.weeklyCandidateCount, 4); // 4 raw weekly candidates
  assert.equal(state.finalSlides.length, 2); // 1 consolidated Mass + 1 Wedding
  assert.equal(state.visibleSlideCount, 2); // Visible counter uses 2 (1/2, 2/2)

  const massSlide = state.finalSlides.find(s => s.category === 'Holy Mass');
  assert.ok(massSlide);
  assert.equal(massSlide.title, 'San Isidro Holy Mass Schedule');
  assert.ok(massSlide.description.includes('06:00 AM • 08:30 AM • 05:00 PM'));
});

test('Case 9: Future current-month events exist but none fall in next 7 days -> State B (Weekly empty state)', () => {
  const refDate = new Date('2026-09-01T08:00:00+08:00');
  const events = [
    { id: 'future1', startDate: '2026-09-15', category: 'Fiesta', parishId: 'p1' },
    { id: 'future2', startDate: '2026-09-22', category: 'Seminar', parishId: 'p2' },
  ];

  const state = computeHomepageEventBannerState({
    rawFeaturedCandidates: events,
    referenceDate: refDate,
  });

  assert.equal(state.upcomingCandidatesCount, 2);
  assert.equal(state.weeklyCandidateCount, 0);
  assert.equal(state.emptyState?.type, 'NO_WEEKLY_EVENTS');
  assert.equal(state.emptyState?.title, 'No upcoming events in the next 7 days.');
  assert.equal(state.emptyState?.showClearFilters, false);
});

test('Case 10: All current-month events concluded -> State A (Concluded state)', () => {
  const refDate = new Date('2026-09-25T08:00:00+08:00');
  const events = [
    { id: 'past1', startDate: '2026-09-10', category: 'Holy Mass', parishId: 'p1' },
    { id: 'past2', startDate: '2026-09-20', category: 'Fiesta', parishId: 'p2' },
  ];

  const state = computeHomepageEventBannerState({
    rawFeaturedCandidates: events,
    referenceDate: refDate,
  });

  assert.equal(state.upcomingCandidatesCount, 0);
  assert.equal(state.emptyState?.type, 'ALL_CONCLUDED');
  assert.equal(state.emptyState?.title, 'All events for this month have concluded.');
});

test('Case 11 & 12: Active filters eliminate weekly candidates -> Filtered empty state with Clear Filters flag', () => {
  const refDate = new Date('2026-09-01T08:00:00+08:00');
  const events = [
    { id: '1', startDate: '2026-09-02', category: 'Holy Mass', parishId: 'p1' },
  ];

  const state = computeHomepageEventBannerState({
    rawFeaturedCandidates: events,
    filterParishId: 'p99_nonexistent',
    referenceDate: refDate,
  });

  assert.equal(state.weeklyCandidateCount, 1);
  assert.equal(state.finalSlides.length, 0);
  assert.equal(state.emptyState?.type, 'FILTERED_EMPTY');
  assert.equal(state.emptyState?.title, 'No events match your current filters.');
  assert.equal(state.emptyState?.showClearFilters, true);
});

test('Case 13: Month boundary — Sep 28 window crosses to Oct 4; truthful message when no remaining Sep events', () => {
  const refDate = new Date('2026-09-28T08:00:00+08:00');
  const todayStr = getManilaCalendarDate(refDate);
  assert.equal(todayStr, '2026-09-28');
  assert.equal(isWindowCrossMonth(todayStr, 7), true); // Crosses into 2026-10

  // Events existed earlier in September, and future month (October) is NOT fetched
  const events = [
    { id: 'sep1', startDate: '2026-09-15', category: 'Holy Mass', parishId: 'p1' }, // past
    { id: 'sep2', startDate: '2026-09-29', category: 'Fiesta', parishId: 'p1' }, // upcoming in Sep
  ];

  const stateWithSepEvent = computeHomepageEventBannerState({
    rawFeaturedCandidates: events,
    referenceDate: refDate,
  });
  assert.equal(stateWithSepEvent.finalSlides.length, 1);
  assert.equal(stateWithSepEvent.finalSlides[0].id, 'sep2');

  // If no remaining events in September:
  const eventsNoRemainingSep = [
    { id: 'sep1', startDate: '2026-09-15', category: 'Holy Mass', parishId: 'p1' },
  ];
  const stateNoRemaining = computeHomepageEventBannerState({
    rawFeaturedCandidates: eventsNoRemainingSep,
    referenceDate: refDate,
  });
  assert.equal(stateNoRemaining.emptyState?.type, 'ALL_CONCLUDED');
});

test('Case 14: Safe YYYY-MM-DD formatting without UTC day shift', () => {
  const formatted = formatEventCalendarDate('2026-09-01', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  assert.ok(formatted.includes('Sep 1, 2026') || formatted.includes('1 Sep 2026') || formatted.includes('Sept 1, 2026'));
  assert.equal(formatted.includes('Aug 31'), false); // No UTC day shift
});

test('Case 15: Countdown labels relative to Manila calendar date', () => {
  const refDate = new Date('2026-09-01T10:00:00+08:00');
  assert.equal(getEventCountdownLabel('2026-09-01', undefined, refDate), 'Happening Today');
  assert.equal(getEventCountdownLabel('2026-09-02', undefined, refDate), 'Tomorrow');
  assert.equal(getEventCountdownLabel('2026-09-04', undefined, refDate), 'In 3 days');
  assert.equal(getEventCountdownLabel('2026-08-31', undefined, refDate), 'Yesterday');
});
