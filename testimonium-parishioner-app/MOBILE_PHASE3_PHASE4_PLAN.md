# TESTIMONIUM Parishioner Mobile — Phase 3 + Phase 4 Planning Brief

**Target milestone:** Phase 3 — Document Request Core + Phase 4 — Payment & Receipt Capture  
**Planning mode:** Audit first, plan only. Do not implement from this file.  
**Target implementation platform:** Expo / React Native parishioner mobile app  
**Primary authenticated role:** `PARISHIONER`  
**Canonical brand primary:** `#7B1C2A`

---

# 1. Purpose

Create a complete, repository-audited implementation plan for TESTIMONIUM Parishioner Mobile **Phase 3 and Phase 4 as one coordinated milestone**, while preserving their execution dependency:

```text
Phase 3 — Document Request Core
        ↓
Phase 3 verified against real backend
        ↓
Phase 4 — Payment & Receipt Capture
        ↓
Combined audit + physical Android verification
```

Plan both phases together because payment is attached to the document-request lifecycle, but **do not plan their code as two independent parallel systems**.

Phase 4 must consume the request state, fee snapshot, ownership rules, and workflow produced by Phase 3.

The final implementation plan must be specific enough that a separate coding agent can execute it without re-deciding architecture, API ownership, mutation safety, route hierarchy, or workflow boundaries.

---

# 2. Repository Context

Repository root:

```text
C:\Users\me\Documents\testimonium
```

Mobile app:

```text
C:\Users\me\Documents\testimonium\testimonium-parishioner-app
```

Backend:

```text
C:\Users\me\Documents\testimonium\testimonium-backend
```

Parishioner web:

```text
C:\Users\me\Documents\testimonium\testimonium-parishioner-web
```

The parishioner web portal may be used as a **workflow/UI reference only** after the mobile and backend contracts are audited.

Do not blindly port web components or assumptions to React Native.

The backend remains the source of truth.

---

# 3. Required Reading Before Planning

Read the current versions of the following mobile documentation in full before producing the implementation plan:

```text
00_MOBILE_README.md
01_MOBILE_PRODUCT_SCOPE.md
02_MOBILE_ARCHITECTURE.md
03_MOBILE_NON_NEGOTIABLE_RULES.md
04_MOBILE_DESIGN_SYSTEM.md
05_MOBILE_NAVIGATION_AND_SCREEN_MAP.md
06_MOBILE_BACKEND_API_CONTRACT.md
07_MOBILE_AUTH_SESSION_SECURITY.md
08_MOBILE_STATE_DATA_OFFLINE.md
09_MOBILE_UPLOADS_PAYMENTS_MEDIA.md
10_MOBILE_NOTIFICATIONS_DEEPLINKING.md
11_MOBILE_TESTING_QA.md
12_MOBILE_ENV_BUILD_RELEASE.md
13_MOBILE_IMPLEMENTATION_ROADMAP.md
14_MOBILE_FUTURE_RAG_ASSISTANT.md
15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md
```

Also read:

```text
MOBILE_PHASE2_PLAN.md
MOBILE_PHASE2_IMPLEMENTATION_PLAN.md
MOBILE_PHASE2_EXECUTION.md
```

and inspect the **actual current Phase 2 implementation**, because Phase 2 has already been implemented, remediated, and physically tested successfully.

Read current backend source for all request/payment endpoints, validators, services, repositories, Prisma schema/models, middleware, upload configuration, OCR/receipt handling, and status transitions.

Read the current parishioner web request/payment workflow only to identify proven UX patterns or backend assumptions that may help mobile.

Do not treat an old document or web implementation as more authoritative than the current backend source.

---

# 4. Authority / Conflict Order

If sources conflict, use this precedence:

```text
1. Actual current backend and mobile source code
2. Current Prisma schema / validators / services / route behavior
3. Current API documentation
4. Current mobile Phase 3/4 product + upload/payment documentation
5. MOBILE_PHASE3_PHASE4_PLAN.md
6. Older implementation docs / parishioner web behavior
```

Do not silently preserve stale assumptions.

Explicitly document every meaningful conflict discovered.

---

# 5. Correct Phase Numbering

The binding mobile roadmap is:

```text
Phase 0 — Foundations
Phase 1 — Authentication & Onboarding
Phase 2 — Mobile Shell, Home & Parish Directory
Phase 3 — Document Request Core
Phase 4 — Payment & Receipt Capture
Phase 5 — Scheduling
Phase 6 — Notifications & Event Calendar
Phase 7 — Profile, Settings & Polish
```

Therefore:

```text
Phase 3 = Document Requests
Phase 4 = Payments / Receipt Capture
Phase 5 = Scheduling
Phase 6 = Notifications
```

Do not move Scheduling into Phase 3 or Document Requests into Phase 4.

---

# 6. Verified Phase 0–2 Baseline That Must Be Preserved

Do not destabilize the already-working mobile foundation.

Preserve:

- Expo Router protected `(app)` architecture;
- root Stack above the five-tab navigator;
- Home / Requests / Schedule / Parishes / Profile tabs;
- Native Firebase authentication;
- email/password login/logout;
- Google Sign-In/logout;
- email verification;
- legal acceptance;
- profile completion;
- `PARISHIONER` + `ACTIVE` access gate;
- auth observer suppression during interactive operations;
- generation/UID stale-response protection;
- centralized authenticated API client;
- bearer injection;
- one forced token refresh + one 401 retry;
- normalized errors;
- timeout/cancellation behavior;
- TanStack Query;
- query cancellation + cache clear on logout/account switch;
- safe back-navigation helper;
- parish directory/detail;
- event previews;
- notification shell;
- working Call / Email / Directions actions;
- `npm run dev:mobile` launcher;
- Cloudflare Quick Tunnel + DoH fallback;
- existing Google-enabled Android development APK.

