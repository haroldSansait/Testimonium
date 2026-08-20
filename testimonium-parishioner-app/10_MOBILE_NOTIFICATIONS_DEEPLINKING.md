# TESTIMONIUM Parishioner Mobile — Notifications & Deep Linking

## 1. Current baseline

The backend currently supports in-app notifications:
- list notifications;
- mark one read;
- mark all read.

Database notification types include `PUSH`, `IN_APP`, and `EMAIL`, but the current API documentation does not define a mobile device-token registration endpoint.

Therefore:

> Native push notifications are not an initial mobile backend capability yet.

Do not simulate push with local polling notifications.

## 2. Initial mobile notification implementation

Implement:
- notification list;
- unread state/count;
- pull-to-refresh;
- mark one read;
- mark all read;
- reference-aware navigation.

Recommended Home:
- bell icon with unread badge;
- no aggressive full-screen interruption.

## 3. Reference routing

Current reference types:
- `DOCUMENT_REQUEST`
- `SCHEDULE_REQUEST`
- `GENERAL`

Map safely:

```text
DOCUMENT_REQUEST -> request detail
SCHEDULE_REQUEST -> schedule detail
GENERAL -> notifications/general destination
```

Before navigation:
- validate ID exists;
- route target through normal protected query;
- handle 403/404 gracefully.

## 4. Deep-link abstraction

Create app-level target functions independent of push provider:

```ts
type AppDeepLink =
  | { type: 'request'; id: number|string }
  | { type: 'schedule'; id: number|string }
  | { type: 'parish'; id: number|string }
  | { type: 'event'; id: number|string }
  | { type: 'notifications' };
```

This can later be used by:
- push;
- email links;
- QR links;
- internal cards.

## 5. Native push future backend requirements

Before push is enabled, backend needs a device registration model, likely containing:
- user ID;
- push token;
- platform;
- app/environment;
- enabled/revoked state;
- last-seen timestamp;
- optional device identifier that is privacy-conscious.

Required endpoints conceptually:
- register/update token;
- unregister token;
- possibly list/revoke current user's devices.

Do not implement these endpoint names without backend design review.

## 6. Token lifecycle

Push tokens can rotate.

Mobile must:
- update backend when token changes;
- remove/revoke on logout where appropriate;
- avoid using one token for multiple users after account switching.

Backend should:
- delete/disable invalid tokens after provider rejection.

## 7. Push content privacy

Lock-screen notification content is visible outside the app.

Avoid sensitive details.

Prefer:
- "Your document request has an update."
over:
- full sacramental/person/payment details.

Provide in-app detail after authentication.

## 8. Deep link while logged out

If a user opens a protected link while logged out:
1. preserve safe intended destination in memory;
2. authenticate;
3. verify resource ownership;
4. navigate if allowed.

Do not expose resource detail before auth.

## 9. Deep link after account switch

Never navigate account B to account A's cached protected resource.

Clear pending deep links on explicit account switch when ownership cannot be safely established.

## 10. Notification polling

Until push exists:
- refetch on app foreground;
- refetch on notifications screen focus;
- optional moderate interval only while app is active.

Do not run constant background polling.

## 11. Badge behavior

Unread badge count should derive from backend notification state.

After mark-read:
- update query result/invalidations;
- avoid negative/stale count.

## 12. Future provider

If using Expo push notifications later:
- validate production setup for Android/iOS;
- use environment-separated projects/builds;
- do not put server push credentials in app;
- send notifications from backend/server only.

The exact provider should be chosen after deployment architecture review.
