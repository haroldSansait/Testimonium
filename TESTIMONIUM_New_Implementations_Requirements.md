# TESTIMONIUM — New Implementations & Change Requirements

**Document Type:** Implementation Requirements / Engineering Planning  
**Status:** Draft for System Analyst, Adviser, and Development Review  
**Primary Goal:** Implement the requested improvements without regressing existing working workflows, especially authentication, document requests, scheduling, payments, Parish Council management, and the Vicariate Directory.

---

## 1. Overall Objectives

1. Improve user guidance and onboarding without blocking registration unnecessarily.
2. Strengthen account and upload security while keeping the UX understandable.
3. Improve parish and Parish Council presentation in the Vicariate Directory.
4. Make document request data more structured and enforce representative-document requirements.
5. Make scheduling more flexible, priest-aware, conflict-resistant, and capable of suggesting available slots.
6. Improve payment verification quality and reporting accuracy.
7. Harden all new workflows against concurrent actions, stale state, duplicate submissions, and partial failures.
8. Preserve existing working functionality unless a requirement explicitly changes it.

---

## 2. Global Engineering Rules

### 2.1 Server-Side Enforcement
Frontend validation is for UX only. Any requirement that affects permissions, eligibility, uploads, booking, payments, profile completeness, or data integrity must also be enforced by the backend.

### 2.2 Idempotency
Any action that can be retried due to slow connections, double-clicks, or timeouts should be designed so the same request cannot accidentally create duplicate records.

Examples:
- schedule creation/rescheduling;
- document request submission;
- authorization-letter upload;
- payment proof upload/verification;
- profile picture replacement.

### 2.3 Optimistic Concurrency / Stale Data Protection
For records that multiple users or staff can update, prefer a `version`, `updatedAt`, or equivalent stale-write check. A stale update should return a controlled conflict response instead of silently overwriting newer data.

### 2.4 Time Handling
Store canonical timestamps consistently and render them using the application's parish/local timezone. Scheduling comparisons must use the same canonical time basis to avoid timezone-dependent overlap bugs.

### 2.5 File Upload Safety
For all uploaded images/documents:
- enforce allowed MIME types and extensions;
- verify file signature/magic bytes where possible;
- enforce maximum file size;
- generate server-controlled object keys;
- never trust the original filename as a storage path;
- prevent executable/script uploads;
- restrict upload/read access based on role and ownership;
- use placeholder/fallback behavior when an image is unavailable.

### 2.6 Auditability
Important administrative actions should be auditable, especially:
- Parish Council officer image updates;
- schedule verification/rescheduling;
- priest personal schedule changes;
- payment verification;
- document requests involving authorized representatives.

### 2.7 Error Response Convention
New API flows should use consistent controlled errors, for example:

```json
{
  "success": false,
  "error": {
    "code": "SCHEDULE_SLOT_CONFLICT",
    "message": "The selected schedule is no longer available."
  }
}
```

Do not leak stack traces, database errors, object-storage credentials, or internal paths to clients.

---

# 3. Password Strength Indicator — Registration

## Objective
Add an understandable Strong/Weak password indicator to the registration page.

## Required Behavior
- Evaluate the password locally while the user types.
- Show a clear visual label such as:
  - **Weak**
  - **Moderate**
  - **Strong**
- The indicator must reflect the real password policy used by the backend.
- Do not send the password to any third-party password-strength service.
- Do not log the plaintext password.

## Recommended Strength Signals
Consider:
- minimum length;
- uppercase/lowercase mixture;
- number;
- symbol;
- repeated/simple patterns;
- common-password rejection if an approved local/common-password list is available.

## Security / Vulnerabilities
- A strength meter must not replace server-side password validation.
- Never expose password values in analytics, logs, error tracking, or debug output.
- Avoid misleading users by labeling a password "Strong" if the backend would reject it.

## Race Conditions
Low risk. The main concern is keeping the frontend policy synchronized with backend rules.

## Error Handling
- If server validation rejects a password despite the frontend meter, show the backend validation message and keep the form state intact.
- Do not clear all registration fields on a password validation failure.

## Acceptance Criteria
- Indicator changes live as the password changes.
- Backend remains authoritative.
- Password never appears in logs.
- Existing registration flow continues to work.