Do not rewrite working authentication or Phase 2 discovery code unless a concrete integration need is proven.

---

# 7. Core Domain Rules

## 7.1 Parishioner scope

The authenticated mobile role is:

```text
PARISHIONER
```

Do not expose:

- staff request processing;
- secretary/coordinator controls;
- staff status transitions;
- parish settings;
- payment QR mutation;
- OCR review controls;
- admin dashboards;
- activity logs.

## 7.2 No home parish assumption

A parishioner is **not permanently tenant-bound to one parish**.

The request workflow may allow the parishioner to select a **target parish**, as permitted by backend rules.

Do not introduce:

```text
homeParishId
preferredParishId
automatic tenant scope
"your parish" authorization
```

unless the actual backend now explicitly defines such a concept.

## 7.3 Backend is workflow authority

The mobile app must not independently decide:

- whether a request is eligible for submission;
- which document requirements apply;
- authoritative fee amount;
- whether a request may be cancelled;
- whether corrections may be resubmitted;
- whether payment is required;
- whether payment is verified;
- status transitions;
- staff review outcomes.

Client validation is for UX only.

---

# 8. Combined Milestone Strategy

Plan Phase 3 and Phase 4 together so their routes, DTOs, query keys, state model, components, and user journey are compatible.

However, execution must be staged.

Recommended conceptual order:

```text
3A — Request API/domain audit + read models
3B — Requests tab/list/detail
3C — Request creation draft wizard
3D — Supporting-document uploads
3E — Review/submit/cancel/correction workflow
3F — Phase 3 validation

4A — Payment eligibility + config
4B — Payment instructions / amount / QR
4C — Receipt selection/capture/upload
4D — Payment-under-review / correction states
4E — Combined request/payment reconciliation
4F — Phase 4 validation

Final — combined audit + physical Android testing
```

The planning agent may refine the subphase names/order if actual repository evidence supports a better structure.

---

# 9. Known Backend Endpoint Baseline — Must Be Verified

The current API documentation describes these parishioner request/payment endpoints:

```text
GET  /api/v1/document-requirements
GET  /api/v1/document-requirements/:type

POST /api/v1/requests
POST /api/v1/requests/:id/submit
POST /api/v1/requests/:id/cancel
GET  /api/v1/requests
GET  /api/v1/requests/:id
GET  /api/v1/requests/tracking/:trackingNumber
POST /api/v1/requests/:id/files
POST /api/v1/requests/:id/receipt
POST /api/v1/requests/:id/resubmit-corrections

GET  /api/v1/payment/configuration
```

Do not assume the exact request/response DTOs from this list.

Audit actual:

- routes;
- auth/ownership middleware;
- controller parsing;
- service validation;
- repository selection;
- Prisma fields/relations;
- serialization;
- query params;
- multipart field names;
- status preconditions;
- error codes/messages.

Explicitly report any API needed by Phase 3/4 that is missing or unsafe.

---

# 10. Required Backend Audit — Document Requirements

Audit:

```text
GET /document-requirements
GET /document-requirements/:type
```

Determine:

- exact document-type values;
- whether `parishId` is accepted;
- whether requirements differ by parish;
- response shape;
- required/optional metadata;
- file requirements;
- descriptive copy;
- fee-related fields, if any;
- whether requirements are active/inactive;
- ordering;
- any staff-only/internal fields that mobile must ignore.

Do not hardcode a requirements matrix if backend metadata can provide it.

If the backend does not provide enough structured metadata for a safe mobile wizard, identify the exact gap instead of inventing a client-only requirements engine.

---

# 11. Required Backend Audit — Request DTO / Lifecycle

Trace the actual `DocumentRequest` lifecycle from source.

Do not invent status names from screenshots or old docs.

Produce a state-transition map based on actual code.

At minimum determine which states correspond to concepts such as:

```text
draft
submitted
under staff review
payment required
payment under review
payment verified / accepted
needs correction
resubmitted
ready / approved
completed / released
cancelled
rejected
```

Only use statuses that actually exist.

For every status determine:

- allowed parishioner actions;
- visible UI;
- staff-only transitions;
- payment relevance;
- correction relevance;
- cancellation eligibility;
- terminal vs non-terminal;
- whether detail/history includes transition timestamps/remarks.

The mobile UI must derive action availability from backend state, not a duplicated client state machine that can drift.

---

# 12. Phase 3 — Requests Tab

Replace the current Requests placeholder with a real parishioner request experience.

Plan:

- request list;
- empty state;
- loading/skeleton state;
- refresh;
- error with retry;
- request cards;
- status presentation;
- tracking number where returned;
- parish/document type;
- created/submitted timestamp;
- payment/correction attention banner when appropriate;
- `Start Request` primary action.

Audit whether backend list supports:

- pagination;
- status filter;
- search;
- sort.

Do not invent list filters that the API does not support.

If list is small and unpaginated, document that honestly.

---

# 13. Phase 3 — Request Detail

Plan a protected request detail route.

Conceptual route:

```text
app/(app)/requests/[requestId].tsx
```

or equivalent current Expo Router convention.

Validate route params strictly before fetching.

Detail should present only real fields such as:

- document type;
- target parish;
- tracking number;
- applicant/request metadata;
- current status;
- fee snapshot/payment state where applicable;
- actual submitted supporting files metadata;
- staff correction notes when exposed;
- actual workflow/history entries if exposed;
- created/submitted/updated dates;
- available parishioner actions.

Do not fabricate timeline events.

If the backend only exposes current status and not actual history, show a clearly labeled expected process separately or do not show a history timeline.

---

# 14. Phase 3 — Request Creation Draft Wizard

