# TESTIMONIUM Parishioner Mobile — Product Scope

**Baseline:** 24 August 2026
**Audience:** Product owner, developers, UI/UX, QA, coding agents.
**Implementation Status:** Phases 1–7 complete (Core features implemented and verified).

## 1. Product statement

TESTIMONIUM Parishioner Mobile is the native mobile companion to the TESTIMONIUM web portal suite. Built with Expo SDK 57, React Native 0.86, and React 19, it provides parishioners with a smooth, native experience for parish discovery, sacramental document requests, request tracking, payment evidence submission, appointment scheduling, public events discovery, in-app notifications, and profile management through the existing Express backend and Firebase authentication project.

The mobile app is not a replacement for the admin portal and does not duplicate diocesan or staff administrative operations.

## 2. Goals

The mobile app achieves:
- a polished, ecclesiastical, parishioner-first native experience on iOS and Android;
- direct reuse of the authenticated `/api/v1` Express backend;
- parity in business rules, workflow transitions, and security boundaries with the parishioner web portal;
- mobile-optimized workflows for high-frequency parishioner tasks (tracking, scheduling, receipt capture with HEIC support, and parish discovery);
- safe camera, photo gallery, and document file selection;
- accessible, high-contrast controls adhering to WCAG touch targets (44×44 pt minimum);
- strict avoidance of client-side business logic duplication;
- robust error boundaries, retry states, and offline-graceful read caching.

## 3. Non-goals for initial mobile v1

The following remain out of scope for mobile v1:
- staff/admin portal workflows and coordinator parish management;
- staff request processing, fee adjustments, and manual payment verification;
- mass-template administration and staff availability configuration;
- audit log administration and diocesan analytics dashboards;
- direct Cloudflare R2 uploads or direct PostgreSQL database connections;
- native push notifications before device-token backend support exists (in-app notifications are implemented);
- offline mutation queues for document, payment, or scheduling transactions;
- AI chatbot or RAG responses (deferred until knowledge governance prerequisites are met);
- automatic OCR payment approval (staff verification remains mandatory).

## 4. Primary user

The mobile app's authenticated role is strictly `PARISHIONER`.

Important domain rule:
> A parishioner is not permanently bound to a single "home parish."

Parishioners can discover any active parish in the diocese and submit document requests or schedule bookings against their selected parish as permitted by backend configuration.

## 5. Implemented feature set

### 5.1 Authentication and onboarding
- Native Firebase email/password sign-in and registration with structured profile fields.
- Google Sign-In with automatic JIT account provisioning and legal compliance challenge handling.
- Single-flight email verification recheck with AppState foreground listener and 60-second resend cooldown.
- Profile completion gating (`fullName`, `contactNumber`, `address`) directly committing updated backend profiles.
- Canonical terms of service and privacy policy modal viewers.
- Clean session teardown and cache purging on logout.

### 5.2 Home screen
- Personalized parishioner greeting from the authenticated profile.
- Quick actions for new document requests, scheduling, parish directory, and tracking.
- Recent active request tracking cards with direct drill-down.
- Upcoming liturgical event preview cards filtered by the current month.
- Top app bar with notification bell and deep link routing.

### 5.3 Parish directory and discovery
- Searchable and municipality-filtered active parish list with pull-to-refresh.
- Parish detail view displaying patron saint, feast day, contact info (`tel:`, `mailto:`, `geo:` map launcher), office hours, available documents, and parish image galleries.
- Public events preview specific to the selected parish.

### 5.4 Sacramental document requests
- Interactive 5-step Document Request Wizard:
  1. Parish selection
  2. Document type selection (all canonical types supported) and requirements checklist review
  3. Applicant and relationship details entry
  4. Supporting document file uploads (PDF, PNG, JPEG, WebP up to 5 MB each)
  5. Summary review and draft creation/submission
- Request list view with status filtering (All, Pending, Action Required, Completed).
- Request detail view displaying fee snapshot, tracking number, status badge, R2 attachment viewer, correction banners, and immutable timeline history.
- Correction resubmission workflow for requests marked `NEEDS_CORRECTION`.
- Safe cancellation for eligible pending requests.

### 5.5 Payments and receipt capture
- Authoritative payment configuration resolution (`GET /payment/configuration`).
- Fee snapshot display directly from the server request record.
- Interactive payment QR viewer with pinch-to-zoom / tap-to-enlarge modal.
- Media picker supporting Camera, Photo Library, and Files.
- Automatic client-side HEIC/HEIF to JPEG conversion with quality optimization.
- Multipart receipt upload (`POST /requests/:id/receipt`) with rate-limiting tolerance and double-submission locking.
- Clear "Payment Proof Under Review" status messaging (explicitly communicating that staff verification is required).

### 5.6 Parish scheduling and appointments
- Live 5-step Scheduling Wizard:
  1. Parish selection
  2. Canonical service/event type selection (enforced against parish `availableEvents`)
  3. Date selection (restricted to 90-day horizon and operating office hours)
  4. Real-time slot selection (dynamically calculating capacity and closures)
  5. Contact remarks and submission with database-backed `Idempotency-Key` protection
- Schedule list view categorized into Upcoming and Past appointments.
- Schedule detail view with priest assignment status, location, and calendar details.
- Reschedule response screen allowing parishioners to accept or decline staff-proposed alternative dates.

### 5.7 In-app notifications
- Notification inbox listing alerts categorized by reference type (`DOCUMENT_REQUEST`, `SCHEDULE_REQUEST`, `GENERAL`).
- Read/unread status indicators.
- Single notification mark-as-read and global "Mark all as read" actions.
- Reference-aware navigation: tapping an alert navigates directly to the referenced document request or schedule booking.

### 5.8 Public parish events
- Public discovery feed of active liturgical and parish events (`GET /parish-events/all`).
- Events list screen with month-by-month pagination and filtering.
- Event detail view displaying event title, date, time slot, location, description, and assigned priest information.

### 5.9 Profile and settings
- Profile view displaying account status, verification badge, and contact details.
- Edit Profile screen with input validation and backend synchronization.
- Settings screen with legal terms viewer, privacy policy viewer, app version info, and sign-out action.

## 6. Acceptance criteria verified

- All parishioner workflows consume real `/api/v1` backend endpoints.
- Staff-only actions are completely excluded from the mobile bundle.
- Auth bootstrap and session transitions are deterministic with zero redirect loops.
- File and receipt uploads enforce size and MIME constraints with seamless HEIC conversion.
- Double-tap and concurrent mutation races are prevented via UI locks and backend idempotency.
- All 22 Jest test suites (161 tests), TypeScript typechecks, and ESLint rules pass cleanly with 0 errors and 0 warnings.
