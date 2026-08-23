# TESTIMONIUM Parishioner Mobile — Phase 3 + Phase 4 Implementation Plan

## 1. Executive Verdict
Proceed as one dependent milestone: Phase 3 creates and tracks request lifecycle state; Phase 4 is a request-detail subflow. Include backend hardening before release: the current API cannot reliably prevent duplicate drafts or enforce all configured requirements.

## 2. Current Repository Audit
The Expo app has Phase 0–2 auth, TanStack Query, UID-cleared protected cache, five tabs, and a Requests shell. Backend request detail already returns parish, attachments, payment transactions/receipts/OCR, and request history; mobile has no picker packages installed.

## 3. Phase 0–2 Baseline to Preserve
Retain centralized bearer/401-refresh behavior, `AuthProvider` cache cancellation and clearing, current tab hierarchy, parish/event features, design tokens, and `navigateBackOrReplace`. Do not alter Schedule, Notifications, Profile, or existing parish discovery behavior.

## 4. Phase 3/4 Scope Reconciliation
Support all seven existing canonical document types, not Death/Burial. Support request list/detail, draft wizard, files, corrections, payment instructions, QR display, gallery and camera receipt input, receipt review, and under-review state; do not add reference-number input because the receipt endpoint accepts only multipart `receipt`.

## 5. Backend Request API Audit
### Requirements endpoints
Use `GET /document-requirements?type=<canonical>&parishId=<id>` as the wizard authority. It returns title, description, estimated days, fee, required fields, and required-document IDs; parish settings can alter price and required documents.

### Request list/detail
Use owned `GET /requests` with pagination and supported `search`, `status`, and `documentType` filters; use `GET /requests/:id` for every detail refresh. Detail exposes attachments, correction notes/IDs, fee snapshot, payment data, and actual `requestHistory`.

### Draft creation
`POST /requests` currently requires `parishId`, `documentType`, and `applicantName`; `relationship` and `purpose` are optional in the validator. Harden it to accept all seven canonical types, dynamically validate required form fields, and require a persisted `Idempotency-Key` scoped uniquely to the authenticated user.

### Submit/cancel
Create the draft only when the user confirms the review screen, then upload files and submit. Submit/reconcile through `POST /requests/:id/submit`; cancel through `POST /requests/:id/cancel` only for statuses whose server transition permits `CANCELLED`.

### Supporting files
Use `POST /requests/:id/files`, multipart field `files`, with `category` equal to a requirement ID. Permit PDF/PNG/JPEG/WebP, max 5 MB each, maximum five files per HTTP request; allow multiple batches because some supported document types require more than five distinct categories.

### Correction/resubmission
For `NEEDS_CORRECTION`, load current requirements with the request parish/type, show only `correctionRequirementIds`, upload replacements under those IDs, then call `POST /requests/:id/resubmit-corrections`.

### Tracking/history
Show real `requestHistory` in chronological order. Use tracking lookup only when a tracking-number route is needed; normal mobile navigation uses owned numeric request IDs.

## 6. Request DTOs and State-Transition Model
Persist and render the backend DTO fields: `id`, `trackingNumber`, `isDraft`, `documentType`, `applicantName`, `relationship`, `purpose`, `status`, `paymentStatus`, `fee`, parish summary, attachments, notes, transactions, and history.

State graph: `PENDING -> UNDER_REVIEW|CANCELLED|REJECTED`; `UNDER_REVIEW -> PAYMENT_PENDING|NEEDS_CORRECTION|PROCESSING|REJECTED`; `NEEDS_CORRECTION -> UNDER_REVIEW|CANCELLED|REJECTED`; `PAYMENT_PENDING -> PAYMENT_UNDER_REVIEW|CANCELLED`; `PAYMENT_UNDER_REVIEW -> PAYMENT_VERIFIED|PAYMENT_NEEDS_CORRECTION|REJECTED`; `PAYMENT_NEEDS_CORRECTION -> PAYMENT_UNDER_REVIEW|CANCELLED|REJECTED`; then `PAYMENT_VERIFIED -> PROCESSING|PAYMENT_PENDING`, `PROCESSING -> READY_FOR_PICKUP -> COMPLETED`.

## 7. Backend Payment API Audit
### Payment configuration
Replace mobile use of arbitrary `parishId` with `GET /payment/configuration?requestId=<id>`; backend must verify request ownership and resolve the parish server-side. Return only configured provider objects with account name, account number, and nullable QR URL.

### Fee snapshot
Use `request.fee` only. Never recalculate from current requirements or payment configuration.

### Zero-fee path
Treat `fee === 0` as no payment UI, but render the authoritative request status. Staff moves eligible zero-fee requests from `UNDER_REVIEW` directly to `PROCESSING`.

### Receipt upload
Use `POST /requests/:id/receipt`, field `receipt`; accept only JPEG/PNG under 5 MB. It is eligible only in `PAYMENT_PENDING` or `PAYMENT_NEEDS_CORRECTION`.

### Duplicate detection
Backend hashes and records possible duplicates; it does not return a parishioner-facing duplicate success/error state. Map ordinary endpoint failures only, then refresh detail rather than exposing fraud-specific information.

