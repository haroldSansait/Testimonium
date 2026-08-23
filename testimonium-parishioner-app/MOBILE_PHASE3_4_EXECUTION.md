You are implementing TESTIMONIUM Parishioner Mobile Phase 3 + Phase 4.

Use Gemini 3.7 Flash High with high reasoning effort.

Repository root:

C:\Users\me\Documents\testimonium

Mobile app:

C:\Users\me\Documents\testimonium\testimonium-parishioner-app

Backend:

C:\Users\me\Documents\testimonium\testimonium-backend

Parishioner web:

C:\Users\me\Documents\testimonium\testimonium-parishioner-web

==================================================
READ THESE TWO FILES IN FULL FIRST
==================================================

Before modifying ANY source code, read:

1. testimonium-parishioner-app/MOBILE_PHASE3_PHASE4_PLAN.md

2. testimonium-parishioner-app/MOBILE_PHASE3_PHASE4_IMPLEMENTATION_PLAN.md

Their roles are:

MOBILE_PHASE3_PHASE4_PLAN.md
→ original binding product/scope/security/race-condition planning brief.

MOBILE_PHASE3_PHASE4_IMPLEMENTATION_PLAN.md
→ Terra's repository-audited implementation blueprint based on the real backend/mobile/web source.

Do not skim them.

Then inspect the actual current source files referenced by the implementation plan.

==================================================
AUTHORITY ORDER
==================================================

If anything conflicts, use:

1. Actual current backend/mobile source and current Prisma schema
2. Confirmed backend validators/services/routes/tests
3. This execution prompt
4. MOBILE_PHASE3_PHASE4_IMPLEMENTATION_PLAN.md
5. MOBILE_PHASE3_PHASE4_PLAN.md
6. Current API/mobile documentation
7. Parishioner web implementation
8. Older documentation

Do not force an assumption from a Markdown file when current source proves it outdated.

Do not silently invent missing backend capabilities.

==================================================
THIS IS AN EXECUTION TASK
==================================================

Planning is complete.

Do NOT produce another large implementation plan.

Begin with a short read-only preflight confirming:

- current git status;
- current backend request/payment contracts;
- current Prisma schema;
- current mobile Requests placeholder;
- current Expo Router structure;
- TanStack Query setup;
- centralized API client;
- actual installed mobile dependencies;
- current callers of payment configuration in mobile/web/admin.

Then proceed with implementation.

Only stop before implementation if source reveals a new:

BLOCKER:
- security/ownership flaw;
- contradictory database model;
- destructive schema problem;
- backend contract impossible to harden safely;
- native dependency conflict;
- architecture issue materially contradicting Terra's plan.

Minor implementation details should be resolved independently.

==================================================
CORRECT PHASE BOUNDARIES
==================================================

Phase 3:

DOCUMENT REQUEST CORE

Includes:

- request list;
- request detail;
- all 7 canonical document types;
- backend-driven requirements;
- request wizard;
- draft creation;
- supporting attachments;
- review;
- submit;
- real history;
- cancellation;
- document correction/resubmission.

Phase 4:

PAYMENT & RECEIPT CAPTURE

Includes:

- payment eligibility;
- request fee snapshot;
- zero-fee path;
- owned payment configuration;
- textual payment details;
- QR display;
- gallery receipt;
- camera receipt;
- JPEG/PNG validation;
- receipt upload;
- payment-under-review state;
- payment correction/replacement.

DO NOT IMPLEMENT:

- scheduling;
- booking;
- available slots;
- mass intentions;
- reschedule workflow;
- notification inbox;
- unread badges;
- push notifications;
- event calendar expansion;
- profile editing/settings;
- RAG/chatbot;
- staff/admin request processing.

Scheduling remains Phase 5.

Notifications remain Phase 6.

Profile expansion remains Phase 7.

==================================================
PHASE 0–2 BASELINE — DO NOT REGRESS
==================================================

Preserve:

- Native Firebase authentication;
- email/password login/logout;
- Google Sign-In/logout;
- email verification;
- legal acceptance;
- profile completion;
- PARISHIONER + ACTIVE gate;
- AuthProvider observer handling;
- interactive-operation suppression;
- generation/UID stale-response protection;
- centralized API client;
- bearer injection;
- one forced token refresh / one 401 retry;
- normalized AppError handling;
- timeout/cancellation behavior;
- TanStack Query;
- account-switch query cancellation + clear;
- root Stack above tabs;
- five-tab navigation;
- safe navigateBackOrReplace behavior;
- Home;
- Parish Directory;
- Parish Detail;
- events;
- Call/Email/Directions;
- notifications shell;
- dev:mobile launcher.