The roadmap requires:

- request creation draft;
- requirements;
- applicant/purpose fields;
- supporting files;
- review;
- submit.

The implementation plan must audit exactly how `POST /requests` behaves.

Determine whether draft creation occurs:

```text
A. immediately after parish/document selection
or
B. only after form fields are complete
```

Plan the draft lifecycle to minimize orphaned/duplicate drafts.

Recommended UX structure, subject to backend DTO:

```text
Step 1 — Select target parish
Step 2 — Select document type
Step 3 — Review authoritative requirements
Step 4 — Enter required applicant/request information
Step 5 — Add supporting files
Step 6 — Review draft
Step 7 — Submit
```

The audited backend may justify a different ordering.

The wizard must survive normal rerenders/navigation without accidentally creating multiple drafts.

Do not persist incomplete server mutations into an offline queue.

---

# 15. Request Draft Duplicate / Ambiguous Mutation Safety

This is a critical Phase 3 requirement.

Mutations must **not** use automatic retries.

For:

```text
POST /requests
POST /requests/:id/submit
POST /requests/:id/cancel
POST /requests/:id/resubmit-corrections
```

plan:

- one active mutation at a time;
- disable duplicate action while pending;
- no double-tap duplicate submission;
- no automatic TanStack mutation retry;
- preserve server error details through normalized safe mapping;
- distinguish deterministic validation rejection from ambiguous network/timeout failure.

For an ambiguous failure after a POST may have reached the backend:

```text
mutation timeout/network break
        ↓
DO NOT blindly repeat POST
        ↓
refetch/reconcile request list/detail
        ↓
determine whether operation already succeeded
        ↓
only allow retry when state proves it is safe
```

If the backend provides an idempotency mechanism, audit and use it.

If not, document reconciliation strategy.

---

# 16. Applicant / Purpose / Relationship Fields

Audit the actual `POST /requests` validator.

Determine exact fields and conditional rules.

Do not create generic form fields based only on old UI.

Plan:

- React Hook Form + Zod only if consistent with current mobile stack;
- backend DTO mirrored accurately;
- mobile validation not stricter than backend without product reason;
- field-level backend errors mapped to meaningful controls;
- keyboard/input types;
- multiline purpose/reason where required;
- safe trimming;
- no uncontrolled/controlled warnings;
- accessibility labels and error announcements.

Do not collect fields that the backend does not store.

---

# 17. Supporting Document Uploads

Known documented backend rule:

```text
POST /requests/:id/files
multipart field: files
maximum: 5 supporting files
accepted: PDF, PNG, JPEG, WebP
maximum size: 5 MB each
```

Verify actual middleware/source.

Plan mobile selection UX for:

- document picker;
- photo/image selection if appropriate;
- file metadata display;
- remove before upload;
- per-file validation;
- max-count handling;
- upload pending state;
- failed upload retry/reconciliation.

Do not upload directly to R2.

All uploads go:

```text
Mobile → Express API → R2
```

No R2 credentials in the client.

---

# 18. Supporting Upload Mutation Safety

For supporting files:

- only one active upload mutation per request unless source proves concurrent upload is safe;
- no automatic mutation retry;
- allow cancellation where current API client/picker architecture supports it;
- do not show fake percentage progress;
- use indeterminate progress if real byte progress is unavailable;
- preserve already-confirmed server files when a later upload fails;
- after ambiguous failure, refetch request detail/file list before allowing the same file to be sent again.

Audit whether backend deduplicates supporting documents.

Do not assume receipt hash protection also applies to supporting files.

---

# 19. File Privacy

Supporting documents and receipts can contain sensitive personal information.

Plan:

- no logging local URI paths unnecessarily;
- no logging R2 URLs;
- no share button unless explicitly required;
- no clipboard copy of private URLs;
- no automatic save to public gallery;
- no unnecessary prefetch of private media;
- temporary generated/compressed file cleanup where feasible;
- clear local picker state when the workflow ends/logout occurs.

Do not cache private attachment bytes in TanStack Query.

---

# 20. Request Review + Submit

Before submission, show a review step based on authoritative current data.

Plan:

- document type;
- parish;
- applicant/purpose fields;
- supporting files;
- any required acknowledgement;
- fee information only if backend safely exposes it at this stage.

The final Submit action:

- must be single-flight;
- must not auto retry;
- must handle 409/state conflict;
- must reconcile ambiguous timeout;
- on confirmed success, invalidate/refetch list/detail;
- navigate deterministically to request detail/status rather than relying on fragile `back()` behavior.

Do not present `Submitted` before server confirmation.

---

# 21. Cancel Workflow

Audit:

```text
POST /requests/:id/cancel
```

Determine backend eligibility rules.

UI should show Cancel only when current backend status permits it.

Plan:

- explicit confirmation;
- pending/disabled state;
- no double submit;
- no auto retry;
- ambiguous failure reconciliation;
- detail/list invalidation;
- cancelled state presentation.

Do not recreate cancellation eligibility entirely in client code if backend already rejects invalid states.

---

# 22. Correction / Resubmission Workflow

Audit:

```text
POST /requests/:id/resubmit-corrections
```

and actual correction data exposed in request detail.

Determine:

- which statuses allow resubmission;
- whether correction notes are exposed;
- whether staff identifies specific invalid files;
- whether fields or files may be replaced;
- exact body/attachments expected;
- whether original uploads remain;
- what status follows resubmission.

Plan mobile UX so the parishioner sees:

```text
What needs correction
→ what can be changed
→ what files must be replaced
→ review
→ resubmit
```

Do not expose staff-only controls.

Notifications for corrections remain Phase 6; Phase 3/4 should reflect correction state when the user opens the app/request.

---

# 23. Request Tracking / History

Use:

