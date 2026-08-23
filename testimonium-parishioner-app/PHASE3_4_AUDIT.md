TESTIMONIUM Phase 3 + 4 Post-Implementation Audit
1. Executive Verdict
FIX BEFORE EAS
The request/payment architecture and native dependency setup are broadly aligned, but three release-blocking workflow defects remain: the active dev DB lacks the idempotency migration, required attachment categories can be bypassed, and a failed draft cannot reliably be resumed.
2. Current Domain Scope Verification
All seven canonical document types are consistently represented in Prisma, backend constants/configuration, and mobile labels.
No active Phase 3/4 runtime use of ENDORSEMENT, DEATH_CERTIFICATE, or BURIAL_CERTIFICATE was found.
Backend honours parish availableDocuments, price overrides, and configured requirement toggles.
Phase 3/4 changes do not touch scheduling, ScheduleEventType, mass templates, parish events, or availabilities.
Mobile defect: an explicitly empty availableDocuments array is treated as “all documents” in [RequestWizardScreen.tsx (line 147)](/C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/requests/RequestWizardScreen.tsx:147), contrary to backend semantics.
3. Backend Architecture Preservation
PASS. Mobile uses authenticated /api/v1 endpoints only; no direct database or R2 credentials/service layer were added. Existing Express → Prisma → PostgreSQL architecture and Firebase identity middleware remain in place.
4. Idempotency Migration Status
MIGRATION STATUS: PENDING
The migration is additive/non-destructive: it creates idempotency_keys, indexes, a uniqueness constraint on (user_id, key, resource_type), and a user foreign key in [migration.sql (line 1)](/C:/Users/me/Documents/testimonium/testimonium-backend/prisma/migrations/20260823120000_add_idempotency_keys/migration.sql:1).
Direct read-only database checks found:
no _prisma_migrations record for 20260823120000_add_idempotency_keys;
public.idempotency_keys does not exist;
the generated Prisma client exposes prisma.idempotencyKey as undefined.
prisma migrate status could not run because its schema engine download is blocked locally, but the direct database evidence establishes PENDING.
5. Idempotency Race Audit
FAIL.
The implementation checks for an existing key, creates the request, then records the key ([ParishionerRequestService.js (line 52)](/C:/Users/me/Documents/testimonium/testimonium-backend/services/ParishionerRequestService.js:52)). The fallback write uses ON CONFLICT DO NOTHING and does not recover the winning request ([IdempotencyService.js (line 69)](/C:/Users/me/Documents/testimonium/testimonium-backend/services/IdempotencyService.js:69)).
On the current DB, lookup and recording silently fall back after the missing-table error. Thus a same-key retry creates another draft rather than replaying the original.
No actual concurrent same-key race test exists. The backend suite only tests key format and payload hashes.
6. Draft Recovery Audit
PARTIAL / unsafe.
Drafts are listed, display as drafts, and open into detail. However the detail screen advertises continuation while offering only “Finalize & Submit”; it cannot add missing draft attachments ([RequestDetailScreen.tsx (line 267)](/C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/requests/RequestDetailScreen.tsx:267)). If a wizard upload fails and the user leaves, a later wizard invocation uses a new key and can create another draft.
7. Requirement / Supporting Upload Enforcement
FAIL — blocker.
The backend resolves parish-specific requirements at create and submit time, including configured fees and required-document toggles. Normal mobile uploads use requirement IDs and serialize uploads, so document types with over five requirements work across requests.
However, upload validation permits generic "primary" and "supporting" categories ([ParishionerRequestController.js (line 178)](/C:/Users/me/Documents/testimonium/testimonium-backend/controllers/ParishionerRequestController.js:178)), while submit accepts either a requirement ID or its shared category ([ParishionerRequestService.js (line 247)](/C:/Users/me/Documents/testimonium/testimonium-backend/services/ParishionerRequestService.js:247)). One forged "supporting" upload can therefore satisfy every supporting requirement for Marriage Banns or Permit to Marry.
MIME/extension and 5 MB limits are correctly enforced; receipts are separately restricted to JPEG/PNG.
8. Request State / Mutation Safety
Mostly PASS.
Backend ownership/state checks exist for submit, cancel, correction resubmission, support uploads, and receipts.
Mobile uses retry: false for all Phase 3/4 mutations and synchronous in-flight guards.
Mobile refetches after failed submit/cancel/receipt attempts.
The create ambiguity path remains unsafe because its server-side idempotency persistence is not operational.
9. Payment Configuration / Web Compatibility
Mobile correctly calls payment configuration with an owned requestId; backend resolves the parish server-side and verifies request ownership.
WEB REGRESSION STATUS:
Admin Portal — NOT AFFECTED; no caller of this endpoint, production build passes.
Parishioner Web — PASS; legacy parishId caller remains supported and production build passes. Live authenticated endpoint testing was not performed.
The Diocesan fallback pre-existed Phase 3/4. It is hard-coded rather than stored as authoritative system configuration, and parish account details also fall back to placeholder numbers ([PaymentConfigurationService.js (line 82)](/C:/Users/me/Documents/testimonium/testimonium-backend/services/PaymentConfigurationService.js:82)). Classify this as MEDIUM: request-scoped mobile resolution avoids cross-parish substitution, but production payment destinations must be verified before enabling payments.
10. Fee Snapshot / Zero-Fee Audit
PASS. Draft creation snapshots the resolved parish fee; mobile renders the request’s fee and only exposes payment for positive-fee payment states. Zero-fee requests do not expose payment UI.
11. Receipt / OCR / Replay Audit
PASS by static review.
Receipt upload enforces ownership, only allows PAYMENT_PENDING / PAYMENT_NEEDS_CORRECTION, limits JPEG/PNG to 5 MB, hashes the uploaded bytes, retains previous evidence, moves to PAYMENT_UNDER_REVIEW, and dispatches OCR asynchronously. Mobile copy correctly says staff review, not automatic approval.
12. Mobile Cache / Account Isolation
PASS. Request and payment query keys are UID-scoped; logout cancels queries and clears the query client in [AuthProvider.tsx (line 96)](/C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/providers/AuthProvider.tsx:96). Feature-local picker state is component-local and unmounts on auth-route exit.
13. Native Dependency / EAS Audit
PASS after functional fixes.
expo-document-picker ~57.0.1 and expo-image-picker ~57.0.12 match Expo SDK 57.
app.config.ts configures only image-library and camera permissions.
No microphone/audio permission or unrelated native configuration was added.
NEW EAS DEVELOPMENT BUILD REQUIRED: YES — both picker modules require a development client containing their native code.
14. Test Coverage Gap Analysis
“100% automated test coverage” is unsupported. The repository has no coverage command or instrumentation; current evidence is a 100% test pass rate only.
Meaningful gaps include:
real DB migration/delegate verification;
same-key replay and different-payload 409 against a database;
concurrent same-key race;
attachment-category bypass;
draft recovery after partial upload;
custom parish fee/requirement integration;
owned payment-config authorization;
receipt eligibility/replay integration;
account-switch mutation races.
15. Findings
BLOCKER — Pending migration and stale generated Prisma client. [migration.sql (line 1)](/C:/Users/me/Documents/testimonium/testimonium-backend/prisma/migrations/20260823120000_add_idempotency_keys/migration.sql:1), [IdempotencyService.js (line 39)](/C:/Users/me/Documents/testimonium/testimonium-backend/services/IdempotencyService.js:39).
Apply the migration only to the verified dev DB, regenerate Prisma client, and fail deployment if idempotency storage is unavailable.