### OCR truth model
Receipt upload creates OCR work asynchronously and always sets `PAYMENT_UNDER_REVIEW`; OCR does not approve payment. Copy remains “Receipt submitted for review.”

### Payment correction
`PAYMENT_NEEDS_CORRECTION` exposes `paymentCorrectionNote`; upload a replacement through the same receipt endpoint. Prior receipts remain audit evidence and must not be displayed/downloaded from mobile.

## 8. Security / Ownership Audit
Owned request reads and mutations use backend `userId` checks; client route validation is defensive only. Harden supporting-file upload to validate ownership, permitted request state, and requirement category; never import staff routes, construct R2 URLs, log media URLs, or persist sensitive request/media data.

## 9. Proposed Navigation Architecture
Add root-stack routes above tabs: `/requests/new`, `/requests/[requestId]`, and `/requests/[requestId]/payment`. Keep Requests as the tab root; use deterministic replace to detail after successful mutation and unsaved-change confirmation before abandoning a wizard.

## 10. Requests Tab Plan
Replace the shell with paginated owned requests, pull-to-refresh, loading skeleton, empty CTA, query-backed search/filter only where supported, status badges, and a primary new-request action. Exclude unfinished drafts from normal submitted-request presentation or label them explicitly after backend list behavior is finalized.

## 11. Request Detail Plan
Render identity, parish, requester details, fee snapshot, status, requirements/files metadata, correction notes, payment attention action, and real history. Use focused refresh and pull-to-refresh; invalid/non-owned routes show a safe unavailable state.

## 12. Request Wizard Plan
Use in-memory `react-hook-form` state: parish selection, canonical type selection constrained by parish `availableDocuments`, requirement query, required applicant/purpose data, files, review. Changing parish or type resets dependent requirements/files and cancels stale query results.

## 13. Supporting Upload Plan
Add a document picker adapter, client validation, per-requirement replacement, filename/size/type review, and one active upload at a time. Keep selected file URIs only in memory; do not expose file previews through public R2 URLs.

## 14. Request Review / Submit Plan
Review server-bound fields, requirement completion, and selected uploads before one guarded create. Generate one UUID idempotency key for the review attempt, preserve it through ambiguous create recovery, then upload, submit, invalidate request keys, and replace to detail.

## 15. Cancel / Correction / Resubmission Plan
Derive cancel visibility from the audited transition set and use a confirmation dialog. Correction UI is status-specific: document corrections upload required categories then resubmit; payment corrections navigate to payment replacement.

## 16. Request Tracking / History Plan
Use the returned history as the only timeline. Do not synthesize staff processing events or expected dates; display estimated days as requirements metadata, clearly separate from status history.

## 17. Phase 4 Payment Entry / Eligibility Plan
Expose payment only from a current owned detail with `PAYMENT_PENDING` or `PAYMENT_NEEDS_CORRECTION` and nonzero fee. Disable/re-route action immediately after a status refresh changes eligibility.

## 18. Payment Configuration / QR Plan
Fetch configuration keyed by authenticated UID and request ID. Display textual provider details plus QR when present; QR absence is a normal configuration state, not a reason to invent payment details.

## 19. Receipt Selection / Capture Plan
Install `expo-image-picker`; offer gallery and explicit camera actions, request permissions only on selection, reject PDF/HEIC/HEIF/WebP and oversized assets locally, and retain the original JPEG/PNG rather than compressing payment evidence.

## 20. Receipt Upload / Ambiguous Failure Plan
Allow one active upload per request and disable duplicate actions. On timeout, disconnect, or unknown failure, refetch request detail: if status/receipt reflects success, continue to under review; otherwise require an intentional user retry, never automatic POST replay.

## 21. Payment Under Review / Correction UX
After `202`, replace to request detail and refetch. Show under-review copy without OCR confidence or approval claims; show payment-correction note only in its returned status.

## 22. Home / Parish Cross-Feature Integration
Keep Home unchanged for this milestone. Add a parish-detail “Request Document” action only when `availableDocuments` is nonempty; it preselects parish in the wizard but remains editable and creates no draft.

## 23. TanStack Query / Cache Plan
Create UID-prefixed `requestKeys` for list filters, detail, tracking, and requirements, plus `paymentKeys.configuration(requestId)`. Invalidate list/detail/history after create, submit, cancel, correction, files, and receipt upload; retain current logout-wide cancellation and `clear()`.

## 24. Mutation Safety / Race-Condition Plan
Disable retries for every mutation; use synchronous in-flight guards for create, submit, cancel, resubmit, supporting upload, and receipt upload. Backend idempotency resolves create ambiguity; direct detail refetch resolves submit/cancel/upload ambiguity and account-switch race protection remains UID-scoped.

## 25. Loading / Error / Offline Plan
Show cached reads with stale context only where privacy policy permits; all mutations require network and are never queued. Preserve form data for validation/read failures, normalize 400/403/404/413/429/5xx through the existing error layer, and provide retry only for confirmed-safe reads.

## 26. File / Media Privacy Plan
Use backend multipart endpoints only. Do not cache raw files, OCR raw text, URLs, or receipt previews beyond current-screen memory; clear selected media on logout, success, and wizard discard.