```text
GET /requests
GET /requests/:id
GET /requests/tracking/:trackingNumber
```

only as appropriate.

Audit whether tracking-by-number provides anything that detail-by-ID does not.

Since the user is authenticated and owner-scoped, avoid creating redundant screens if request detail already covers tracking.

Plan a status component that can later integrate with Phase 6 notification deep links.

Distinguish:

- actual recorded history;
- current status;
- expected workflow.

Never fabricate completed steps.

---

# 24. Phase 4 — Payment Eligibility

Phase 4 must attach to an existing request.

Do not build a standalone wallet/payment product.

Audit how the backend indicates:

- payment required;
- zero fee;
- fee amount;
- payment status;
- whether receipt upload is currently allowed;
- whether payment correction/re-upload is allowed.

The request's authoritative fee snapshot/payment amount wins.

Do not recalculate from current parish settings after the request has already captured a fee.

---

# 25. Zero-Fee Flow

The backend previously implemented a zero-fee path.

Audit its current behavior.

If the authoritative request amount is zero:

```text
Do not show payment QR
Do not ask for receipt
Do not invent a payment step
```

Continue to display the actual request status returned by the backend.

Do not infer payment completion from amount alone if current workflow uses a specific status.

---

# 26. Payment Configuration

Audit:

```text
GET /payment/configuration
```

Determine:

- query/context requirements;
- whether requestId/parishId/document type is required;
- provider name;
- account name/number;
- payment instructions;
- QR URL;
- availability flags;
- any internal fields that mobile must not expose.

Never hardcode:

```text
GCash
Maya
bank details
account numbers
QR URL
payment instructions
```

when backend configuration provides them.

If configuration is absent, show a safe unavailable state.

Do not silently substitute made-up payment details.

---

# 27. Payment UX

Plan payment as a request-detail subflow.

Conceptually:

```text
Request Detail
    ↓
Payment required
    ↓
View authoritative amount
    ↓
View payment method/details
    ↓
Open/enlarge QR if present
    ↓
User pays outside TESTIMONIUM
    ↓
Choose/capture receipt
    ↓
Review receipt
    ↓
Upload once
    ↓
Payment proof under review
```

Do not imply TESTIMONIUM directly charges the user's GCash/Maya account unless actual backend product behavior changes.

---

# 28. Payment QR Presentation

If backend provides QR:

- render from real URL only;
- provide loading/error state;
- large enough to scan;
- high-contrast container;
- tap to enlarge if useful;
- handle broken image;
- do not log URL;
- no save/share unless explicitly approved.

Also display textual account/payment details when available because the user may not have a second device to scan their own screen.

---

# 29. Receipt Input

Known documented receipt rules:

```text
multipart field: receipt
accepted: JPEG, PNG
max: 5 MB
PDF receipt: rejected
HEIC/HEIF receipt: rejected by backend
```

Verify source.

For Android Phase 4:

plan:

- gallery/photo selection;
- camera capture only if justified and supported;
- preview;
- file type validation;
- size validation;
- replace/remove before upload.

Do not request camera/media permissions at startup.

Request permission only when user chooses the relevant action.

If camera/gallery dependencies are not already installed, the implementation plan must explicitly report native/EAS impact before execution.

---

# 30. iOS / HEIC Scope

Current development priority is Android.

Do not let iOS HEIC handling block Android Phase 4 completion.

The roadmap mentions HEIC conversion because iPhones commonly produce HEIC.

For this milestone, the implementation plan must explicitly classify one of:

```text
A. Android-only implementation now; HEIC/iOS deferred
B. Cross-platform picker/conversion already available without destabilizing Android
C. New native dependency required; separate native/EAS decision needed
```

Do not silently add a native image conversion package.

---

# 31. Oversized Receipt Handling

If JPEG/PNG is over 5 MB:

Preferred plan:

```text
validate
→ explain limit
→ only resize/compress if approved and supported
→ preserve legibility
→ preview
→ upload
```

Do not automatically crop.

Do not use aggressive compression that can destroy:

- reference number;
- amount;
- timestamp;
- provider/account details.

If safe compression is not already supported, reject with clear UX rather than adding risky complexity during Phase 4.

---

# 32. Receipt Upload Safety

This is a high-risk mutation.

For:

```text
POST /requests/:id/receipt
```

require:

- one active receipt upload per request;
- disabled upload action while pending;
- no automatic retry;
- no double-tap;
- cancellation where technically supported;
- clear uploading state;
- no fake percentage progress.

For timeout/network ambiguity:

```text
Upload may have reached backend
        ↓
DO NOT immediately upload again
        ↓
refetch request/payment state
        ↓
check whether receipt/payment transaction now exists
        ↓
only allow retry when safe
```

The backend's duplicate detection remains authoritative.

---

# 33. Receipt Replay / Duplicate Protection

Backend security previously added:

- SHA-256 receipt hash;
- duplicate/replay detection;
- OCR/reference evidence handling.

Audit current source to verify actual behavior.

Do not reimplement duplicate receipt security client-side.

Mobile may prevent obvious same-session double taps, but backend remains responsible for replay protection across requests/users.

If backend reports a duplicate/invalid receipt, map it to clear, non-sensitive user copy.

---

# 34. OCR Truth Model

The mobile app must never claim OCR equals payment approval.

Expected conceptual backend flow to verify:

```text
validate owner/request state
→ store receipt
→ hash receipt
→ create payment/OCR record
→ request becomes PAYMENT_UNDER_REVIEW
→ OCR runs asynchronously
→ staff reviews evidence
→ later workflow decision
```

Approved mobile copy:

```text
"Receipt submitted for review."
"Payment proof is being reviewed."
```

Do not say:

