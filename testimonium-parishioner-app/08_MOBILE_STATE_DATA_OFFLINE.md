# TESTIMONIUM Parishioner Mobile — State, Data & Offline Strategy

**Last reconciled:** 24 August 2026
**Status:** TanStack Query server-state architecture fully implemented across all feature modules.

## 1. State management principles

- **Server State:** Owned by TanStack Query. Includes parishes, document requests, payment configurations, schedules, available slots, public events, notifications, and profile data.
- **Local Form State:** Managed with React component state or `react-hook-form` during multi-step wizards.
- **Session State:** Managed by `AuthContext` with monotonic generation refs and mutex locks.

## 2. Structured query-key conventions

Each feature defines explicit, hierarchical query key factories:

### Parishes (`src/features/parishes/queryKeys.ts`)
```ts
parishKeys.all                  // ['parishes']
parishKeys.lists()              // ['parishes', 'list']
parishKeys.list(filters)        // ['parishes', 'list', { search, type, page, limit }]
parishKeys.details()            // ['parishes', 'detail']
parishKeys.detail(id)           // ['parishes', 'detail', id]
```

### Document Requests (`src/features/requests/queryKeys.ts`)
```ts
requestKeys.all                 // ['requests']
requestKeys.lists()             // ['requests', 'list']
requestKeys.list(filters)       // ['requests', 'list', { status, page }]
requestKeys.details()           // ['requests', 'detail']
requestKeys.detail(id)          // ['requests', 'detail', id]
requestKeys.tracking(number)    // ['requests', 'tracking', number]
```

### Scheduling (`src/features/schedule/queryKeys.ts`)
```ts
scheduleKeys.all                                // ['schedules']
scheduleKeys.lists()                            // ['schedules', 'list']
scheduleKeys.details()                          // ['schedules', 'detail']
scheduleKeys.detail(id)                         // ['schedules', 'detail', id]
scheduleKeys.configuration(parishId)            // ['schedules', 'configuration', parishId]
scheduleKeys.availabilityDates(pId, sDate, eDate) // ['schedules', 'availability', pId, sDate, eDate]
scheduleKeys.availableSlots(pId, date, event)   // ['schedules', 'slots', pId, date, event]
```

### Public Events (`src/features/events/queryKeys.ts`)
```ts
eventKeys.all                   // ['events']
eventKeys.months()              // ['events', 'month']
eventKeys.month({ year, month })// ['events', 'month', { year, month }]
```

### Notifications (`src/features/notifications/queryKeys.ts`)
```ts
notificationKeys.all            // ['notifications']
notificationKeys.lists()        // ['notifications', 'list']
```

## 3. Mutation invalidation and synchronization

- **Document Request Creation / Submit / Cancel:**
  Invalidates `requestKeys.lists()` and refetches the target `requestKeys.detail(id)`.
- **Payment Receipt Upload:**
  Invalidates `requestKeys.detail(requestId)` and `requestKeys.lists()` to transition UI to `PAYMENT_UNDER_REVIEW`.
- **Correction Resubmission:**
  Invalidates `requestKeys.detail(requestId)`.
- **Schedule Creation / Reschedule Response:**
  Invalidates `scheduleKeys.lists()`, `scheduleKeys.detail(id)`, and `scheduleKeys.availableSlots(...)`.
- **Notification Read / Read All:**
  Updates local cache and invalidates `notificationKeys.lists()`.
- **Profile Update:**
  Directly commits updated profile and invalidates `['profile']`.

## 4. Session teardown and cache clearing

Upon user sign-out or account switching, the application enforces full cache isolation:

```ts
await queryClient.cancelQueries();
queryClient.clear();
```

This ensures no private request data, timeline notes, or notifications from User A are visible to User B.

## 5. Offline read and mutation strategy

- **Cached Reads:** Cached parish directory listings and monthly event schedules remain readable when network connectivity is lost, with clear offline indicators.
- **Mutations Require Network:** Transactional operations (document requests, payment uploads, slot bookings, reschedule responses) strictly require active connectivity and are never queued offline silently without server confirmation.