## 27. Accessibility Plan
Provide status text plus color, accessible file/camera labels, progress announcements, error summaries, focus-safe dialogs, 44-point controls, keyboard-aware forms, and font-scale verification. QR has a descriptive label while account details remain usable without scanning.

## 28. Native Dependency / EAS Impact
Add `expo-document-picker` for Phase 3 and `expo-image-picker` for Phase 4, plus Image Picker permission configuration in `app.config.ts`. The installed dev client lacks both native modules, so build one new Android development APK after dependencies/configuration land; Phase 3 read/list/detail work can proceed before it, but physical attachment verification cannot.

## 29. File-by-File Change Plan
Create feature-owned request API/types/presentation/query-key modules, request list/detail/wizard/components, upload adapter/validator, and payment subflow/components under `src/features/requests/`. Add the three request routes, replace `RequestsShellScreen`, update parish detail for optional prefill, add picker dependencies/config, backend migration/routes/services/validators/tests, and update mobile API/upload documentation.

## 30. Phase 3A–3F Execution Order
1. Harden backend request types, idempotency, required-field/category/state enforcement, and tests.
2. Add mobile request DTO/API/query keys and presentation helpers.
3. Build list/detail/history and route guards.
4. Build wizard/review/create reconciliation.
5. Add document picker, supporting uploads, submit, cancel, and correction flows.
6. Run static checks, backend contract tests, then Android development-build validation.

## 31. Phase 4A–4F Execution Order
1. Harden payment configuration ownership/context and test it.
2. Add payment eligibility, fee, instructions, and QR subflow.
3. Add Image Picker gallery/camera selection and validation.
4. Add guarded receipt upload/reconciliation and under-review state.
5. Add payment-correction replacement flow and cross-account regression checks.
6. Perform combined request/payment Android verification.

## 32. Automated Test Plan
Test canonical mappings, DTO normalization, status/action presentation, query keys, route ID validation, parish/type race resets, form rules, multipart field names, 5 MB/type/count rules, and all mutation guards. Add backend tests for idempotent create, seven supported types, required-category enforcement, correction states, owned payment configuration, receipt eligibility, and duplicate/replay behavior.

## 33. Physical Android Test Matrix
Cover empty/populated lists, refresh, wizard navigation/back/keyboard, every picker validation, more-than-five total required categories across batches, submit/cancel/corrections, zero-fee and fee-required detail, QR present/absent, gallery/camera receipt, upload ambiguity, under-review/correction, background/foreground, logout-account-switch, TalkBack, and large-font layouts. Record each as physical pass/fail/not executed.

## 34. Static Validation Plan
Run `npm run typecheck`, `npm test -- --runInBand`, `npm run lint`, `npx expo export --platform android`, relevant backend tests, and `git diff --check`; inspect `git status --short` before/after. Do not run EAS, Gradle, migrations against shared data, or destructive Git commands during planning.

## 35. Documentation Updates
Reconcile mobile API, upload/media, navigation, state/offline, testing, environment/build, roadmap, and decision-control documents with the hardened endpoints and native-build requirement. Correct stale web-derived assumptions: 10 MB/WebP receipts, automatic verification, fallback payment data, public receipt viewing, and client compression.

## 36. Risks / Open Questions / Backend Gaps
**BLOCKER:** current validator accepts four document types while configuration/Prisma define seven; align to all seven selected types.  
**BLOCKER:** submission accepts any one attachment and does not validate required categories; enforce requirement completion server-side.  
**BLOCKER:** create has no idempotency/reconciliation contract; add user-scoped idempotency persistence.  
**HIGH:** payment configuration accepts arbitrary `parishId`; move to owned `requestId` context.  
**MEDIUM:** no attachment-delete API; replacement is re-upload by category, so the UI must not promise deletion.  
**MEDIUM:** the maximum five files applies per HTTP request while two types require more categories; retain five-per-batch but support multiple batches.  
Resolved decisions: include backend hardening, support all seven existing types, exclude Death/Burial, and include gallery plus camera. No further product decision is required before implementation.

## 37. Phase 3 Exit Criteria
All seven types create/submit through hardened backend validation; request list/detail/history, uploads, cancellation, and correction resubmission work without duplicate mutation or cross-account cache exposure; static gates pass and physical Android attachment tests are recorded.

## 38. Phase 4 Exit Criteria
Owned request context controls configuration and payment eligibility; zero-fee requests bypass payment; JPEG/PNG gallery/camera receipts upload once, reconcile ambiguity, and truthfully reach under review/correction states; static gates and physical Android tests are recorded.

## 39. Combined Milestone Exit Criteria
The complete request-to-payment lifecycle uses current server state, no staff/scheduling/notification expansion, no direct R2 access, no unsafe automatic mutation retry, updated documentation, and recorded backend plus Android evidence.

## 40. Recommended Execution Model / Reasoning Level
Implement in sequential Phase 3 then Phase 4 slices with high-reasoning review at every mutation boundary. Treat backend contract tests and physical Android evidence as release gates, not optional cleanup.
