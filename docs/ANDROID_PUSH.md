# Parishioner Android push notifications

This is an additional delivery channel for existing saved notifications. The
mobile Notification Center, Web toasts, notification read state, email delivery,
and document/payment/schedule workflows retain their existing behavior.

## Strict event allowlist

Only server-authored `Notification.pushEvent` metadata is eligible. Neither title
nor message text is used to decide eligibility. Events also require `IN_APP` and
the corresponding document/schedule reference type. The worker rechecks the
recipient's active, verified parishioner account and device ownership before FCM.

| Saved event | Phone push |
| --- | --- |
| Document `PAYMENT_PENDING` | Yes: payment required |
| Document `PAYMENT_VERIFIED` | Yes: regular payment verification and Cash Override use this existing event |
| Document `NEEDS_CORRECTION`, `PAYMENT_NEEDS_CORRECTION` | Yes |
| Payment proof `QUALITY_FAILED` | Yes: clearer proof is required |
| Document `READY_FOR_PICKUP`, `COMPLETED`, `CANCELLED`, `REJECTED` | Yes |
| Schedule `CONFIRMED`, `DECLINED`, `REJECTED`, `CANCELLED` | Yes |
| Schedule `PROPOSED_RESCHEDULE`, `WAITING_PARISHIONER_RESPONSE` | Yes: parishioner response required |
| Emergency reschedule | Yes |
| Alternative-date proposal `APPLIED`, `DECLINED` | Yes: confirmation or decline |
| Submission, under review, processing, ready for signing | No |
| Receipt uploaded/resubmitted, corrections submitted | No |
| Staff/priest-only notifications and assignment/reassignment work | No |
| Proposal priest review/nomination changes/withdrawal/supersession | No |
| Schedule completion, announcements, miscellaneous or unknown events | No |

All existing events still save their original in-app notification rows. There is
no replacement history table and no new notification for push delivery itself.

## Device lifecycle

Authenticated `POST /api/v1/notifications/devices` accepts `platform: "android"`,
the native FCM `token`, and optionally an owned `previousToken` for rotation.
The authenticated request supplies the user identity; body user IDs are ignored.
`DELETE` at the same path removes only the authenticated user's specified token.
Neither endpoint returns registration tokens.

One token has one owner. Serializable registration and retries make repeated
registration idempotent. Ownership transfer deletes the old device epoch and its
pending deliveries. Multiple tokens support multiple phones. Rotation removes
the previous token only when it belongs to the authenticated user.

Each new device epoch records the current maximum notification ID. The worker
only queues larger IDs for that owner. Registration does not replay historical
notifications, including historical unread records. Reopening an existing
registration retains its cutoff and pending deliveries.

Mobile registration waits for `AUTHENTICATED_READY` and completed product intro.
It creates the Android channel before requesting permission. Previous denial is
not repeatedly prompted. Registration retries on app foreground, and native token
rotation uses the received token directly without recursive token lookup.

Logout/session reset gates foreground presentation immediately, attempts owned
server unregistration, calls Expo's native FCM-token deletion, and dismisses
existing system notifications. A persisted revocation marker blocks subsequent
account registration until native revocation succeeds. API/native errors do not
fail login or logout. If native revocation and server removal both fail offline,
immediate remote cancellation cannot be guaranteed; the marker is retried before
registration. Phone copy contains no request-specific private message details.

## Delivery

The additive Prisma migration introduces `push_devices`, `push_deliveries`, and
nullable event metadata on existing notifications. Historical rows stay null.
Only the two new backend tables receive RLS and public-client privilege removal.
Existing-table policies and permissions are unchanged.

The server worker polls every five seconds. Each cycle inserts at most 250
eligible committed notification/device pairs, then processes at most 25 jobs.
The unique composite primary key and `ON CONFLICT DO NOTHING` prevent duplicate
jobs. A single atomic `FOR UPDATE SKIP LOCKED` claim, ten-minute lease and claim
token coordinate workers. All FCM calls happen outside business transactions.
No FCM provider outage rolls back document/payment/schedule operations.

Temporary failures retry with exponential backoff, capped at one hour and eight
send attempts. Expired claims can be recovered. Invalid/unregistered tokens are
retired by ownership epoch. Provider error codes are recorded without raw errors
or token-bearing payloads. Delivery state is separate from notification read state.

FCM uses the existing Firebase Admin initialization. Payloads contain the existing
title, a safe prompt to open TESTIMONIUM, saved notification/reference IDs, and a
stable display tag. The tag is supplied for both Android background display and
Expo foreground display. One native foreground handler presents the remote push;
no extra local notification is scheduled. Background/normal closed-app delivery
uses an FCM notification payload and does not rely on polling JavaScript.