---

# 4. Profile Completion Workflow Change

## Objective
Stop forcing profile completion immediately after account registration. Instead, require profile completion only before a parishioner can submit a document request or schedule/event request.

## New Workflow
1. User registers successfully.
2. User may enter and use the homepage without forced profile completion.
3. Home Profile card/button should display a reminder/prompt:
   - complete your profile to access document and schedule requests.
4. When the user attempts:
   - a document request; or
   - a schedule/event request;

   the system checks profile completeness.
5. If incomplete, block request submission and direct the user to complete the required profile fields.

## Goal
Reduce onboarding friction while still enforcing complete information at the point where the information becomes operationally required.

## Backend Requirement
The backend must verify profile completeness before accepting protected request submissions. A user must not be able to bypass this requirement by directly calling the API.

## Vulnerabilities
- Frontend-only gating can be bypassed.
- Avoid exposing unnecessary profile fields in completeness-check responses.
- Define exactly which fields count as required to prevent inconsistent behavior between clients.

## Race Conditions
A user may open a request form while incomplete, complete the profile in another tab/device, then return. The submission endpoint should re-check the current profile state at submission time.

## Error Handling
Suggested error:

`PROFILE_INCOMPLETE`

The UI should:
- explain which required profile information is missing;
- provide a direct route to Profile;
- preserve request draft data when practical.

## Acceptance Criteria
- Registration no longer forces immediate profile completion.
- Incomplete users can browse the homepage.
- Document/schedule request creation is blocked server-side until required profile fields are complete.
- Profile card clearly reminds incomplete users.

---

# 5. Home Hero Greeting Improvements

## Objective
Personalize the homepage greeting correctly and use first name only.

## Required Behavior
- Display only the parishioner's **first name**.
- Immediately after successful registration:
  - `Welcome, <FirstName>`
- On later authenticated logins with the same account:
  - `Welcome back, <FirstName>`

## Important State Rule
Do not determine "newly registered" solely from account creation date on every page load. The greeting should represent the current authentication journey.

Recommended approach:
- registration flow passes a one-session "new registration" state/flag;
- normal login uses returning-user greeting;
- refreshing the page should not accidentally turn a registration greeting into incorrect state unless that behavior is intentionally defined.

## Vulnerabilities
- Do not expose full legal name unnecessarily.
- Avoid trusting a client-editable local flag for authorization; this flag is presentation-only.

## Race Conditions
Auth/session hydration may occur after the page first renders. Avoid:
- `Welcome, undefined`;
- flashing the wrong greeting before user data loads;
- showing "Welcome back" briefly before registration state resolves.

## Error Handling
If the first name is unavailable:
- use a neutral `Welcome` rather than rendering null/undefined.

## Acceptance Criteria
- First name only.
- New registration = `Welcome`.
- Subsequent login = `Welcome back`.
- No incorrect greeting flash during auth hydration.

---

# 6. Vicariate Directory / Parish Council UI Expansion

## Objective
Improve parish information presentation and add a visual PPC/PFC officer hierarchy/tree.

## Required Changes

### Parish Information Card
- Expand/improve the parish detail card.
- Preserve existing parish information and council information.
- Maintain responsive behavior.

### PPC / PFC Council View
Current officer lists should gain a **View** action.

Selecting View should open a separate card/modal/panel containing an organizational tree:
- highest office at the top;
- subsequent officers branch downward;
- readable on desktop and mobile;
- PPC and PFC clearly separated.

### Profile Pictures
Parish Council settings must support an optional profile picture for each PPC/PFC officer.

For the current implementation:
- use placeholders for officers without real photos;
- do not require photos;
- preserve existing council data.

## Recommended Data Model Consideration
Council member records will need an optional image reference such as an object-storage key or image URL metadata. Avoid storing large binary image data directly in normal relational fields.

## Security / Upload Vulnerabilities
- Only authorized Admin roles may upload/replace officer photos.
- Validate MIME type, signature, size, and dimensions.
- Use random/server-generated storage keys.
- Prevent path traversal through filenames.
- Do not allow public users to upload council photos.
- Consider image metadata stripping to reduce accidental EXIF privacy exposure.
- Use a safe placeholder if the image fails to load.

