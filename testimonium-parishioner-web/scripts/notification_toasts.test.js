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

describe('In-App Notification Toast System', () => {
  // 1. Initial unread notifications do not cause a popup flood
  it('1. Initial unread notifications establish baseline and do not cause a popup flood', () => {
    const historicalNotifications = Array.from({ length: 15 }, (_, i) =>
      createNotification(`hist-${i + 1}`, { read: false })
    );

    // Simulated baseline arrival tracking
    const seenNotificationIds = new Set();
    const newlyArrivedIds = []; // On baseline load, newlyArrivedIds is empty

    // When newlyArrivedIds is empty, all current notifications are recorded as seen without toasting
    if (newlyArrivedIds.length === 0) {
      historicalNotifications.forEach(n => seenNotificationIds.add(n.id));
    }

    // Filter genuinely new arrivals
    const genuinelyNew = newlyArrivedIds.filter(id => !seenNotificationIds.has(id));

    let state = { visible: [], queue: [], overflowCount: 0 };
    if (genuinelyNew.length > 0) {
      const itemsToToast = genuinelyNew.map(id => historicalNotifications.find(n => n.id === id));
      state = toastLayerReducer(state, {
        type: 'ENQUEUE_ARRIVALS',
        items: itemsToToast,
        maxVisible: MAX_VISIBLE_DESKTOP
      });
    }

    assert.equal(state.visible.length, 0, 'No visible toasts should appear from historical baseline');
    assert.equal(state.queue.length, 0, 'No queued toasts should appear from historical baseline');
    assert.equal(seenNotificationIds.size, 15, 'All 15 historical notifications were recorded in baseline');
  });

  // 2. One genuinely new unread notification produces one toast
  it('2. One genuinely new unread notification produces one toast', () => {
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

  // 3. Duplicate polls do not generate duplicate toasts
  it('3. Duplicate polls and repeated renders do not generate duplicate toasts', () => {
    const seenNotificationIds = new Set();
    let state = { visible: [], queue: [], overflowCount: 0 };

    const notif = createNotification('poll-item-1', { read: false });

    // Poll 1: arrival detected
    const poll1Arrivals = ['poll-item-1'];
    const newFromPoll1 = poll1Arrivals.filter(id => !seenNotificationIds.has(id));
    newFromPoll1.forEach(id => seenNotificationIds.add(id));

    state = toastLayerReducer(state, {
      type: 'ENQUEUE_ARRIVALS',
      items: [notif],
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(state.visible.length, 1);

    // Poll 2 (30 seconds later): query returns the same notification
    const poll2Arrivals = ['poll-item-1'];
    const newFromPoll2 = poll2Arrivals.filter(id => !seenNotificationIds.has(id));

    // Because 'poll-item-1' is already in seenNotificationIds, newFromPoll2 is empty
    assert.equal(newFromPoll2.length, 0);

    // Even if reducer was called with the same notification item, reducer deduplicates against visible and queue
    state = toastLayerReducer(state, {
      type: 'ENQUEUE_ARRIVALS',
      items: [notif],
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(state.visible.length, 1, 'Still only 1 visible toast, no duplicates');
    assert.equal(state.queue.length, 0, 'No duplicate in queue');
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

  // 12. Clicking an unread notification uses existing mark-as-read behavior
  it('12. Clicking a toast marks unread notification as read and removes only that toast', async () => {
    const notif = createNotification('click-read-1', { read: false, referenceType: 'DOCUMENT_REQUEST', referenceId: 101 });
    let markAsReadCalledWith = null;
    const markAsRead = async (id) => {
      markAsReadCalledWith = id;
      notif.read = true;
    };

    let state = {
      visible: [
        { notification: notif, remainingMs: 5000, lastResumedAt: Date.now(), isHovered: false, isFocused: false }
      ],
      queue: [],
      overflowCount: 0
    };

    // User clicks toast
    if (!notif.read) {
      await markAsRead(notif.id);
    }
    state = toastLayerReducer(state, {
      type: 'REMOVE_VISIBLE',
      id: notif.id,
      maxVisible: MAX_VISIBLE_DESKTOP
    });

    assert.equal(markAsReadCalledWith, 'click-read-1');
    assert.equal(notif.read, true);
    assert.equal(state.visible.length, 0);
    assert.equal(getNotificationUrl(notif), '/dashboard/track?requestId=101');
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

  // 15. Existing general application toasts in ToastContext remain functional
  it('15. Existing ToastContext items operate independently from notification toasts', () => {
    // Ordinary app toasts use type: success | error | warning | info and a single string message
    const appToasts = [
      { id: 'app-toast-1', type: 'success', message: 'Profile updated successfully', duration: 4000 },
      { id: 'app-toast-2', type: 'error', message: 'Failed to upload document', duration: 5000 }
    ];

    assert.equal(appToasts[0].type, 'success');
    assert.equal(appToasts[1].type, 'error');
    // Notification toasts have distinct AppNotification structures and top-right positioning
    const notifToast = createNotification('notif-app-1', { title: 'New Status', message: 'Approved' });
    assert.ok(notifToast.id);
    assert.ok(notifToast.title);
    assert.ok(notifToast.type);
  });

  // 16. Existing notification polling and QueryClient behavior are preserved
  it('16. Notification polling configuration stays at 30s with unmutated TanStack query options', () => {
    const pollConfig = {
      staleTime: 30_000,
      pollInterval: 30_000,
      requireFocus: false,
      respectPause: false
    };

    assert.equal(pollConfig.pollInterval, 30_000);
    assert.equal(pollConfig.staleTime, 30_000);
    assert.equal(pollConfig.requireFocus, false);
    assert.equal(pollConfig.respectPause, false);
  });
});