Do not rewrite auth.

Do not redesign Phase 2.

==================================================
BACKEND HARDENING IS IN SCOPE
==================================================

Implement only backend hardening required to make the Phase 3/4 parishioner flow safe.

Do NOT turn this into a general backend refactor.

Required audited hardening includes:

1. seven canonical document types;
2. dynamic required-field enforcement;
3. required attachment-category enforcement;
4. race-safe idempotent request draft creation;
5. supporting-upload owner/state/category validation;
6. owned payment configuration through request context;
7. receipt eligibility/state protection;
8. zero-fee workflow correctness where current code requires adjustment.

Preserve staff/admin/web behavior unless a change is explicitly necessary.

==================================================
ALL 7 CANONICAL DOCUMENT TYPES
==================================================

Support:

- Baptismal Certificate
- Confirmation Certificate
- Marriage Certificate
- Marriage Banns
- Permit to Marry
- Status of Liberty
- Endorsement

Do NOT add Death/Burial as document request types.

Use actual backend enum/transport values.

Do not hardcode display names as transport values if they differ.

Parish `availableDocuments` must constrain which document types are offered for a selected parish.

==================================================
BACKEND-DRIVEN REQUIREMENTS
==================================================

Use:

GET /api/v1/document-requirements

and/or

GET /api/v1/document-requirements/:type

according to the actual source.

Parish-specific context must be included when supported.

Requirements are authoritative for:

- required applicant fields;
- required purpose/relationship fields;
- required attachment categories;
- metadata;
- fee display before creation where applicable.

Do not create a second client-side requirements matrix that can drift from backend configuration.

Client-side validation may mirror the backend for UX.

Backend validation remains authoritative.

==================================================
BACKEND IDEMPOTENT DRAFT CREATION
==================================================

Terra identified lack of safe draft-create reconciliation as a BLOCKER.

Implement a persisted user-scoped `Idempotency-Key` contract for:

POST /api/v1/requests

The implementation must be race-safe.

Required semantics:

Same authenticated user
+ same idempotency key
+ same canonical request payload

→ return/recover the already-created draft
→ NEVER create a duplicate.

Same authenticated user
+ same idempotency key
+ different canonical request payload

→ reject with a deterministic conflict such as HTTP 409.

Different users may safely use the same random key because scope includes authenticated user identity.

Do not trust userId supplied by client.

The authenticated backend user is authoritative.

Validate reasonable idempotency-key length/format.

Persist enough information to distinguish safe replay from key reuse with a different payload.

Prefer a stable canonical payload fingerprint/hash.

Race protection must work when two requests arrive nearly simultaneously.

A simple:

find
→ create

without transaction/unique constraint handling is NOT sufficient.

Use database uniqueness / transactional handling appropriate to Prisma/PostgreSQL.

==================================================
DATABASE MIGRATION SAFETY
==================================================

If idempotency persistence requires Prisma schema changes:

- update the authoritative Prisma schema;
- create a proper migration;
- include appropriate uniqueness/indexing;
- update tests/docs.

DO NOT:

- reset database;
- drop tables;
- run destructive migrations;
- use prisma migrate reset.

Do not apply migrations to an unknown production/shared database.

Inspect environment first.

If the configured database cannot be proven to be the intended development database, create the schema/migration changes but stop before applying them and report the exact migration step required.

Never destroy existing data to make the migration work.

==================================================
DRAFT CREATION TIMING
==================================================

The server draft should be created only when the user confirms the review step.

Before then:

- wizard state remains local;
- selected files remain local/in-memory;
- no server draft is created simply by opening the wizard;
- no draft is created by choosing parish;
- no draft is created by choosing document type.

Expected flow:

local wizard
→ review
→ guarded POST /requests
→ obtain/recover draft ID
→ upload required files
→ submit

==================================================
IMPORTANT: SERVER DRAFT RECOVERY
==================================================

Once the backend draft exists, it MUST remain recoverable.

This is a required correction/clarification to the implementation plan.

Scenario:

create draft succeeds
→ supporting upload fails
or
→ submit fails
or
→ app closes

The user must NOT lose access to the server draft.

Do not silently hide server drafts from the Requests experience.

Provide an intentional Draft presentation, such as:

- Draft badge;
- Continue Request action;
- separate Draft section if appropriate.

Use actual backend list behavior.

Do not offer "Delete Draft" unless a real owner-safe backend delete endpoint exists.