## Race Conditions
Potential cases:
- two Admin users replace the same officer image simultaneously;
- member is removed while an image upload is in progress;
- image upload succeeds but database update fails;
- database update succeeds but old object cleanup fails.

Recommended handling:
- upload to a new unique object key;
- update the member record transactionally/with version checking where possible;
- only delete the previous object after the record points to the new object;
- failed cleanup should not break the saved council record.

## Error Handling
Possible controlled errors:
- `COUNCIL_IMAGE_TYPE_INVALID`
- `COUNCIL_IMAGE_TOO_LARGE`
- `COUNCIL_MEMBER_STALE`
- `COUNCIL_IMAGE_UPLOAD_FAILED`

## Acceptance Criteria
- Parish card improved without breaking existing directory details.
- PPC/PFC list remains usable.
- View opens officer hierarchy.
- Placeholders shown without photos.
- Admin can eventually upload officer images safely.
- Uploaded images reflect in the public directory after successful save.

---

# 7. Document Request — Structured Name Fields

## Objective
Replace a single Full Name field with:
- First Name
- Middle Name
- Last Name

## Required Behavior
Frontend form collects these fields independently.

The backend should normalize the values and construct the current full-name representation used by the existing request/database workflow.

Example normalization:

```text
First: Juan
Middle: Santos
Last: Dela Cruz

Derived full name:
Juan Santos Dela Cruz
```

Middle name should follow the project's actual business requirement: optional if parish records allow users with no middle name.

## Data Integrity Recommendation
If schema changes are acceptable later, storing the individual name components is more flexible than storing only a concatenated string. If the existing database contract must remain `fullName`, concatenation must occur server-side so clients cannot submit inconsistent formatting.

## Vulnerabilities
- Sanitize/normalize whitespace.
- Apply reasonable length limits.
- Do not trust a client-provided derived full-name value if the server can construct it.

## Race Conditions
Minimal. Ensure duplicate submit/retry does not create duplicate document requests.

## Error Handling
Field-specific errors:
- missing first name;
- missing last name;
- invalid/too-long text.

## Acceptance Criteria
- Three visible fields.
- Derived full name is normalized consistently.
- Existing downstream document workflow still receives the expected name representation.

---

# 8. Authorization Letter for Authorized Representatives

## Objective
Require an authorization letter when the requester selects **Authorized Representative** for a document request.

## Required Behavior
If request type/relationship indicates the user is representing another person:
- authorization letter becomes required;
- request cannot be submitted without a valid upload.

If requester is requesting for themselves:
- authorization letter is not required.

## Server-Side Enforcement
The backend must reject an authorized-representative request without a valid authorization-letter attachment.

Suggested error:

`AUTHORIZATION_LETTER_REQUIRED`

## Upload Security
- restrict file type to approved document/image formats;
- size limit;
- signature/MIME verification;
- authenticated upload;
- ownership binding to the request/user;
- private storage by default;
- access only to authorized parish staff and the request owner when appropriate.

## Race Conditions
Avoid creating a permanently incomplete request when:
1. request row is created;
2. file upload fails.

Recommended design:
- upload first to temporary/pending storage and finalize with request creation; or
- create request in a draft/pending state and only transition to submitted when required file attachment succeeds.

Duplicate retries must not create duplicate requests/files.

## Error Handling
- upload timeout;
- invalid file;
- storage unavailable;
- submission attempted before upload finishes;
- user removes file after selecting representative mode.

## Acceptance Criteria
- Representative mode visibly requires letter.
- Backend enforces it.
- Failure preserves form data and permits re-upload.
- No unauthorized access to letters.

---

# 9. Allow Rescheduling After Schedule Verification / Confirmation

## Objective
Keep a confirmed/verified schedule eligible for controlled rescheduling to support emergencies.

## Required Behavior
A verified/confirmed event should not become permanently immutable.

Authorized staff should be able to initiate rescheduling while preserving:
- original schedule information;
- confirmation history;
- reason for reschedule;
- previous assigned priest if applicable;
- audit timestamps.

## Recommended State Model
Do not simply overwrite history.

