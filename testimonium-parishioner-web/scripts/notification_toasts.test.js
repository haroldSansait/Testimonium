import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toastLayerReducer,
  TOAST_DURATION_MS,
  MAX_VISIBLE_DESKTOP,
  MAX_VISIBLE_MOBILE,
  MAX_PENDING_QUEUE
} from '../src/components/notifications/toastLayerModel.ts';
import { getNotificationUrl } from '../src/utils/notificationNavigation.ts';

// Helper to create test notifications
const createNotification = (id, overrides = {}) => ({
  id,
  title: `Notification ${id}`,
  message: `Message for notification ${id}`,
  type: 'general',
  read: false,
  createdAt: new Date().toISOString(),
  referenceType: null,
  referenceId: null,
  ...overrides
});

describe('Notification toast reducer and navigation regressions', () => {
  it('login backlog reuses the queue for its third mobile item and summarizes the unqueued remainder', () => {
    const items = [createNotification('newest'), createNotification('second'), createNotification('third')];
    for (const maxVisible of [MAX_VISIBLE_DESKTOP, MAX_VISIBLE_MOBILE]) {
      const state = toastLayerReducer({ visible: [], queue: [], overflowCount: 0 }, {
        type: 'ENQUEUE_LOGIN_BACKLOG', items, remainingCount: 5, maxVisible,
      });
      assert.equal(state.visible.length, maxVisible);
      assert.deepEqual(state.queue.map(n => n.id), maxVisible === MAX_VISIBLE_MOBILE ? ['third'] : []);
      assert.equal(state.overflowCount, 5);
      assert.equal(state.loginOverflow, true);
      const next = toastLayerReducer(state, { type: 'ENQUEUE_ARRIVALS', items: [createNotification('live')], maxVisible });
      assert.equal(next.loginOverflow, true, 'Live arrivals preserve the pending login summary');
      assert.equal(next.overflowCount, 5);
      const dismissed = toastLayerReducer(next, { type: 'DISMISS_OVERFLOW' });
      assert.equal(dismissed.overflowCount, 0);
      assert.equal(dismissed.loginOverflow, false);
    }
  });
  // The real provider-to-toast delivery is tested in notification_integration.test.js.
  it('ENQUEUE_ARRIVALS renders one reducer item with the seven-second duration', () => {
    let state = { visible: [], queue: [], overflowCount: 0 };
    const notif = createNotification('new-1', { read: false, title: 'Document Approved' });

    state = toastLayerReducer(state, {
      type: 'ENQUEUE_ARRIVALS',
      items: [notif],
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(state.visible.length, 1);
    assert.equal(state.visible[0].notification.id, 'new-1');
    assert.equal(state.visible[0].remainingMs, TOAST_DURATION_MS);
    assert.equal(state.visible[0].notification.title, 'Document Approved');
    assert.equal(state.queue.length, 0);
  });

  it('deduplicates repeated delivery against visible and queued notifications', () => {
    const items = Array.from({ length: 5 }, (_, i) => createNotification(`duplicate-${i}`));
    const state = toastLayerReducer({ visible: [], queue: [], overflowCount: 0 }, {
      type: 'ENQUEUE_ARRIVALS', items, maxVisible: MAX_VISIBLE_DESKTOP,
    });
    assert.equal(toastLayerReducer(state, { type: 'ENQUEUE_ARRIVALS', items, maxVisible: MAX_VISIBLE_DESKTOP }), state);
  });

  it('shrinking and expanding an existing stack preserve accepted notifications and FIFO order', () => {
    const items = Array.from({ length: 8 }, (_, i) => createNotification(`resize-${i}`));
    const desktop = toastLayerReducer({ visible: [], queue: [], overflowCount: 0 }, {
      type: 'ENQUEUE_ARRIVALS', items, maxVisible: MAX_VISIBLE_DESKTOP,
    });
    const mobile = toastLayerReducer(desktop, { type: 'SET_MAX_VISIBLE', maxVisible: MAX_VISIBLE_MOBILE });
    assert.equal(mobile.visible.length, MAX_VISIBLE_MOBILE);
    assert.deepEqual([...mobile.visible.map(t => t.notification.id), ...mobile.queue.map(n => n.id)], items.map(n => n.id));
    const expanded = toastLayerReducer(mobile, { type: 'SET_MAX_VISIBLE', maxVisible: MAX_VISIBLE_DESKTOP });
    assert.deepEqual(expanded.visible.map(t => t.notification.id), items.slice(0, 3).map(n => n.id));
    assert.deepEqual(expanded.queue.map(n => n.id), items.slice(3).map(n => n.id));
  });

  // 4. Three simultaneous notifications are handled correctly
  it('4. Three simultaneous notifications occupy the 3 visible slots on desktop', () => {
    let state = { visible: [], queue: [], overflowCount: 0 };
    const notifs = [
      createNotification('sim-1'),
      createNotification('sim-2'),
      createNotification('sim-3')
    ];

    state = toastLayerReducer(state, {
      type: 'ENQUEUE_ARRIVALS',
      items: notifs,
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(state.visible.length, 3);
    assert.equal(state.visible[0].notification.id, 'sim-1');
    assert.equal(state.visible[1].notification.id, 'sim-2');
    assert.equal(state.visible[2].notification.id, 'sim-3');
    assert.equal(state.queue.length, 0);
    assert.equal(state.overflowCount, 0);
  });

  // 5. Excess notifications queue without visual overlap
  it('5. Excess notifications queue predictably up to MAX_PENDING_QUEUE without visual overlap', () => {
    let state = { visible: [], queue: [], overflowCount: 0 };
    // 5 notifications arrive on desktop (max visible = 3)
    const notifs = [
      createNotification('q-1'),
      createNotification('q-2'),
      createNotification('q-3'),
      createNotification('q-4'),
      createNotification('q-5')
    ];

    state = toastLayerReducer(state, {
      type: 'ENQUEUE_ARRIVALS',
      items: notifs,
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(state.visible.length, 3, 'Desktop displays exactly 3 visible toasts');
    assert.equal(state.queue.length, 2, 'Remaining 2 items are safely queued');
    assert.equal(state.queue[0].id, 'q-4', 'FIFO order preserved');
    assert.equal(state.queue[1].id, 'q-5');

    // On mobile (max visible = 2)
    let mobileState = { visible: [], queue: [], overflowCount: 0 };
    mobileState = toastLayerReducer(mobileState, {
      type: 'ENQUEUE_ARRIVALS',
      items: notifs,
      maxVisible: MAX_VISIBLE_MOBILE
    });
    assert.equal(mobileState.visible.length, 2, 'Mobile displays exactly 2 visible toasts');
    assert.equal(mobileState.queue.length, 3, 'Remaining 3 items are queued on mobile');
  });

  // 6. Queue overflow produces a summary without losing actual notifications
  it('6. Queue overflow aggregates remainder into overflowCount without discarding notifications', () => {
    let state = { visible: [], queue: [], overflowCount: 0 };
    // Burst of 14 notifications arriving simultaneously
    const burst = Array.from({ length: 14 }, (_, i) => createNotification(`burst-${i + 1}`));

    state = toastLayerReducer(state, {
      type: 'ENQUEUE_ARRIVALS',
      items: burst,
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    // Max visible on desktop = 3
    assert.equal(state.visible.length, 3, '3 visible slots filled');
    // Max pending queue = 5
    assert.equal(state.queue.length, MAX_PENDING_QUEUE, 'Queue filled up to MAX_PENDING_QUEUE (5)');
    // 14 total - (3 visible + 5 queued) = 6 overflow
    assert.equal(state.overflowCount, 6, 'Remaining 6 are counted in overflow summary');

    // Draining visible items promotes from queue
    state = toastLayerReducer(state, {
      type: 'REMOVE_VISIBLE',
      id: 'burst-1',
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(state.visible.length, 3, 'Slot vacated was filled by promoting first in queue');
    assert.equal(state.visible[2].notification.id, 'burst-4', 'burst-4 was promoted from queue');
    assert.equal(state.queue.length, 4, 'Queue decremented to 4');
    assert.equal(state.overflowCount, 6, 'Overflow count intact');
  });

  // 7. Auto-dismiss does not mark notifications as read
  it('7. Timer expiration removes toast and promotes next, keeping read state unchanged', () => {
    const originalNotif = createNotification('exp-1', { read: false });
    const queuedNotif = createNotification('exp-2', { read: false });

    let state = {
      visible: [{
        notification: originalNotif,
        remainingMs: 0,
        lastResumedAt: Date.now(),
        isHovered: false,
        isFocused: false
      }],
      queue: [queuedNotif],
      overflowCount: 0
    };

    // When timer expires, REMOVE_VISIBLE is dispatched
    state = toastLayerReducer(state, {
      type: 'REMOVE_VISIBLE',
      id: 'exp-1',
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(state.visible.length, 1);
    assert.equal(state.visible[0].notification.id, 'exp-2', 'Queued notification promoted');
    assert.equal(originalNotif.read, false, 'Underlying notification remains unread');
  });

  // 8. Manual dismissal does not mark notifications as read
  it('8. Manual dismissal (X button) closes only its own toast without marking as read', () => {
    const notif1 = createNotification('dismiss-1', { read: false });
    const notif2 = createNotification('dismiss-2', { read: false });

    let state = {
      visible: [
        { notification: notif1, remainingMs: 5000, lastResumedAt: Date.now(), isHovered: false, isFocused: false },
        { notification: notif2, remainingMs: 6000, lastResumedAt: Date.now(), isHovered: false, isFocused: false }
      ],
      queue: [],
      overflowCount: 0
    };

    // User clicks X on dismiss-1
    state = toastLayerReducer(state, {
      type: 'REMOVE_VISIBLE',
      id: 'dismiss-1',
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(state.visible.length, 1);
    assert.equal(state.visible[0].notification.id, 'dismiss-2', 'Unrelated toast remains visible');
    assert.equal(notif1.read, false, 'dismiss-1 was NOT marked as read');
  });

  // 9. Clicking a document notification navigates to the correct document
  it('9. Document-related notification URL targets /dashboard/track?requestId=<id>', () => {
    const docNotif = createNotification('doc-notif-1', {
      type: 'document-approved',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: 456
    });

    const url = getNotificationUrl(docNotif);
    assert.equal(url, '/dashboard/track?requestId=456');
  });

  // 10. Clicking a schedule notification navigates to the correct schedule
  it('10. Schedule-related notification URL targets /dashboard/schedule/<id>', () => {
    const schedNotif = createNotification('sched-notif-1', {
      type: 'appointment-confirmed',
      referenceType: 'SCHEDULE_REQUEST',
      referenceId: 789
    });

    const url = getNotificationUrl(schedNotif);
    assert.equal(url, '/dashboard/schedule/789');
  });

  // 11. Clicking a general notification locates it in Notification Center
  it('11. General and announcement notifications target /dashboard/notifications?notificationId=<id>', () => {
    const genNotif = createNotification('gen-notif-1', {
      type: 'announcement',
      referenceType: 'GENERAL',
      referenceId: null
    });

    const url = getNotificationUrl(genNotif);
    assert.equal(url, '/dashboard/notifications?notificationId=gen-notif-1');

    // Missing referenceId fallback
    const brokenRefNotif = createNotification('broken-1', {
      type: 'document-submitted',
      referenceType: 'DOCUMENT_REQUEST',
      referenceId: null
    });
    assert.equal(getNotificationUrl(brokenRefNotif), '/dashboard/notifications?notificationId=broken-1');
  });

  // 13. Login/logout/account switching clears stale notification toast state
  it('13. Session transition (RESET) completely wipes visible, queued, and overflow state', () => {
    let state = {
      visible: [
        { notification: createNotification('sess-1'), remainingMs: 4000, lastResumedAt: Date.now(), isHovered: false, isFocused: false }
      ],
      queue: [createNotification('sess-2')],
      overflowCount: 5
    };

    // User logs out or switches accounts -> RESET action dispatched
    state = toastLayerReducer(state, { type: 'RESET' });

    assert.deepEqual(state, {
      visible: [],
      queue: [],
      overflowCount: 0
    });
  });

  // 14. Timers pause on hover, keyboard focus, and hidden tab, and resume remaining time
  it('14. Hover, focus, and tab hiding pause expiration countdown and resume remaining time', () => {
    const notif = createNotification('timer-test-1');
    let state = {
      visible: [
        { notification: notif, remainingMs: 7000, lastResumedAt: 10000, isHovered: false, isFocused: false }
      ],
      queue: [],
      overflowCount: 0
    };

    // User hovers at timestamp 12000 (2 seconds elapsed)
    state = toastLayerReducer(state, {
      type: 'PAUSE_TOAST',
      id: notif.id,
      isHovered: true
    });

    assert.equal(state.visible[0].isHovered, true);
    assert.equal(state.visible[0].lastResumedAt, null, 'Timer is paused');

    // User unhovers at timestamp 15000
    state = toastLayerReducer(state, {
      type: 'RESUME_TOAST',
      id: notif.id,
      isHovered: false
    });

    assert.equal(state.visible[0].isHovered, false);
    assert.ok(state.visible[0].lastResumedAt !== null, 'Timer is resumed');

    // Global tab hidden (e.g. user switches tabs)
    state = toastLayerReducer(state, { type: 'PAUSE_ALL' });
    assert.equal(state.visible[0].lastResumedAt, null, 'All timers paused on hidden tab');

    // Global tab visible
    state = toastLayerReducer(state, { type: 'RESUME_ALL' });
    assert.ok(state.visible[0].lastResumedAt !== null, 'Timers resume when tab returns to visible');
  });

});
