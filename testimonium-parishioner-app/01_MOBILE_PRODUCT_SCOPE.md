# TESTIMONIUM Parishioner Mobile — Product Scope

**Baseline:** 20 August 2026  
**Audience:** Product owner, developers, UI/UX, QA, coding agents.

## 1. Product statement

TESTIMONIUM Parishioner Mobile is the native/mobile companion to the existing parishioner web portal. It provides parishioners with convenient access to parish discovery, sacramental document requests, request tracking, payment evidence submission, scheduling, events, notifications, and profile management through the same existing backend and Firebase project.

The mobile app is not a replacement for the admin portal and must not duplicate diocesan/staff administration.

## 2. Goals

Mobile v1 should:

- provide a polished parishioner-first experience on phones;
- reuse the existing authenticated `/api/v1` backend;
- preserve the same workflow and security rules as the parishioner web portal;
- make high-frequency tasks easier on mobile, especially tracking, scheduling, receipt capture, parish discovery, and notifications;
- support camera/gallery/file selection safely;
- preserve accessibility and low-friction navigation;
- avoid client-side duplication of backend rules;
- provide a stable foundation for later push notifications and a future RAG assistant.

## 3. Non-goals for initial mobile v1

Do not include in initial v1 unless separately approved:

- staff/admin portal capabilities;
- coordinator parish management;
- staff request processing;
- mass-template administration;
- staff availability administration;
- activity-log administration;
- analytics dashboards;
- map configuration;
- direct Cloudflare R2 uploads;
- direct database access;
- native push notifications before device-token backend support exists;
- offline mutation queues for document/payment/scheduling transactions;
- AI chatbot or RAG responses;
- OCR-based automatic payment approval;
- client-side calculation that overrides fee/availability/workflow decisions from the backend.

## 4. Primary user

The mobile app's primary authenticated role is `PARISHIONER`.

Important domain rule:

> A parishioner must not be treated as permanently bound to a single "home parish" unless the backend contract later explicitly introduces that concept.

Parishioners can discover parishes and perform eligible workflows against the selected target parish as permitted by the backend.

## 5. Mobile v1 feature set

### 5.1 Authentication and onboarding
- Email/password sign in.
- Google sign in if supported by the current mobile Firebase configuration.
- Email verification flow.
- Registration.
- Legal acceptance.
- Profile completion.
- Logout/session expiry handling.
- Account switching for Google where technically supported by the chosen mobile auth method.

### 5.2 Home
- Personal welcome/status.
- Quick actions.
- Recent document requests.
- Upcoming schedule/appointment information.
- Vicariate/parish events discovery.
- Unread notification count.
- Clear entry points to requests, schedules, parishes, and profile.

### 5.3 Parish directory
- List/search active visible parishes.
- Parish details.
- Contact/location information.
- Images already exposed by the backend.
- Map/list discovery using mobile-native map presentation if included in v1.
- Do not expose coordinator map-configuration controls.

### 5.4 Document requests
- Browse available document types/requirements.
- Create request draft.
- Enter applicant/relationship/purpose data required by backend.
- Select target parish.
- Add supporting documents.
- Review request.
- Submit.
- View current state and request history.
- View correction requirements and resubmit eligible corrections.
- Cancel when backend permits.

### 5.5 Payment
- Retrieve authoritative payment configuration from backend.
- Show amount from request fee snapshot/backend response.
- Show configured payment method/QR where available.
- Capture/select receipt.
- Validate client-side for UX only.
- Upload through backend.
- Show payment-under-review state.
- Never claim OCR equals payment approval.

### 5.6 Request tracking
- List user's requests.
- Request detail.
- Tracking number.
- Status.
- Actual history.
- Standard/expected process can be shown only when clearly labeled and not fabricated as actual history.
- Correction/payment banners based on current workflow state.

### 5.7 Scheduling
- Discover eligible event/sacrament types from implemented UI/backend rules.
- Select parish/date.
- Retrieve available slots from backend.
- Submit schedule request.
- View current schedule state.
- Respond to staff reschedule proposal.
- View priest assignment status if returned.
- Backend remains authoritative for conflicts and slot capacity.

### 5.8 Events and calendar
- Use parishioner discovery event feed.
- Display active/current parish events.
- Calendar/list presentation.
- No staff event mutation controls.

### 5.9 Notifications
- In-app notification list.
- Read/unread state.
- Mark one/all read.
- Navigate to referenced request/schedule when reference metadata supports it.
- Native push is a later phase unless backend device registration is added.

### 5.10 Profile
- View/edit authenticated profile.
- Profile-completion requirements remain backend-authoritative.
- Legal/version state as needed.
- Session/logout controls.

## 6. Core user journeys

### Journey A — New parishioner
1. Launch app.
2. Register.
3. Verify email if required.
4. Complete legal/profile onboarding.
5. Arrive at Home.
6. Browse parish or start a request.

### Journey B — Request a document
1. Open Requests.
2. Start new request.
3. Select target parish/document type.
4. Review requirements.
5. Enter required request details.
6. Upload supporting documents.
7. Review draft.
8. Submit.
9. Track status.
10. If payment is requested, follow payment flow.
11. If correction is requested, correct and resubmit.
12. Track until ready/completed.

### Journey C — Pay and submit receipt
1. Open eligible request.
2. Load payment configuration.
3. Confirm amount and configured payment method.
4. Enlarge payment QR if present.
5. Pay outside app.
6. Capture/select JPEG/PNG receipt.
7. Upload once.
8. Show under-review state.
9. Staff verification remains required.

### Journey D — Schedule sacramental service
1. Open Schedule.
2. Select service/event type and parish.
3. Choose date.
4. Request backend available slots.
5. Select a slot.
6. Submit.
7. Track status.
8. Respond to reschedule proposal if needed.

### Journey E — Change device / return later
1. Firebase restores supported auth state.
2. App fetches current backend profile.
3. App evaluates onboarding/session state.
4. App routes to the correct screen.
5. No stale local workflow state overrides the backend.

## 7. Acceptance criteria for mobile v1

Mobile v1 is ready for a broader test when:

- all required parishioner flows use the real API provider;
- no staff-only route/action is exposed;
- auth/profile bootstrap is deterministic;
- request creation/submission/tracking works without duplicate mutations;
- scheduling handles backend conflicts gracefully;
- file/receipt selection obeys current MIME/size rules;
- HEIC/HEIF receipt input is handled intentionally on iOS;
- no R2 credential or direct DB access exists in the app;
- no critical information is tooltip/hover-only;
- key screens work at common small/large phone widths;
- Android physical-device testing passes;
- iOS simulator/device testing is performed if iOS is in submission scope;
- app handles offline/network failure without corrupting state;
- app does not promise native push until implemented;
- AI/RAG remains out of the production flow until its knowledge prerequisites are met.

## 8. Product quality bar

The mobile app should feel like a sibling of the parishioner web portal, not a compressed web page and not a copy of the admin portal.

Prioritize:
- clear hierarchy;
- native navigation;
- fast perceived response;
- high-contrast accessible controls;
- graceful empty/error/loading states;
- truthful status messaging;
- minimal repeated branding;
- clear recovery from network/session expiry;
- comfortable one-handed interaction for high-frequency tasks.
