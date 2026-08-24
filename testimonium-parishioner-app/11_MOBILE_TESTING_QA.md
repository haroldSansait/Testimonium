# TESTIMONIUM Parishioner Mobile — Testing & QA

**Last reconciled:** 24 August 2026
**Status:** 22 automated Jest test suites (161 tests) passing; static typecheck and ESLint clean.

## 1. Test suite overview

The mobile app includes comprehensive automated test coverage (`npm test -- --runInBand`):

| Test Suite File | Test Scope & Assertions |
| :--- | :--- |
| `apiClient.test.ts` | Base URL resolution, bearer token attachment, single-flight 401 retry, error normalization. |
| `authGuards.test.ts` | Onboarding gating, verified status, legal acceptance checks, role restrictions. |
| `authRegistration.test.ts` | Registration form validation, partial-failure reconciliation, Firebase user preservation. |
| `emailVerification.test.ts` | Single-flight verification rechecks, AppState integration, 60s cooldown. |
| `environment.test.ts` | Typed environment helpers, fallback values, client secret omission validation. |
| `errors.test.ts` | `AppError` normalization across 400, 401, 403, 404, 409, 413, 429, 500, network timeouts. |
| `events.test.ts` | Month-filtered public events query parsing, chronological sorting, section error retry. |
| `googleAuth.test.ts` | Google Sign-In credential exchange, local session reset, JIT legal challenge handling. |
| `legalAcceptance.test.ts` | Legal version constants (`v1.0`), acceptance payload structures, modal viewing. |
| `navigationBack.test.ts` | `navigateBackOrReplace` with tab-root fallbacks across modal and stack routes. |
| `notifications_events.test.ts` | Notification inbox fetching, mark read, mark all read, reference navigation. |
| `parishes.test.ts` | Directory search debouncing, type filtering, pagination, contact link handlers. |
| `paymentQrCard.test.tsx` | Payment QR rendering, modal zoom interaction, textual merchant details. |
| `phase2Boundary.test.ts` | Route boundaries, role isolation, tab navigator configuration. |
| `profileCompletion.test.ts` | Gating rules, `PUT /auth/profile` direct commit without redirect loops. |
| `profile_settings.test.ts` | Edit profile validation, settings navigation, legal modal rendering, sign-out. |
| `requestsApi.test.ts` | Draft creation, submission, file attachment upload, correction resubmission. |
| `requestsPresentation.test.ts` | Status label mappers, fee formatting, tracking number display, timeline sorting. |
| `requestsQueryKeys.test.ts` | Structured query-key generation and invalidation hierarchies. |
| `routingGuards.test.ts` | Deterministic auth state routing (`BOOTING` → `AUTHENTICATED_READY`). |
| `schedule.test.ts` | Authoritative parish config, availability dates, slot calculations, idempotency keys, reschedule responses. |
| `supportingUpload.test.ts` | Multi-file validation, MIME checking, 5 MB file size limit enforcement. |

## 2. Test execution commands

```bash
# Run full Jest test suite in band
npm test -- --runInBand

# TypeScript typecheck
npm run typecheck

# ESLint verification (zero errors, zero warnings)
npm run lint

# Export static Android bundle (Metro verification)
npx expo export --platform android
```

## 3. QA and manual verification matrix

### 3.1 Verification status summary
- **STATIC VERIFICATION:** PASS (`npm run typecheck`, `npm run lint`)
- **AUTOMATED JEST SUITES:** PASS (22 suites, 161 tests passing)
- **METRO JS BUNDLE EXPORT:** PASS (`npx expo export --platform android` bundles cleanly)
- **BACKEND INTEGRATION TESTS:** PASS (28 tests covering scheduling parity, idempotency, upload middleware)
- **PHYSICAL RUNTIME QA:** In progress via `npm run dev:mobile` launcher.

### 3.2 Physical device test scenarios
1. **Auth & Onboarding:** Fresh registration, email verification link, Google Sign-In, profile completion, logout cache purging.
2. **Document Requests:** 5-step wizard completion, document draft submission, supporting PDF upload, tracking timeline inspection, correction resubmission.
3. **Payment & Receipts:** GCash/Maya QR viewing, photo capture and gallery selection, iOS HEIC conversion, receipt upload, status transition to `PAYMENT_UNDER_REVIEW`.
4. **Scheduling:** Slot availability calculation against 90-day horizon, booking creation with idempotency, slot conflict resolution, reschedule accept/decline.
5. **Notifications & Deep Links:** Receiving in-app alerts, marking all as read, tapping notifications to navigate to requests/schedules, launching `testimonium://` deep links.