Possible states/events:
- REQUESTED
- VERIFIED
- CONFIRMED
- RESCHEDULE_REQUESTED / RESCHEDULED
- COMPLETED
- CANCELLED

Exact existing statuses should be preserved where possible; add only what is necessary.

## Vulnerabilities
- Only authorized roles can reschedule confirmed events.
- A parishioner should not be able to force a confirmed schedule change through direct API calls.
- Audit reason should be length-limited and safely rendered.

## Race Conditions
Critical:
- event is being rescheduled while another user books the target slot;
- priest becomes unavailable between recommendation and confirmation;
- two staff users reschedule the same event concurrently.

Required mitigation:
- stale/version check on the event;
- final conflict check inside the reschedule transaction;
- never trust availability checked earlier on the UI;
- return a conflict if the target slot was taken.

Suggested error:
`SCHEDULE_SLOT_CONFLICT`

## Acceptance Criteria
- Confirmed schedules can be rescheduled by authorized users.
- Original history remains available.
- Final save rechecks conflicts atomically.

---

# 10. Priest Mini Calendar + Ongoing Schedule Detection

## Objective
Give priests a compact calendar showing events specifically assigned to them and indicate the priest's current/ongoing scheduled event when applicable.

## Required Behavior
Priest dashboard/account view:
- mini monthly/weekly plot calendar;
- assigned parish events;
- personal schedule blocks where applicable;
- clear event status;
- current/ongoing event indicator.

## Ongoing Detection
An event is ongoing when canonical current time falls within its actual scheduled start/end interval and the event is not cancelled.

Do not infer "ongoing" solely from status text.

## Security
A priest should only see detailed assignment information they are authorized to view.

## Race Conditions
- assignment changes while calendar is open;
- event is rescheduled while priest views it;
- overlapping records from parish and personal schedules.

Use server data as authoritative and invalidate/refetch after schedule mutations.

## Error Handling
- calendar load failure should show a recoverable state, not blank the dashboard;
- invalid event time ranges should be rejected by backend validation;
- missing end time requires a defined policy rather than guessing indefinitely.

## Acceptance Criteria
- Assigned events visible in mini calendar.
- Ongoing event correctly highlighted.
- Rescheduling/assignment changes reflect after refresh/refetch.

---

# 11. Additional Notes / Requested Priest on Schedule Requests

## Objective
Allow parishioners to provide additional notes, including a preferred/requested priest.

## Required Behavior
Add an **Additional Notes** field to schedule/event requests.

The UI should make clear:
- requesting a specific priest is a preference;
- it does not guarantee assignment.

## Recommended Future Improvement
If priest preference becomes operationally important, a structured optional `requestedPriestId` is safer than relying only on free text. Additional Notes should still remain available for other context.

## Vulnerabilities
- Set maximum length.
- Escape/safely render user content.
- Do not execute or render HTML from notes.
- Staff-facing UI must treat it as untrusted user input.

## Race Conditions
Requested priest may appear available when the request is created but become unavailable before confirmation. Final assignment must re-check availability.

## Error Handling
If a requested priest is unavailable:
- keep the schedule request valid;
- inform the requester/staff that preference cannot be guaranteed;
- allow another priest to be assigned.

## Acceptance Criteria
- Notes persist with the request.
- Staff can view notes.
- Priest preference does not bypass scheduling conflict rules.

---

# 12. Schedule Recommendation Algorithm

## Objective
Automatically recommend available schedule slots based on current parish calendar availability, priest/resource constraints where applicable, personal priest blocks, and existing event schedules.

## Core Principle
**Recommendation is not reservation.**

A slot shown as available can become unavailable before the user submits. The backend must perform a final authoritative conflict check at booking/confirmation time.

## Inputs
Potential inputs include:
- requested event type;
- desired date/date range;
- event duration;
- parish calendar;
- verified/confirmed events;
- pending events according to business rules;
- priest assignments;
- priest personal schedules;
- parish operating constraints;
- blackout periods;
- rescheduling holds.

## Suggested Algorithm Flow
1. Determine candidate operating windows.
2. Load blocking schedules for the relevant parish/resources.
3. Normalize times into canonical intervals.
4. Merge/compare occupied intervals.
5. Generate open candidate slots.
6. Rank by proximity to user's preferred date/time.
7. Return a limited set of recommendations.
8. On final submission, revalidate the selected slot transactionally.

