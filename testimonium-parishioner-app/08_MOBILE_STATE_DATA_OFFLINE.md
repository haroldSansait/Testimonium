# TESTIMONIUM Parishioner Mobile — State, Data & Offline Strategy

## 1. Principle

Treat backend data as server state, not as application-global mutable state.

Examples of server state:
- profile;
- parishes;
- document requirements;
- requests/history;
- payment config/state;
- schedules/slots;
- events;
- notifications.

Examples of local UI state:
- selected tab;
- open sheet;
- form step;
- current filter;
- unsaved draft input;
- camera/file picker state.

## 2. Recommended server-state tool

If the scaffold does not already have a suitable query library, evaluate TanStack Query for:
- query deduplication;
- caching;
- invalidation;
- mutation status;
- retries;
- refetch-on-focus/network;
- cancellation.

Do not install it before auditing current dependencies.

If another server-state library is already established, keep one approach.

## 3. Query-key discipline

Conceptual keys:

```text
['profile', userUid]
['parishes', filters]
['parish', parishId]
['requests', userUid, filters]
['request', requestId]
['request-history', requestId]
['payment-config', requestIdOrContext]
['schedule-requests', userUid]
['schedule', scheduleId]
['available-slots', parishId, eventType, date]
['events', year, month]
['notifications', userUid, page]
```

Identity-sensitive keys should not leak across users.

## 4. Cache clearing

On logout:
- clear/invalidate all protected queries;
- clear local feature state;
- do not preserve request/profile cache for the next account.

## 5. Freshness recommendations

Exact values should be tuned after observing backend load.

Possible starting policy:

### Profile
- fresh briefly;
- refetch on app resume when session age warrants.

### Parish directory
- cache longer;
- refetch on pull-to-refresh.

### Events
- moderate freshness;
- refetch on screen focus/date-period change.

### Requests/schedules
- short freshness;
- refetch on focus and after mutations.

### Available slots
- very short freshness;
- always revalidate before/at submission.

### Notifications
- short freshness;
- refetch on app resume/screen focus.

Do not treat these numbers as backend guarantees.

## 6. Mutation invalidation

### Profile update
- update `profile` from response or refetch.

### Request create/submit/cancel/correction
- invalidate request list and affected request detail/history.

### Receipt upload
- invalidate request/payment/history.

### Schedule create/respond
- invalidate schedule list/detail and relevant slots.

### Notification read
- update local list optimistically only if rollback is straightforward; otherwise use response/invalidation.

## 7. Optimistic UI rules

Good candidates:
- mark notification read;
- low-risk preference toggle.

Poor candidates:
- payment verified;
- request workflow transitions;
- schedule confirmation;
- slot booking;
- document submission;
- profile completion.

Do not optimistically cross security/workflow boundaries.

## 8. Offline read behavior

Recommended:
- allow cached parish directory/event content to remain visible if previously loaded;
- show "Offline" or "Last updated" context when stale data could mislead;
- allow cached request list/detail for viewing only if privacy risk is acceptable.

Do not show cached available slots as currently bookable.

## 9. Offline mutation behavior

Initial v1 should require network for:
- create/submit document request;
- upload file;
- upload receipt;
- cancel/resubmit correction;
- create schedule request;
- respond to reschedule;
- profile save when onboarding completion depends on it.

No automatic background mutation queue in initial v1.

Reason:
- these operations have workflow/concurrency consequences;
- backend has no documented idempotency-key contract;
- ambiguous retries can duplicate side effects.

## 10. Form draft persistence

Default:
- keep drafts in memory for current flow.

If product later requests persistent drafts:
- classify fields;
- encrypt/use secure storage for sensitive content if needed;
- do not persist file blobs;
- store references only to temporary local URIs with clear expiration behavior;
- version the draft schema;
- clear on successful submission/logout.

## 11. App lifecycle

On app foreground:
- verify auth state;
- refetch time-sensitive data;
- avoid refetch storm by centralizing focus behavior.

On background:
- do not continue unnecessary polling;
- allow active upload semantics only if supported and intentionally designed;
- do not assume long-running JS continues indefinitely.

## 12. Polling

Prefer event/focus-based refetch to aggressive fixed polling.

If a feature requires polling:
- only while screen/app is active;
- exponential/backoff where appropriate;
- stop on terminal state;
- stop on logout/unmount;
- never run duplicate intervals for the same query.

## 13. Pagination

If backend returns pagination metadata:
- use incremental pagination;
- deduplicate items by stable ID;
- handle deleted resources;
- do not load unbounded history into memory.

## 14. Stale-response prevention

Use query library cancellation/versioning or request guards so:
- old filter response does not replace new filter results;
- old user response does not render after account switch;
- pre-save profile fetch does not overwrite post-save profile.

## 15. Connectivity UX

Distinguish:
- offline/no network;
- timeout;
- server unavailable;
- auth expired;
- permission denied.

"Try again" should only be offered when retry is meaningful.

## 16. Sensitive data caching

Do not persist:
- raw receipt OCR text;
- private document files;
- auth tokens;
- full sensitive API responses

to generic async storage for convenience.

If cached media is used for display, follow platform cache lifecycle and avoid exposing it to public photo libraries.