A draft may be resumed by loading its current server state plus requirements.

Do not create a second draft just because local wizard state was lost.

==================================================
REQUEST LIST
==================================================

Replace Requests shell with real owner-scoped requests.

Use:

GET /api/v1/requests

Audit actual:

- pagination;
- search;
- status filtering;
- documentType filtering;
- sort.

Use TanStack Query.

Use infinite pagination only if API is actually paginated.

Provide:

- initial skeletons;
- pull-to-refresh;
- cached-data preservation on refresh failure;
- empty state;
- retry;
- status filters only when backend supports them;
- new-request CTA;
- Draft presentation/recovery.

Do not expose requests from other users.

==================================================
REQUEST DETAIL ROUTE
==================================================

Implement:

/requests/[requestId]

or exact Expo Router equivalent.

Validate route params strictly.

Positive integer ID only if backend IDs are integer-based.

Invalid values:

- no API call;
- safe unavailable state;
- deterministic return to Requests.

Backend ownership remains authoritative.

Render real fields only:

- tracking number;
- document type;
- applicant;
- relationship/purpose if populated;
- target parish;
- current status;
- payment status;
- fee snapshot;
- attachments metadata;
- correction notes;
- correction requirement IDs;
- request history;
- timestamps;
- eligible parishioner actions.

Do not fabricate workflow history.

==================================================
REAL REQUEST HISTORY ONLY
==================================================

Use backend `requestHistory`.

Sort/display chronologically according to actual timestamp semantics.

Do not synthesize:

Submitted
Reviewed
Approved
etc.

unless those events actually exist.

Estimated processing days are requirement metadata, not historical events.

Keep those concepts visually distinct.

==================================================
REQUEST WIZARD
==================================================

Use current mobile form stack.

Prefer existing:

react-hook-form
Zod
resolver

if already installed and consistent.

Conceptual steps:

1. Select target parish
2. Select available document type
3. Load/show authoritative requirements
4. Enter required applicant/request fields
5. Select supporting files
6. Review
7. Create/upload/submit

Exact ordering may adapt to current DTOs.

Changing parish or document type must:

- cancel/ignore stale requirements responses;
- reset dependent file selections;
- reset dependent validation;
- never display Document A requirements for Document B;
- never display Parish A requirements for Parish B.

==================================================
SUPPORTING FILE PICKER
==================================================

Add:

expo-document-picker

using:

npx expo install expo-document-picker

from:

C:\Users\me\Documents\testimonium\testimonium-parishioner-app

Do not manually pick arbitrary package versions if Expo can resolve the compatible SDK 57 version.

Accepted supporting formats must match current backend:

- PDF
- PNG
- JPEG
- WebP

Maximum:

5 MB per file.

Verify middleware.

Do not directly upload to Cloudflare R2.

==================================================
SUPPORTING FILE CATEGORY SEMANTICS
==================================================

IMPORTANT:

Terra's plan identifies:

multipart field:
files

and:

category = requirement ID

Before implementing batching, inspect the ACTUAL upload route/controller/service.

Determine whether `category` applies:

A. once to the whole multipart request;

B. separately to each uploaded file;

C. through an array/mapping.

Do not guess.

If one category applies to one request:

→ upload one requirement category at a time.

Do NOT send several files belonging to different requirements under one category field.

If multiple files for one requirement are supported, follow the backend contract.

The backend maximum of five files is per HTTP request.

Some document types require more than five categories, so support multiple safe upload calls as needed.

==================================================
SUPPORTING UPLOAD BACKEND HARDENING
==================================================

The backend must validate:

- authenticated owner;
- request exists;
- allowed draft/correction state;
- category belongs to authoritative requirements for that request parish/type;
- file format;
- file size;
- request/category relationship.

Do not accept arbitrary category IDs supplied by a client without validation.

==================================================
SUPPORTING FILE UI
==================================================

Each requirement should have a clearly associated upload control.

Show:

- requirement label;
- required/optional state;
- selected filename;
- file type;
- size;
- remove/replace before upload.

Once uploaded:

show server-confirmed attachment metadata only.

Do not expose raw private R2 URLs.

No public share button.

No clipboard URL.

==================================================
SUBMIT-TIME REQUIREMENT ENFORCEMENT
==================================================

Terra identified current backend requirement enforcement as a BLOCKER.

At:

POST /requests/:id/submit

server must validate all authoritative required categories/fields before transition.

Do not trust a client-provided "requirementsComplete: true".

The server must derive the correct requirements from the request's:

- parish;
- document type;
- current configuration.