```text
"Payment verified by AI."
"OCR confirmed your payment."
"Payment successful."
```

unless actual current backend workflow truly changes to authoritative automatic verification.

---

# 35. Payment Correction / Re-Upload

Audit whether staff can reject/request correction for a receipt and how that state is represented.

Determine:

- exact status;
- notes/reason;
- whether old receipt remains;
- whether replacement is permitted;
- whether the same endpoint handles replacement;
- whether one verified receipt blocks replacement.

Plan explicit UX for:

```text
Payment proof needs correction
→ show staff-safe reason
→ choose replacement receipt
→ confirm
→ upload
→ under review again
```

Do not allow arbitrary repeated receipt uploads in states that backend forbids.

---

# 36. Phase 3/4 Home Integration

Phase 2 Home currently avoids request/payment workflow data.

After Phase 3 becomes stable, evaluate whether Home should gain a **small read-only request summary** consistent with the original mobile product scope.

Possible examples, only if supported cleanly:

- latest active request;
- `Continue request` action;
- `Payment required` attention state;
- `Needs correction` attention state.

Do not turn Home into a complex dashboard.

Do not implement Scheduling preview; that belongs to Phase 5.

Do not add notification counts; that belongs to Phase 6.

If adding Home request summary materially complicates Phase 3/4, defer it and document the decision.

---

# 37. Parish Detail Cross-Feature Entry

Phase 2 may already contain or later want shortcuts such as:

```text
Request Document
```

Audit current actual UI.

If present or appropriate, wire it only after the request flow exists.

It may preselect the current parish **as initial UI state**, but must not create a permanent user-parish association.

The parishioner must still be able to change the selected target parish if backend rules allow it.

Do not create draft requests merely by tapping a shortcut.

---

# 38. Navigation Architecture

Audit current Expo Router tree first.

Recommended conceptual routes:

```text
app/(app)/
  (tabs)/
    (requests)/
      index.tsx

  requests/
    new.tsx
    [requestId].tsx
    [requestId]/payment.tsx
    [requestId]/corrections.tsx
```

Exact route grouping may differ if current Expo Router conventions support a cleaner approach.

Requirements:

- Requests remains a top-level tab;
- wizard/detail/payment/correction screens sit above tabs when appropriate;
- no temporary wizard step becomes a tab;
- deterministic safe back fallback;
- no unconditional `router.back()`;
- direct request-detail route validates ID;
- owner authorization remains backend-enforced;
- deep links must not bypass auth gate;
- Phase 6 should later be able to route notification references into request detail.

---

# 39. Wizard Navigation Safety

Avoid a fragile router screen for every tiny form field unless justified.

The implementation plan must decide between:

```text
A. one wizard screen with controlled internal steps
B. nested wizard routes
C. hybrid
```

Evaluate:

- Android hardware back;
- accidental form loss;
- unsaved draft behavior;
- draft server ID lifecycle;
- process death;
- cross-step validation;
- accessibility;
- complexity.

Do not use a global back handler unless truly needed.

When user attempts to leave a partially completed local form/draft, decide whether:

- safe to leave and preserve server draft;
- local fields are discarded;
- confirmation is needed.

Base this on actual draft API behavior.

---

# 40. Server State vs Form State

Use TanStack Query for server state.

Use local/RHF form state for editable wizard input.

Do not put whole API responses into React Context.

Possible query-key concepts:

```text
requestKeys.all
requestKeys.list(filters?)
requestKeys.detail(requestId)
requestKeys.requirements({ type, parishId? })
paymentKeys.configuration({ requestId/parishId context })
```

Exact keys must follow actual API shape.

On successful mutations:

- invalidate/refetch only relevant request keys;
- avoid clearing unrelated parish/event cache;
- avoid manually patching complex workflow state unless safer than refetch.

On logout/account switch:

existing global query cancellation + clear must continue to eliminate request/payment data.

---

# 41. Mutation Policy

For all Phase 3/4 writes:

```text
retry: false
```

unless a specific mutation is proven idempotent by backend design.

Reads may use bounded existing retry policy.

Writes include:

- create draft;
- submit;
- cancel;
- upload supporting files;
- resubmit corrections;
- upload receipt.

For every write, the implementation plan must define:

- pending UX;
- duplicate-click protection;
- success invalidation;
- deterministic error;
- ambiguous error;
- reconciliation;
- navigation behavior.

---

# 42. Error Mapping

Audit actual backend errors/status codes.

Plan specific UX for:

```text
400 validation
401 expired/invalid auth
403 owner/state forbidden
404 missing request/parish/config
409 workflow conflict / duplicate / stale state
413 file too large if emitted
415 unsupported media if emitted
422 validation if used
429 rate limited
5xx server/OCR/storage failures
network offline
timeout
cancellation
```

Do not show raw stack traces/backend internals.

Do not collapse every request error into `Something went wrong` when actionable information is available.

For ambiguous mutation failures, copy must not encourage blind resubmission.

---

# 43. Offline Behavior

No offline mutation queue.

When offline:

- previously cached request list/detail may be shown as stale if already in memory;
- creation/submission/upload/payment actions should be disabled/fail clearly;
- do not queue a request or receipt for later automatic upload;
- do not pretend success.

Do not persist sensitive attachments into a custom offline cache.

---

# 44. Loading / Refresh Behavior

Plan:

## Request list
- initial skeletons;
- refresh keeps cached list visible;
- local retry banner on refresh failure;
- pagination only if actual backend supports it.

## Request detail
- skeleton/initial state;
- safe not-found/forbidden state;
- retry network errors where safe;
- keep existing detail visible on refresh failure.

## Requirements
- loading before wizard proceeds;
- retry;
- no stale requirements from a previously selected document type/parish.