BLOCKER — Required supporting categories are bypassable. [ParishionerRequestController.js (line 178)](/C:/Users/me/Documents/testimonium/testimonium-backend/controllers/ParishionerRequestController.js:178), [ParishionerRequestService.js (line 247)](/C:/Users/me/Documents/testimonium/testimonium-backend/services/ParishionerRequestService.js:247).
Accept only authoritative requirement IDs and require every required ID; do not satisfy requirements through generic primary/supporting categories.

HIGH — Draft recovery cannot actually continue attachment work after leaving the wizard. [RequestDetailScreen.tsx (line 267)](/C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/requests/RequestDetailScreen.tsx:267).
Add an explicit resume-draft flow that loads the existing draft and its server attachments, or support adding missing attachments on the draft detail screen.

MEDIUM — Explicitly disabled parish catalogs appear enabled in the wizard. [RequestWizardScreen.tsx (line 147)](/C:/Users/me/Documents/testimonium/testimonium-parishioner-app/src/features/requests/RequestWizardScreen.tsx:147).
Treat [] as no offered products, matching backend behavior.

MEDIUM — Payment fallback destinations are hard-coded placeholders, not authoritative Diocesan configuration. [PaymentConfigurationService.js (line 95)](/C:/Users/me/Documents/testimonium/testimonium-backend/services/PaymentConfigurationService.js:95).
Store and validate an explicit Diocesan configuration, or return unavailable payment configuration when none is configured.

LOW — git diff --check fails on three whitespace errors in backend files.
Remove the two final blank lines and trailing whitespace before commit.

16. Validation Results
Backend Phase 3/4 tests: PASS — 6/6.
Mobile typecheck: PASS.
Mobile tests: PASS — 17 suites, 106 tests; Jest reports an unresolved async-handle warning.
Mobile lint: PASS.
Parishioner Web build: PASS.
Admin Portal build: PASS.
Backend syntax checks: PASS.
git diff --check: FAIL — three whitespace errors.
Native build, Gradle, prebuild, EAS, and physical Android testing: NOT RUN.
17. Final EAS Recommendation
READY TO RUN EAS: NO
Do not create the Android development build until the three blocker/high workflow fixes are complete and verified against an isolated development database. After that, one new Android EAS development build is sufficient for both picker dependencies.