If requirements changed during the wizard and submit becomes invalid:

return a deterministic validation/conflict response.

Mobile should:

refetch requirements/detail
→ explain what is now missing
→ return user to the relevant step.

==================================================
REQUEST SUBMIT MUTATION SAFETY
==================================================

No automatic mutation retries.

Single-flight guard.

Disable submit while pending.

On deterministic success:

- invalidate request list/detail;
- replace route to request detail.

On deterministic validation/state conflict:

- map appropriately;
- refresh authoritative state.

On timeout/network ambiguity:

DO NOT immediately POST submit again.

First:

GET request detail

If request status proves submission succeeded:

→ continue.

If still draft / safe to retry:

→ allow intentional retry.

==================================================
REQUEST CANCELLATION
==================================================

Use:

POST /requests/:id/cancel

Show Cancel only for states currently eligible according to audited backend transitions.

Still rely on backend authority.

Use:

- confirmation;
- disabled/pending state;
- retry:false;
- ambiguous-state reconciliation;
- list/detail invalidation.

Do not show cancellation on terminal or ineligible states.

==================================================
DOCUMENT CORRECTION FLOW
==================================================

For:

NEEDS_CORRECTION

use actual:

correctionNote
correctionRequirementIds

or current backend-equivalent fields.

Show only correction-relevant upload controls when appropriate.

Load current authoritative requirements for the original request parish/type.

Allow replacement uploads only as current backend permits.

Then:

POST /requests/:id/resubmit-corrections

Use:

- one active mutation;
- retry:false;
- state reconciliation on ambiguous failure.

Do not implement staff-side correction selection.

==================================================
PAYMENT CONFIG HARDENING
==================================================

Mobile must use request-owned context.

Preferred contract:

GET /api/v1/payment/configuration?requestId=<ownedRequestId>

Backend:

requestId
→ load request
→ verify authenticated ownership
→ resolve parish server-side
→ return safe configured payment fields

The client must not be able to choose arbitrary parish payment configuration simply by changing parishId.

==================================================
IMPORTANT: DO NOT BREAK EXISTING WEB CLIENTS
==================================================

The backend is shared by:

- Admin Web
- Parishioner Web
- Mobile

Before changing `/payment/configuration`, search all current callers.

Do NOT casually remove an existing supported query shape.

Prefer additive/backward-compatible hardening.

For example:

requestId path/context
→ owner-scoped parishioner flow

existing parishId context
→ keep only where current authorized web/staff behavior legitimately requires it
→ enforce appropriate role/tenant authorization

If existing web code must change because its current behavior is unsafe, update that caller deliberately and test it.

Do not ship a backend change that makes the existing parishioner/admin portals fail unexpectedly.

==================================================
PAYMENT FEE AUTHORITY
==================================================

For an existing request:

USE:

request.fee

Do not recalculate from:

- current requirements;
- current parish settings;
- payment provider config.

The request fee is the authoritative snapshot.

==================================================
ZERO-FEE
==================================================

Verify current backend zero-fee behavior.

If:

fee === 0

then mobile must not show:

- QR;
- payment method;
- receipt picker;
- receipt upload.

Render actual request status.

Do not invent "Paid" merely from zero fee.

Backend status remains authoritative.

==================================================
PAYMENT ENTRY
==================================================

Show payment action only when:

- request belongs to current user;
- fee > 0;
- status is eligible according to actual backend;
- expected states include:
  PAYMENT_PENDING
  PAYMENT_NEEDS_CORRECTION

Verify exact enums in source.

Refresh detail before acting if data is stale.

If staff has already transitioned the request:

→ disable/re-route payment action based on new state.

==================================================
PAYMENT CONFIG UI
==================================================

Display only fields returned by safe backend DTO:

- provider;
- account name;
- account number;
- instructions;
- QR URL if present.

Never hardcode GCash/Maya/bank data.

Do not invent fallback payment details.

QR absence is valid if textual details exist.

Broken QR should degrade to textual instructions.

==================================================
RECEIPT INPUT — GALLERY + CAMERA
==================================================

Add:

expo-image-picker

using Expo-compatible installation.

Support two explicit actions:

- Choose from Gallery
- Take Photo

Permissions:

- do not request at startup;
- request camera only when camera selected;
- request media access only when actually required.

If denied:

show clear message
→ keep alternative input available.

Accepted backend receipt types:

JPEG
PNG

Reject locally:

PDF
HEIC
HEIF
WebP
unsupported/unknown media

Maximum:

5 MB

Do not aggressively compress receipt evidence.