## Payment config
- request-specific loading;
- safe unavailable state;
- cached config must not leak across different request/parish contexts.

## Uploads
- clear pending state;
- no fake progress.

---

# 45. Race Conditions to Explicitly Audit

The implementation plan must trace these scenarios.

## 45.1 Double draft creation

```text
Tap Start/Continue twice
→ only one draft created
```

## 45.2 Draft creation timeout

```text
POST may succeed server-side
→ client times out
→ reconcile before another create
```

## 45.3 Submit double tap

```text
one submission only
```

## 45.4 Status changes during open detail

```text
staff updates request
→ user attempts stale action
→ backend rejects
→ client refreshes and shows new state
```

## 45.5 Requirement switch race

```text
Document A requirements loading
→ user changes to Document B
→ A response arrives late
→ must not render as B
```

## 45.6 Parish switch race

Same rule for parish-specific requirements/config.

## 45.7 Supporting upload timeout

Refetch before duplicate upload.

## 45.8 Receipt upload timeout

Refetch payment/request state before re-upload.

## 45.9 Logout during upload/read

```text
User A mutation/read in flight
→ logout
→ cache cleared / requests cancelled
→ User B login
→ no User A data flashes/re-enters cache
```

## 45.10 App background/foreground

Do not auto-resubmit mutations.

Refetch stale request/payment state when appropriate.

---

# 46. Security Audit Requirements

Explicitly verify:

- every request read/write is owner-scoped in backend;
- route ID alone is not treated as authorization;
- mobile cannot read another user's request by changing ID;
- receipt/supporting file upload enforces ownership;
- payment config does not expose another parish/request's secrets;
- no staff endpoints imported;
- no admin status mutation exposed;
- no client-controlled userId ownership field;
- no arbitrary parishId widening beyond permitted target selection;
- no token logging;
- no attachment URL logging;
- no R2 credentials;
- no direct database access.

If any backend ownership gap exists, classify it as a blocker before mobile execution.

---

# 47. Native / Expo Dependency Audit

Phase 3 file picking and Phase 4 receipt capture may require Expo modules.

Before recommending dependencies, inspect `package.json`.

Determine whether installed packages already provide:

- document picker;
- image library picker;
- camera capture;
- file metadata;
- image resize/compression;
- filesystem temporary cleanup.

For every proposed new dependency report:

```text
package
why needed
Expo SDK 57 compatibility
config plugin?
native code?
new EAS development build required?
Android permission impact?
```

Do not silently introduce a native dependency.

Core Phase 3 should preferably be possible with the existing dev client or Expo-compatible modules, but source evidence decides.

Phase 4 camera capture must not be included merely because it sounds nice if it forces unnecessary native changes; gallery/document receipt selection can be prioritized if it satisfies the current backend/product requirement.

---

# 48. Permission Strategy

Do not request permissions on startup.

Only request:

- camera permission when Camera is explicitly chosen;
- media/library permission only when required by selected picker behavior.

If permission is denied:

- explain why;
- offer other supported input paths.

No location permission is part of Phase 3/4.

---

# 49. UI / Design Direction

Do not redesign the entire app during Phase 3/4.

Reuse the Phase 2 authenticated UI foundation:

- AppHeader;
- Card;
- Button;
- IconButton;
- Badge;
- SectionHeader;
- EmptyState;
- InlineError;
- Skeleton;
- theme tokens.

Add only workflow-specific components that are reusable enough to justify them.

Potential components:

```text
RequestCard
RequestStatusBadge
RequestTimeline / StatusProgress
RequirementCard
FileAttachmentRow
UploadPicker
WizardStepHeader
ReviewSection
AttentionBanner
PaymentSummaryCard
PaymentQrCard
ReceiptPicker
ReceiptReviewCard
```

Do not create hundreds of files or a generic workflow engine.

The UI should remain:

```text
warm
light
mobile-native
parishioner-facing
ecclesiastical
clear under stress
```

Avoid admin-table styling.

---

# 50. Status Color / Copy Rules

Do not rely on color alone.

Each status requires:

- readable text;
- semantic icon where useful;
- accessible label;
- consistent user-facing copy.

Map backend enum strings to human-readable labels.

Do not show raw values such as:

```text
PAYMENT_UNDER_REVIEW
NEEDS_CORRECTION
```

without formatting.

Do not rename statuses in a way that changes meaning.

---

# 51. Accessibility

Plan:

- >=44pt practical touch targets;
- dynamic font scaling;
- multiline-safe cards;
- screen-reader labels;
- form error announcements;
- step titles/headings;
- upload button state;
- file name/type/size readable;
- progress/pending state announced;
- confirmation dialogs accessible;
- QR image accessible description but not overloaded;
- no color-only status;
- clear focus order;
- destructive Cancel separated from primary Submit.

Do not claim large-font PASS until physical device testing.

---

# 52. Request List / Detail Refresh Policy

Request status may change server-side because staff processes it.

Do not implement aggressive polling in Phase 3/4.

Prefer:

- staleTime appropriate for workflow;
- refetch on screen focus;
- pull-to-refresh;
- refetch after successful mutations;
- refetch after ambiguous mutation outcome.

Phase 6 notifications will later improve timeliness.

If existing project focus manager behavior supports foreground refetch, reuse it.

---

# 53. Notifications Boundary

Phase 6 owns:

- real notification inbox;
- unread counts;
- mark read;
- deep-link framework;
- push.

Phase 3/4 may:

- keep request routes future-deep-link-safe;
- show current request state after manual/focus refresh.

Do not implement notification APIs just because document/payment statuses change.

---

# 54. Scheduling Boundary

Phase 5 owns:

- service booking;
- available slots;
- appointments;
- mass intentions;
- reschedule responses.

Do not call scheduling endpoints in Phase 3/4.