FCM provides no exactly-once send primitive. A crash after provider acceptance but
before recording success can cause a retry. Stable tags replace an existing tray
entry, but cannot guarantee exactly-once sound or presentation after dismissal.
Actual concurrent PostgreSQL workers and FCM delivery have not been exercised.

## Tap handling

Initial and subsequent taps retain the notification ID while authentication,
product intro, and root navigator readiness resolve. Payload URLs/references do
not determine the destination. The existing ownership-checked mark-read endpoint
returns the saved notification. A protected resource lookup checks that its
reference remains accessible, then navigation uses the existing request/schedule
route. Deleted/inaccessible notifications or references fall back to Notifications.
Network failures retain the pending tap for a later foreground retry.

Session changes cancel navigation. A notification/action pair is handled once per
mounted session, the native last response is cleared after handling, and affected
notification/request/schedule queries are invalidated. Existing polling remains.

## Configuration and release steps

- Added `expo-notifications` with SDK-compatible range `~57.0.12`; the lockfile
  resolves `57.0.24`. Required transitive Expo constants/image utilities were
  updated within SDK 57. Expo, React Native and Firebase versions were unchanged.
- Added its Expo config plugin, Android `POST_NOTIFICATIONS` permission, and the
  `testimonium-important` channel with high importance, default sound/vibration
  and private lockscreen visibility. No iOS push implementation was added.
- Retain a matching Firebase Android `google-services.json` for
  `com.testimonium.app`. Enable FCM HTTP v1 and ensure the existing backend service
  account has permission to send messages in that same Firebase project.
- Backend uses existing `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and
  `FIREBASE_PRIVATE_KEY`; no new push environment secrets are required.
- Apply `20261024090000_android_push` through the normal approved Prisma migration
  process, regenerate Prisma Client, then deploy backend code together with the
  schema. No migration or deployment was performed during implementation.
- Build and install a new EAS Android development/release client. An existing
  development client or Expo Go cannot establish native acceptance.

SDK reference: [Expo SDK 57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).

## Verification

- Focused backend push/cash/payment/scheduling/return suites: 98 tests passed.
  New focused suite is available via `npm run test:android-push`.
- Mobile push/lifecycle/navigation/auth/notification/refresh suites: 50 tests passed
  across eight suites.
- Mobile TypeScript and changed-file ESLint: passed.
- Full mobile lint: fails on the existing `no-require-imports` warning at
  `src/__tests__/schedule.test.ts:333`; that file was not changed.
- Full existing backend `npm test`: 397/400 passed. Three tests in
  `features_regression.test.js` and `qa_pass1.test.js` fail because their scheduling
  transaction fixtures omit `scheduleAlternativeProposal.findMany`, called in
  unchanged `ScheduleService.js`. This full suite does not include the new push
  suite, which has its own command.
- Prisma Client generation, schema validation, schema-to-schema migration diff,
  Expo config resolution, and `git diff --check`: passed. Android-only native
  config introspection also confirms the manifest notification permission and
  FCM default channel. Cross-platform introspection stops at the existing missing
  iOS Firebase services configuration; iOS configuration was not changed.
- No live database migration, provider push, deployment, staging or commit ran.

The configured Android SDK contains platform-tools only; it lacks platforms and
build-tools, and no native Android project is present. A native build was not run. Physical-device
permission presentation, shade delivery while foreground/background/normally
closed, notification sound/vibration, cold-start routing, real token rotation,
offline logout/account switching, and real FCM acceptance remain unverified.
Android force-stop, disabled notifications, missing Google Play services and OEM
battery restrictions can prevent delivery.

## Files

Backend: `prisma/schema.prisma`,
`prisma/migrations/20261024090000_android_push/migration.sql`,
`services/NotificationDispatcher.js`, `services/PushEligibility.js`,
`services/PushDeviceService.js`, `services/PushDeliveryWorker.js`,
`controllers/PushDeviceController.js`, `routes/notificationRoutes.js`, `server.js`,
`scripts/android_push.test.js`, `package.json`.

Mobile: `package.json`, `package-lock.json`, `app.config.ts`, `app/_layout.tsx`,
`src/providers/AuthProvider.tsx`, `src/features/notifications/nativePush.ts`,
`src/features/notifications/pushNavigation.ts`,
`src/features/notifications/useAndroidPush.ts`, `src/__tests__/nativePush.test.ts`,
`src/__tests__/androidPushNavigation.test.tsx`.

Documentation: `docs/ANDROID_PUSH.md`.