Do not crop automatically.

Preserve receipt legibility.

==================================================
IMAGE PICKER CONFIG / PERMISSIONS
==================================================

Audit Expo SDK 57 configuration.

Configure only required permissions.

Avoid unnecessary microphone/audio permission if expo-image-picker allows it to be disabled.

Do not broaden Android permissions beyond what gallery/camera receipt capture requires.

==================================================
RECEIPT PREVIEW
==================================================

Before upload show:

- image;
- filename/asset metadata where available;
- size;
- Replace;
- Remove;
- Submit Receipt.

Keep local receipt URI only in current screen state.

Do not persist receipt bytes/URIs into TanStack Query.

Do not log them.

==================================================
RECEIPT UPLOAD
==================================================

Use:

POST /requests/:id/receipt

multipart field:

receipt

Use centralized authenticated API behavior.

When constructing FormData:

- use React Native file object correctly;
- let networking layer set multipart boundary;
- do NOT manually hardcode a multipart boundary;
- preserve bearer/token handling;
- preserve timeout/cancellation;
- retry:false at mutation level.

==================================================
RECEIPT SINGLE-FLIGHT / AMBIGUITY
==================================================

Only one active receipt upload per request.

Disable upload action immediately.

No automatic mutation retry.

On:

timeout
connection loss
unknown transport failure

assume upload MAY have succeeded.

Then:

refetch request detail

If request status/receipt/payment state proves success:

→ clear local receipt;
→ show Payment Under Review.

If backend proves upload did not succeed and state remains eligible:

→ allow intentional retry.

Never blindly replay a receipt upload.

==================================================
RECEIPT DUPLICATE / REPLAY
==================================================

Backend remains authoritative.

Preserve server:

- SHA-256 hash;
- duplicate/replay detection;
- OCR evidence.

Do not reproduce fraud detection in mobile.

Do not expose fraud-specific internal signals.

Map safe server error copy only.

==================================================
OCR TRUTH
==================================================

OCR is NOT payment approval.

Do not show:

"AI verified your payment"
"OCR confirmed payment"
"Payment successful"

after receipt upload.

Use:

"Receipt submitted for review."
"Payment proof is being reviewed."

The expected post-upload state is:

PAYMENT_UNDER_REVIEW

unless actual source proves otherwise.

==================================================
PAYMENT CORRECTION
==================================================

For:

PAYMENT_NEEDS_CORRECTION

show safe staff-provided correction note.

Allow replacement receipt through the same eligible endpoint.

Prior receipts remain backend audit evidence.

Do not display/download old receipt URLs from mobile.

Do not permit replacement when backend state does not allow it.

==================================================
REQUEST / PAYMENT QUERY KEYS
==================================================

Use UID-scoped TanStack Query keys.

Conceptually:

requestKeys.all(uid)
requestKeys.list(uid, filters)
requestKeys.detail(uid, requestId)
requestKeys.requirements(uid, { parishId, documentType })
paymentKeys.configuration(uid, requestId)

Exact structure may follow existing conventions.

Never share request/payment cache across authenticated users.

Logout/account switch must continue to:

cancel queries
→ clear query client
→ clear feature-local selected files/media.

==================================================
READ VS WRITE RETRY POLICY
==================================================

Reads:

use existing bounded safe retry behavior.

Mutations:

retry: false

unless a specific backend operation is explicitly proven idempotent.

Even when create is backend-idempotent, do not silently retry indefinitely.

Use the persisted idempotency key for controlled reconciliation.

==================================================
MUTATION GUARDS
==================================================

Use synchronous in-flight guards where React render timing could permit a rapid double tap before `isPending` updates.

Guard:

- create draft;
- submit;
- cancel;
- document correction resubmit;
- supporting upload;
- receipt upload.

Do not rely solely on button UI state for duplicate prevention.

==================================================
ERROR MAPPING
==================================================

Handle current backend semantics for:

400
401
403
404
409
413
415
422 if used
429
5xx
network failure
timeout
cancellation

401 behavior must continue through existing auth/session handling.

For:

409 workflow conflict

→ refetch authoritative request state before deciding next action.

Never display stack traces or internal DB/storage/OCR details.

==================================================
NO OFFLINE MUTATION QUEUE
==================================================

Do not queue:

- request creation;
- submit;
- cancel;
- document upload;
- correction resubmit;
- receipt upload.

If offline:

show clear failure.

Previously fetched request data may remain visible in memory if current privacy/cache design allows it.

Do not pretend a write succeeded.