The Schedule tab remains its current shell.

---

# 55. Profile Boundary

Phase 7 owns profile editing/settings.

Do not expand profile functionality during Phase 3/4.

Existing identity + logout remains.

---

# 56. Backend Changes

The planning agent must determine whether Phase 3/4 can be completed against the current backend.

Prefer **no backend changes** if existing contracts are sufficient.

If a backend gap is found, distinguish:

```text
BLOCKER — mobile cannot safely implement required feature
ENHANCEMENT — mobile can proceed but UX could improve later
```

Do not modify backend during planning.

Examples that may require scrutiny:

- missing request DTO field needed for status UI;
- no actual history despite roadmap wording;
- missing correction details;
- ambiguous draft-create recovery;
- payment config context ambiguity;
- missing receipt-replacement state;
- insecure ownership enforcement.

---

# 57. Parishioner Web Reference Audit

Inspect the existing parishioner web request/payment flow after backend audit.

Extract only proven patterns that remain compatible with current backend:

- document selection;
- requirement presentation;
- request tracking;
- payment instructions;
- receipt upload;
- correction UX.

Do not copy:

- stale fields;
- old phase numbering;
- browser-specific APIs;
- web routing assumptions;
- direct DOM/file APIs;
- outdated backend workarounds.

If mobile can improve the UX while preserving the same workflow, prefer mobile-native design.

---

# 58. Proposed File/Feature Boundaries

The final plan should identify exact current files to modify/create after repository audit.

Conceptual feature structure:

```text
src/features/requests/
  api.ts
  types.ts
  presentation.ts
  RequestListScreen.tsx
  RequestDetailScreen.tsx
  RequestCard.tsx
  request-wizard/
  uploads/

src/features/payments/
  api.ts
  types.ts
  presentation.ts
  PaymentScreen.tsx
  ReceiptPicker.tsx
  PaymentQrCard.tsx

app/(app)/
  requests/
  ...

app/(app)/(tabs)/(requests)/
  index.tsx
```

This is not mandatory.

Prefer existing project conventions if they already provide cleaner organization.

For every proposed file, state responsibility and why it is needed.

---

# 59. Automated Test Plan Requirements

The final implementation plan must specify tests for:

## Phase 3 API/domain
- query keys;
- request list/detail paths;
- route param validation;
- requirement query keys;
- document-type mappings;
- status presentation;
- action eligibility helpers only if such helpers exist.

## Mutation safety
- mutation retries disabled;
- duplicate submit guard;
- ambiguous create reconciliation;
- ambiguous submit reconciliation;
- cancel conflict refresh;
- correction resubmission state.

## Wizard
- requirement switch race;
- parish switch race;
- required field validation;
- review data mapping;
- no duplicate draft creation.

## Supporting uploads
- type validation;
- 5 MB rule;
- max five files;
- multipart field name;
- unsupported type;
- ambiguous failure reconciliation.

## Payment
- zero fee;
- fee snapshot display;
- payment config isolation by context;
- QR absent;
- receipt JPEG/PNG validation;
- PDF/HEIC rejection on current Android flow;
- >5 MB handling;
- one active receipt upload;
- ambiguous upload reconciliation;
- `PAYMENT_UNDER_REVIEW` copy;
- duplicate/replay backend error mapping.

## Security/boundaries
- no staff endpoints;
- no scheduling endpoints;
- no direct R2 upload;
- owner route guard assumptions not duplicated in client;
- logout/account-switch cache clearing regression.

Avoid snapshot-heavy tests that do not validate behavior.

---

# 60. Physical Android Test Matrix Requirements

The final plan must include a device matrix covering at least:

## Requests
- empty requests;
- populated request list;
- pull-to-refresh;
- start request;
- choose parish;
- choose document type;
- requirements load;
- form keyboard behavior;
- supporting PDF upload;
- supporting JPEG/PNG/WebP upload;
- invalid type;
- >5 MB file;
- max file count;
- review;
- submit;
- duplicate-tap attempt;
- request detail;
- status refresh;
- cancel eligible request;
- correction/resubmission if testable.

## Payment
- zero-fee request;
- fee-required request;
- payment config;
- QR loading;
- QR failure;
- textual payment details;
- gallery receipt;
- camera receipt if included;
- invalid PDF receipt;
- oversized receipt;
- upload pending;
- upload success → under review;
- timeout/retry reconciliation if practical;
- duplicate receipt backend response if test fixture allows;
- correction/replacement receipt if supported.

## Session safety
- logout while request data loaded;
- sign in another account;
- no prior request/payment data flash;
- app background/foreground;
- Android Back from wizard/detail/payment.

## Accessibility
- larger font;
- TalkBack labels;
- upload controls;
- status semantics;
- dialogs.

Do not pre-claim physical PASS.

---

# 61. Static Validation Requirements

For implementation later, the plan should expect:

```text
npm run typecheck
npm test -- --runInBand
npm run lint
npx expo export --platform android
git diff --check
```

Also inspect:

```text
git status --short
```

Do not use destructive Git commands.

---

# 62. Native / EAS Validation

The final planning report must explicitly state whether Phase 3 and Phase 4 require a new EAS development build.

Do not assume `no rebuild` merely because most code is JS/TS.

If a new native Expo module/config plugin is required, explain:

- exact dependency;
- exact config change;
- why existing installed dev client cannot provide it;
- when the EAS rebuild should happen;
- whether Phase 3 can proceed before that rebuild.

Do not run EAS during planning.

---

# 63. Development Workflow

Current mobile development command remains:

```powershell
cd C:\Users\me\Documents\testimonium
npm run dev:mobile
```

Do not require a second `npm run dev` terminal.

Do not redesign the Quick Tunnel / DoH launcher as part of Phase 3/4.