## Critical Race Condition
Two users can receive the same recommendation simultaneously.

Example:

```text
User A sees 10:00 available
User B sees 10:00 available
User A submits
User B submits milliseconds later
```

Only one must succeed if the resource cannot support both.

## Required Concurrency Protection
At final reservation/confirmation:
- open transaction;
- re-read current conflicts;
- create/update booking only if still available;
- otherwise return `SCHEDULE_SLOT_CONFLICT`;
- client refreshes recommendations.

Where supported by the current PostgreSQL design, consider a database-level overlap protection strategy for final authoritative enforcement. Do not rely solely on frontend filtering.

## Other Race Conditions
- staff reschedules an event while recommendations are being generated;
- priest creates personal block while slot is being recommended;
- cancellation frees a slot between requests;
- multiple recommendation requests run simultaneously.

Recommendation generation should be safe/read-only. Final mutation must be authoritative.

## Abuse / Security
- rate-limit expensive recommendation queries if necessary;
- limit requested date ranges;
- cap number of recommendations;
- use indexed schedule fields;
- avoid exposing private event details when only availability is required.

## Error Handling
Suggested errors:
- `NO_SCHEDULE_RECOMMENDATIONS`
- `SCHEDULE_SLOT_CONFLICT`
- `SCHEDULE_INVALID_RANGE`
- `SCHEDULE_RECOMMENDATION_UNAVAILABLE`

A conflict should not lose the user's form data.

## Acceptance Criteria
- Recommendations reflect current calendar data.
- Concurrent users cannot double-book the same protected resource.
- Final booking rechecks availability.
- Conflict returns a clear retry/recommendation flow.

---

# 13. Verified Payments in Daily Reports

## Objective
Add verified payment information to daily reports.

## Required Reporting Behavior
Daily report should distinguish at minimum:
- verified payments;
- pending/unverified payments;
- rejected/failed payments where applicable.

If the requirement is specifically to report verified revenue, totals must include only payments that reached the system's authoritative **VERIFIED** state.

## Data Integrity
The report must derive payment status from server/database truth, not frontend labels.

## Race Conditions
- payment becomes verified while report is being generated;
- same payment verification action is submitted twice;
- late verification occurs around day boundary.

Define the report timezone and cutoff consistently.

For reproducibility, consider recording:
- report generation time;
- date range;
- verification timestamp.

## Vulnerabilities
- restrict financial report access by role;
- do not expose sensitive payment proof URLs unnecessarily;
- avoid trusting client-provided payment amounts/status.

## Error Handling
- report query failure;
- partial payment data;
- missing verification timestamps.

Prefer explicit "report unavailable" or partial-status messaging rather than silently showing incorrect totals.

## Acceptance Criteria
- Verified payment count/total visible in daily reports.
- Pending payments do not inflate verified totals.
- Report respects correct daily boundaries.

---

# 14. Priest Personal / Customized Scheduling

## Objective
Allow priests to create personal availability blocks/schedules that appear in their calendar and affect availability where required.

## Possible Schedule Types
Examples:
- unavailable/personal block;
- personal appointment;
- leave;
- external ministry/commitment;
- optional informational personal event.

Define which types should block assignment.

## Required Behavior
- Priest can create/update/delete their own personal schedule entries.
- Authorized Admin roles may have visibility/manage rights according to policy.
- Entries reflect on priest calendar.
- Blocking entries participate in schedule recommendations and assignment conflict checks.

## Security
- Priest may modify only personal records they own unless higher role is authorized.
- Do not expose private notes publicly.
- Consider separating public availability information from private descriptions.

## Race Conditions
Critical scenario:
1. parish staff assigns priest to an event;
2. priest simultaneously creates a personal block.

Final writes must check overlapping blocking events.

Options:
- reject whichever write loses the concurrency race;
- require authorized conflict resolution.

Do not silently allow overlapping blocking schedules unless business rules explicitly permit it.

## Error Handling
Suggested errors:
- `PRIEST_SCHEDULE_CONFLICT`
- `PERSONAL_SCHEDULE_NOT_FOUND`
- `PERSONAL_SCHEDULE_FORBIDDEN`
- `INVALID_SCHEDULE_RANGE`