==================================================
FORM / LOCAL STATE PRIVACY
==================================================

Do not persist sensitive selected files or receipt media in AsyncStorage/SecureStore/query cache.

Keep selected media/file URIs only as long as needed.

Clear them on:

- success;
- wizard discard;
- logout/account switch.

If temporary copies are created, clean them when feasible.

==================================================
REQUEST STATUS PRESENTATION
==================================================

Map raw enums to readable labels.

Do not expose:

PAYMENT_UNDER_REVIEW
NEEDS_CORRECTION
etc.

as screaming enum strings.

Do not rely on color alone.

Use:

text
+ semantic badge/icon where appropriate.

==================================================
HOME
==================================================

Keep Home unchanged during core Phase 3/4 implementation.

Do not add a complex request dashboard.

A read-only request summary may be reconsidered later.

No Schedule data.

No notification count.

==================================================
PARISH DETAIL REQUEST ENTRY
==================================================

Add "Request Document" only when actual parish `availableDocuments` indicates eligible document types.

Tapping it may preselect that parish in the wizard.

It must NOT:

- create a server draft;
- create a home/preferred parish association;
- prevent user from changing parish if backend permits.

==================================================
REQUEST ROUTES
==================================================

Use root-stack routes above tabs such as:

/requests/new
/requests/[requestId]
/requests/[requestId]/payment

Requests tab remains top-level.

Wizard/detail/payment are drill-down routes.

Use deterministic back fallback.

Do not reintroduce unconditional `router.back()`.

==================================================
WIZARD LEAVE BEHAVIOR
==================================================

Before server draft exists:

local wizard can use unsaved-change confirmation when necessary.

After server draft exists:

draft is recoverable from server.

Do not pretend server draft was deleted when user leaves.

Do not create a delete/discard action without backend support.

==================================================
NATIVE DEPENDENCY / BUILD STRATEGY
==================================================

Expected new packages:

expo-document-picker
expo-image-picker

Inspect current package.json first.

Install from MOBILE APP directory using:

npx expo install ...

Update app.config.ts only as required by Expo config/plugin permission settings.

Because the current installed development APK does not contain these native modules:

ONE NEW ANDROID DEVELOPMENT BUILD WILL BE REQUIRED.

IMPORTANT:

Do not perform two separate native rebuilds.

Land BOTH native dependencies and ALL picker-related app.config changes first.

Then one future Android dev build can include both Phase 3 and Phase 4 native requirements.

==================================================
DO NOT RUN LOCAL NATIVE TOOLING
==================================================

NEVER run:

expo prebuild
expo run:android
gradlew
Android Studio

Do not generate a local android directory.

Do not use local Gradle.

Do not touch signing manually.

==================================================
EAS CLOUD BUILD
==================================================

DO NOT automatically start an EAS build during this execution unless explicitly instructed by the user.

Prepare:

- dependencies;
- app.config;
- code;
- tests;
- static Expo bundle.

Then clearly report:

EAS DEVELOPMENT BUILD REQUIRED: YES

The user will run the single EAS cloud build separately after implementation review.

==================================================
EXISTING DEVELOPMENT WORKFLOW
==================================================

Continue using:

cd C:\Users\me\Documents\testimonium
npm run dev:mobile

for JS/backend runtime development where native picker behavior is not required.

The current APK can test non-picker JS changes but cannot load newly-added native picker modules until rebuilt.

Do not require another npm run dev terminal.

Do not redesign dev:mobile.

==================================================
BACKWARD COMPATIBILITY
==================================================

Backend is shared infrastructure.

Before changing a route contract:

search ALL callers in:

testimonium-admin-portal
testimonium-parishioner-web
testimonium-parishioner-app

Any backend API hardening must either:

A. remain backward compatible;

or

B. deliberately update every affected current caller and its tests in the same implementation.

Do not break the existing portals silently.

==================================================
PHASE 3 EXECUTION ORDER
==================================================

Execute Phase 3 sequentially.

PHASE 3A — BACKEND HARDENING

- align all seven types;
- idempotent request creation;
- dynamic required-field validation;
- required attachment-category validation;
- owner/state/category supporting-upload hardening;
- tests.

Validate backend before moving on.

PHASE 3B — MOBILE REQUEST DOMAIN

- DTOs;
- API functions;
- query keys;
- status presentation;
- route ID validation;
- list/detail/history.

Validate.

PHASE 3C — REQUEST WIZARD

- parish selection;
- document selection;
- authoritative requirements;
- form;
- local file selection;
- review.

No server draft before Review confirmation.

Validate.