Do not deploy production backend infrastructure during these phases.

---

# 64. Git Safety

Planning is read-only.

Do not run:

```text
git reset --hard
git clean -fd
git checkout .
git restore .
```

Do not delete or discard unrelated user work.

Do not commit.

---

# 65. Required Planning Questions

The final plan must explicitly answer:

1. What are the exact current request DTOs and statuses?
2. What is the real request state-transition graph?
3. What exact fields does `POST /requests` require?
4. At what point should the server draft be created?
5. How do we prevent duplicate/orphan drafts?
6. How do we reconcile ambiguous request-create/submit failures?
7. Are document requirements backend-driven enough for the mobile wizard?
8. Do requirements vary by parish?
9. What supporting-file metadata does request detail return?
10. Can supporting files be deleted/replaced before submit?
11. What exact correction data is exposed to parishioners?
12. What does `resubmit-corrections` expect?
13. Which statuses allow cancellation?
14. Is actual request history exposed, or only current status?
15. What is the authoritative fee snapshot field?
16. How does the backend represent zero-fee requests?
17. What context does `/payment/configuration` require?
18. What payment methods/details can mobile safely display?
19. When exactly is receipt upload allowed?
20. How is a payment correction/replacement represented?
21. How should receipt timeout ambiguity be reconciled?
22. What duplicate receipt errors can the backend return?
23. Does OCR ever change workflow automatically, or only enrich staff evidence?
24. Which picker/camera Expo packages are already installed?
25. Does Phase 3 require native changes?
26. Does Phase 4 require native changes?
27. If a rebuild is required, can we defer it until the receipt/camera subphase?
28. What should Home gain after Phase 3/4, if anything?
29. How should parish-detail `Request Document` entry prefill without creating a home-parish assumption?
30. What tests specifically protect mutation races and cross-account data isolation?
31. Are any backend security/ownership blockers present?
32. What remains explicitly deferred to Phase 5/6/7?

---

# 66. Required Planning Output

Return a Markdown document titled:

```text
# TESTIMONIUM Parishioner Mobile — Phase 3 + Phase 4 Implementation Plan
```

Use this structure:

```text
## 1. Executive Verdict

## 2. Current Repository Audit

## 3. Phase 0–2 Baseline to Preserve

## 4. Phase 3/4 Scope Reconciliation

## 5. Backend Request API Audit
### Requirements endpoints
### Request list/detail
### Draft creation
### Submit/cancel
### Supporting files
### Correction/resubmission
### Tracking/history

## 6. Request DTOs and State-Transition Model

## 7. Backend Payment API Audit
### Payment configuration
### Fee snapshot
### Zero-fee path
### Receipt upload
### Duplicate detection
### OCR truth model
### Payment correction

## 8. Security / Ownership Audit

## 9. Proposed Navigation Architecture

## 10. Requests Tab Plan

## 11. Request Detail Plan

## 12. Request Wizard Plan

## 13. Supporting Upload Plan

## 14. Request Review / Submit Plan

## 15. Cancel / Correction / Resubmission Plan

## 16. Request Tracking / History Plan

## 17. Phase 4 Payment Entry / Eligibility Plan

## 18. Payment Configuration / QR Plan

## 19. Receipt Selection / Capture Plan

## 20. Receipt Upload / Ambiguous Failure Plan

## 21. Payment Under Review / Correction UX

## 22. Home / Parish Cross-Feature Integration

## 23. TanStack Query / Cache Plan

## 24. Mutation Safety / Race-Condition Plan

## 25. Loading / Error / Offline Plan

## 26. File / Media Privacy Plan

## 27. Accessibility Plan

## 28. Native Dependency / EAS Impact

## 29. File-by-File Change Plan

## 30. Phase 3A–3F Execution Order

## 31. Phase 4A–4F Execution Order

## 32. Automated Test Plan

## 33. Physical Android Test Matrix

## 34. Static Validation Plan

## 35. Documentation Updates

## 36. Risks / Open Questions / Backend Gaps

## 37. Phase 3 Exit Criteria

## 38. Phase 4 Exit Criteria

## 39. Combined Milestone Exit Criteria

## 40. Recommended Execution Model / Reasoning Level
```

---

# 67. Plan Quality Requirements

The plan must be implementation-grade.

Avoid vague statements like:

```text
Build the request flow.
Add payment.
Handle errors.
```

For every area specify:

- real data source;
- exact endpoint;
- exact current DTO;
- query ownership;
- mutation ownership;
- route responsibility;
- component responsibility;
- form state;
- server state;
- cache invalidation;
- loading behavior;
- empty behavior;
- error behavior;
- cancellation;
- ambiguity reconciliation;
- permissions;
- accessibility;
- tests;
- physical verification;
- native impact.

Prefer a small coherent feature structure.

Do not over-engineer future phases.

---

# 68. Planning Severity Rules

If audit finds issues, classify them:

```text
BLOCKER
Required Phase 3/4 flow cannot be implemented safely against current backend,
or ownership/security is broken.

HIGH
Likely duplicate mutation, request/payment state corruption, receipt replay exposure,
or major runtime workflow failure.

MEDIUM
Robustness/UX gap worth addressing during implementation.

LOW
Cleanup, copy, small accessibility or documentation issue.

INFO
No action required.
```

Backend/security blockers must be surfaced before execution.

---

# 69. Final Instruction

**Audit first. Plan only. Do not implement.**

Do not edit mobile, backend, web, native, or documentation files during this planning pass.

Do not run EAS.

Do not run Gradle.

Do not create Android native folders.

Do not begin Scheduling, Notifications, or Profile expansion.

Produce the full **Phase 3 + Phase 4 Implementation Plan** in Markdown for review before any execution prompt is written.