## Acceptance Criteria
- Priest personal schedule appears in calendar.
- Blocking entries affect recommendations/assignments.
- Concurrent conflict is detected server-side.

---

# 15. Payment Proof Confidence Threshold

## Objective
Use an image-analysis confidence baseline of **75%** to determine whether an uploaded payment proof is clear enough for normal processing.

## Required Behavior

### Confidence >= 75%
- Allow proof to proceed through the normal payment verification workflow.

### Confidence < 75%
- Do not proceed as if the proof were accepted.
- Return the upload to the user.
- Display a clear message such as:
  - **Image is unclear or blurry. Please upload a clearer payment proof.**
- Allow re-upload.

## Critical Clarification
The 75% score should be treated as an **image/recognition confidence or quality gate**, not automatic proof that a payment is legitimate.

A score >= 75% means:
> the image is sufficiently readable for the next verification stage.

It must NOT automatically mean:
> payment is verified.

Payment authenticity/status must continue through the existing verification logic.

## Security / Abuse
- Do not accept client-submitted confidence values.
- Confidence must be calculated by trusted server-side/service logic.
- Validate image before sending it to analysis.
- Limit repeated uploads/rate if abuse becomes a concern.
- Do not expose provider secrets or internal model responses.
- Store only the necessary score/result metadata.

## Race Conditions
A user may upload multiple proofs rapidly.

Required behavior:
- each upload gets a unique attempt/version;
- asynchronous analysis result must be attached to the exact upload attempt;
- a late result from an older upload must not overwrite the latest proof state.

Example:

```text
Upload A starts analysis
Upload B replaces A
B passes
A finishes later with 40%

A must NOT overwrite B.
```

Use an upload/version/attempt identifier and verify it before applying async results.

## Error Handling
Distinguish:
- low confidence;
- unsupported image;
- image processing failed;
- verification service unavailable.

Do not tell the user "blurry" if the actual problem was an internal service outage.

Suggested codes:
- `PAYMENT_PROOF_LOW_CONFIDENCE`
- `PAYMENT_PROOF_INVALID_IMAGE`
- `PAYMENT_PROOF_ANALYSIS_FAILED`
- `PAYMENT_PROOF_ANALYSIS_UNAVAILABLE`

## Acceptance Criteria
- `< 75%` clearly requests re-upload.
- `>= 75%` proceeds normally, not automatically verified.
- stale analysis results cannot overwrite newer uploads.
- threshold is preferably configurable rather than hard-coded in many files.

---

# 16. Cross-Feature Scheduling Consistency

The following features must share one authoritative conflict model:

- parish event requests;
- confirmed parish events;
- rescheduling;
- priest assignment;
- priest personal schedules;
- mini priest calendar;
- schedule recommendations;
- requested priest preference.

Do not implement separate availability rules independently in different screens.

Create/reuse a centralized backend availability service or equivalent domain logic so every caller receives the same answer.

Suggested conceptual functions:

```text
getResourceAvailability(...)
findScheduleConflicts(...)
generateScheduleRecommendations(...)
validateFinalBooking(...)
```

The exact architecture should follow the current codebase.

---

# 17. Suggested Implementation Order

## Phase 1 — Low-Risk UX / Data Improvements
1. Password strength indicator.
2. Hero first-name + Welcome/Welcome Back correction.
3. Profile-completion gating change.
4. Document name split/normalization.
5. Additional schedule notes.

## Phase 2 — Upload / Document Security
6. Authorization-letter requirement.
7. Payment proof confidence threshold.

## Phase 3 — Parish Directory / Council Presentation
8. Parish information card redesign.
9. PPC/PFC View hierarchy/tree.
10. Officer photo support + placeholders.

## Phase 4 — Scheduling Foundation
11. Allow rescheduling of verified/confirmed events.
12. Priest personal/custom schedules.
13. Priest mini calendar + ongoing detection.

## Phase 5 — Scheduling Intelligence
14. Centralized availability/conflict service.
15. Schedule recommendation algorithm.
16. Requested-priest availability integration.