PHASE 3D — CREATE + UPLOAD

- idempotency key generation/preservation;
- create/reconcile;
- document picker;
- per-requirement uploads;
- resumable server draft.

Validate.

PHASE 3E — SUBMIT/CANCEL/CORRECTIONS

- submit reconciliation;
- cancellation;
- NEEDS_CORRECTION;
- replacement uploads;
- resubmit;
- invalidation.

Validate.

PHASE 3F — PHASE 3 REGRESSION

Run all backend/mobile static and automated checks.

Do not begin Phase 4 if a Phase 3 security/mutation test is failing.

==================================================
PHASE 4 EXECUTION ORDER
==================================================

PHASE 4A — PAYMENT BACKEND HARDENING

- owned requestId config context;
- backward compatibility;
- zero-fee verification;
- receipt eligibility/state tests.

PHASE 4B — PAYMENT UI

- eligibility;
- fee snapshot;
- configured textual details;
- QR.

PHASE 4C — RECEIPT PICKERS

- gallery;
- camera;
- permission UX;
- local validation;
- preview.

PHASE 4D — RECEIPT UPLOAD

- FormData;
- one active upload;
- no auto retry;
- ambiguity reconciliation;
- under-review truth copy.

PHASE 4E — PAYMENT CORRECTION

- correction note;
- replacement receipt;
- status refresh;
- cross-account safety.

PHASE 4F — COMBINED REGRESSION

Run complete backend/mobile validation.

==================================================
BACKEND TESTS
==================================================

Inspect existing backend test scripts/framework and use the established commands.

Add focused tests for:

- all seven canonical types;
- dynamic required fields;
- required category enforcement;
- supporting upload ownership;
- invalid category rejection;
- unsupported upload state;
- idempotent create same-key/same-payload;
- same-key/different-payload conflict;
- concurrent same-key draft race;
- cancel transition enforcement;
- correction resubmit;
- owned payment config;
- unauthorized requestId config;
- zero-fee path;
- receipt allowed statuses;
- receipt forbidden statuses;
- duplicate/replay behavior unchanged.

Do not weaken existing backend security tests.

==================================================
MOBILE TESTS
==================================================

Add focused tests for:

- request query keys;
- list filters/pagination;
- detail route ID validation;
- canonical type mapping;
- availableDocuments constraints;
- requirements query race;
- parish/type reset behavior;
- form validation;
- request status presentation;
- server-draft recovery;
- idempotency key preservation;
- duplicate-create guard;
- submit ambiguity reconciliation;
- cancel ambiguity;
- file format/size validation;
- requirement/category mapping;
- >5 total requirements across batches;
- correction upload flow;
- zero-fee payment suppression;
- payment eligibility;
- requestId payment query isolation;
- QR absence;
- receipt JPEG/PNG acceptance;
- HEIC/HEIF/WebP/PDF rejection;
- >5 MB receipt rejection;
- camera/gallery adapter behavior;
- one active receipt upload;
- receipt ambiguity reconciliation;
- under-review copy;
- payment correction;
- logout/account-switch cache safety.

Avoid snapshot-heavy tests.

==================================================
SHARED COMPONENT REGRESSION
==================================================

If extending shared Phase 2 components:

Button
Card
AppHeader
TextInput
Badge
etc.

ensure auth and Phase 2 screens remain compatible.

Do not modify shared component defaults carelessly.

==================================================
ACCESSIBILITY
==================================================

Preserve:

>=44pt practical targets
font scaling
multiline text
TalkBack labels
status semantics
form errors
dialog focus
keyboard-aware forms

Upload controls must announce:

- requirement name;
- selected filename;
- required state;
- uploading/pending state;
- failure state.

QR must have an appropriate accessible description.

Do not claim physical accessibility PASS during static execution.

==================================================
STATIC VALIDATION
==================================================

After Phase 3 and again after Phase 4 run applicable checks.

MOBILE:

cd C:\Users\me\Documents\testimonium\testimonium-parishioner-app

npm run typecheck
npm test -- --runInBand
npm run lint
npx expo export --platform android

BACKEND:

Run current established backend test commands discovered from package.json.

Also from repository:

git diff --check
git status --short

If admin/parishioner web callers were modified for backend compatibility:

run their existing build/type/lint/test checks as applicable.

==================================================
GIT SAFETY
==================================================

Do not use:

git reset --hard
git clean -fd
git checkout .
git restore .

Do not discard unrelated work.

Do not automatically commit.

==================================================
DOCUMENTATION
==================================================

After implementation update materially affected current docs, including as applicable:

05_MOBILE_NAVIGATION_AND_SCREEN_MAP.md
06_MOBILE_BACKEND_API_CONTRACT.md
08_MOBILE_STATE_DATA_OFFLINE.md
09_MOBILE_UPLOADS_PAYMENTS_MEDIA.md
11_MOBILE_TESTING_QA.md
12_MOBILE_ENV_BUILD_RELEASE.md
13_MOBILE_IMPLEMENTATION_ROADMAP.md
15_MOBILE_DECISIONS_AND_CHANGE_CONTROL.md

Also update central backend API documentation if its contract changed.

Document:

- all seven types;
- idempotency behavior;
- required category validation;
- requestId payment config;
- draft recovery;
- picker dependencies;
- one required EAS rebuild;
- Android receipt limits;
- no automatic mutation retries.

Do not rewrite unrelated historical docs.

==================================================
DO NOT CLAIM THESE WITHOUT EVIDENCE
==================================================

Do not claim:

PHYSICAL ANDROID PASS
camera PASS
gallery PASS
document picker PASS
EAS build PASS
database migration deployed

unless actually performed and verified.

Static Expo export does not prove the newly-added native modules exist in the currently installed APK.

==================================================
FINAL REPORT
==================================================

Return:

# TESTIMONIUM Mobile Phase 3 + Phase 4 — Implementation Report

## 1. Executive Summary

## 2. Source Files Read
Confirm:
- MOBILE_PHASE3_PHASE4_PLAN.md
- MOBILE_PHASE3_PHASE4_IMPLEMENTATION_PLAN.md

## 3. Phase 3 Backend Hardening
### Seven document types
### Requirements enforcement
### Idempotent request creation
### Upload ownership/category validation

## 4. Database / Prisma Changes
- schema changes
- migration created
- migration applied or pending
- target environment

## 5. Phase 3 Requests Tab

## 6. Request Detail / History

## 7. Request Wizard

## 8. Draft Recovery / Idempotency

## 9. Supporting Attachments

## 10. Submit / Cancel / Corrections

## 11. Phase 4 Backend Hardening
### Owned payment configuration
### Zero-fee behavior
### Receipt state protection
### Existing client backward compatibility

## 12. Payment UI / QR

## 13. Gallery / Camera Receipt Input

## 14. Receipt Upload / Ambiguous Failure Reconciliation

## 15. Payment Under Review / Correction

## 16. TanStack Query / Cache / Cross-Account Safety

## 17. Security Review

## 18. Accessibility

## 19. Files Created

## 20. Files Modified

## 21. Dependencies Added
Include exact installed versions.

## 22. Native Configuration Changes

## 23. Backend Tests
Include exact counts/results.

## 24. Mobile Tests
Include exact counts/results.

## 25. Web Regression Checks
Only if shared backend contract affected existing web callers.

## 26. Static Validation Results
- typecheck
- tests
- lint
- Android export
- backend checks
- diff check

## 27. Documentation Updated

## 28. Remaining Risks / Limitations

## 29. Native / EAS Status

Explicitly state:

NEW EAS DEVELOPMENT BUILD REQUIRED: YES/NO

If YES, explain exactly why.

Do not run it automatically.

## 30. Physical Android Test Checklist

Provide a concise but complete checklist for:

- requests list;
- draft recovery;
- all seven types;
- requirements;
- files;
- submit;
- cancel;
- corrections;
- zero fee;
- QR;
- gallery;
- camera;
- receipt upload;
- under review;
- payment correction;
- Android Back;
- account switch;
- large fonts/TalkBack.

## 31. Final Status

Separate:

PHASE 3 IMPLEMENTATION
PHASE 4 IMPLEMENTATION
BACKEND HARDENING
STATIC VERIFICATION
DATABASE MIGRATION STATUS
EAS DEVELOPMENT BUILD STATUS
PHYSICAL ANDROID VERIFICATION

Do not collapse these into one generic "complete" status.

==================================================
FINAL INSTRUCTION
==================================================

Implement the coordinated Phase 3 + Phase 4 milestone now.

Work sequentially:

Phase 3 backend
→ Phase 3 mobile
→ Phase 3 verification
→ Phase 4 backend
→ Phase 4 mobile
→ combined verification

Do not skip mutation-safety work to move faster.

Do not silently broaden scope.

Do not run local Gradle/prebuild.

Do not automatically launch the EAS build.

If a new genuine blocker appears, stop only at that blocker and report:
- exact source location;
- why it contradicts the approved plan;
- safest resolution.