## Phase 6 — Reporting
17. Verified payments in daily reports.

### Reason for This Order
The recommendation algorithm should be built **after** personal priest schedules and rescheduling rules are defined; otherwise the availability algorithm would immediately require redesign.

---

# 18. High-Risk Areas Requiring Extra Review

| Area | Risk | Required Protection |
|---|---|---|
| Schedule recommendation | Two users receive same slot | Final transactional conflict check |
| Rescheduling | Target slot taken during edit | Version + conflict validation |
| Priest personal schedule | Simultaneous priest/event assignment | Server-side overlap check |
| Payment image analysis | Old async result overwrites new upload | Upload attempt/version identity |
| Authorization letter | Request created but file missing | Atomic/finalized submission workflow |
| Council images | Upload succeeds but DB update fails | Unique object keys + safe replacement flow |
| Profile gating | User bypasses frontend | Backend completeness validation |
| Daily payment reports | Status changes during generation | Defined cutoff/timezone + authoritative status |
| Authentication greeting | Auth hydration flashes wrong greeting | Deterministic registration/login session state |
| Password strength | Frontend says strong, backend rejects | Shared/aligned policy |

---

# 19. Error-Handling Requirements

Every new feature should explicitly support:

### Network Failure
- retry where safe;
- do not duplicate mutations;
- retain user-entered form data.

### 400 Validation
- show field/context-specific message.

### 401 Authentication Expired
- preserve draft where safe;
- require re-authentication.

### 403 Forbidden
- explain insufficient permission without revealing sensitive details.

### 404 Missing/Stale Resource
- refetch or return to valid state.

### 409 Conflict
Use for scheduling/concurrency conflicts where appropriate:
- stale version;
- slot no longer available;
- conflicting personal schedule.

### 413 Payload Too Large
Use for oversized uploads and show upload limits.

### 429 Rate Limit
Protect expensive algorithms/uploads if abuse becomes possible.

### 5xx Internal Failure
- generic user-safe message;
- log server-side correlation/error context;
- never leak secrets or raw stack traces.

---

# 20. Definition of Done for Each New Feature

A feature is not complete until:

- frontend behavior is implemented;
- backend rules are enforced where applicable;
- authorization is verified;
- input validation exists;
- concurrency/race conditions are considered;
- errors return controlled responses;
- tests cover happy path and important failure paths;
- existing workflows pass regression tests;
- build/lint/tests are clean;
- physical QA is completed for interactive UI;
- database migrations, if any, are reviewed before application;
- no unrelated feature is silently changed.

---

# 21. Protected Existing Functionality

Unless a future requirement explicitly changes it, preserve:

- existing authentication/session behavior;
- existing document request records and statuses;
- existing scheduling/event records;
- existing payment verification behavior;
- Parish Pastoral Council (PPC) management;
- Parish Finance Council (PFC) management;
- Vicariate Directory council display;
- existing saved PPC/PFC members;
- existing role/authorization boundaries.

Any implementation touching these areas should include regression checks.

---

# 22. Final Project Goal

These changes should move TESTIMONIUM toward a system where:

- registration is less restrictive but operational actions remain protected;
- parishioner identity/document requests are structured and verifiable;
- Parish Council information is richer and more visual;
- priests have a usable personal and assigned-event calendar;
- schedule recommendations are helpful without creating double bookings;
- emergency rescheduling remains possible and auditable;
- payment proof quality and reporting are more reliable;
- concurrency, stale state, upload failure, and authorization bypasses are handled deliberately rather than as afterthoughts.

## Relationship evidence clarification (2026-10-08)

Section 8 now applies to every non-Self relationship, not only Authorized Representative. Parent, Child, Spouse, Sibling, Other Relative, and Authorized Representative require an authorization letter plus clear front and back JPEG/PNG images of the registrant's Government ID, limited to 5 MB per side. Self requests remain unchanged, including the existing valid_id verification contract.

The backend is authoritative: unsupported relationship values fail with INVALID_RELATIONSHIP; submission requires all three evidence items and distinct side hashes; private images use a dedicated non-public bucket and authenticated streams; OCR is asynchronous advisory enrichment only; and a relationship-evidence correction requires a provably newer upload in that correction round.
