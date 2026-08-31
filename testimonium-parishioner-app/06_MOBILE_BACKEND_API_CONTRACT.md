# TESTIMONIUM Parishioner Mobile — Backend API Contract

**Base URL:** `/api/v1`
**Last reconciled:** 24 August 2026
**Status:** All mobile endpoints integrated and verified.

## 1. Authentication and headers

Except for `GET /health`, all requests made by the mobile client include:

```http
Authorization: Bearer <firebase-id-token>
```

Endpoints supporting deduplication (e.g. `POST /schedule-requests`) additionally accept an optional `Idempotency-Key` header containing a client-generated UUID.

## 2. Implemented endpoint catalog

### 2.1 Authentication and onboarding

| Method | Endpoint | Description & Payload |
| --- | --- | --- |
| `GET` | `/auth/profile` | Returns current backend profile for the authenticated Firebase user. |
| `PUT` | `/auth/profile` | Updates profile details (`fullName`, `contactNumber`, `address`). Returns updated profile. |
| `POST` | `/auth/login` | Bootstraps session. Accepts optional `{ legalAcceptance: { termsVersion, privacyVersion } }` for Google JIT users. |
| `POST` | `/auth/register` | Registers backend user (`fullName`, `email`, `contactNumber`, `address`, `legalAcceptance`). |
| `POST` | `/auth/legal-acceptance` | Submits legal compliance `{ termsVersion, privacyVersion }`. |
| `POST` | `/auth/resend-verification` | Rate-limited request to resend verification email. |

### 2.2 Parish directory and document requirements

| Method | Endpoint | Description & Payload |
| --- | --- | --- |
| `GET` | `/parishes` | Retrieves active parishes with optional `search`, `type`, `page`, and `limit` query parameters. |
| `GET` | `/parishes/:id` | Returns complete parish detail including patron, contact, office hours, and gallery. |
| `GET` | `/document-requirements` | Retrieves required document checklist items, supporting documents, and fee structures. |

### 2.3 Document requests and payment

| Method | Endpoint | Description & Payload |
| --- | --- | --- |
| `POST` | `/requests` | Creates a request draft `{ parishId, documentType, applicantName, relationship, purpose, isDraft: true }`. |
| `POST` | `/requests/:id/submit` | Finalizes and submits a draft request. Generates unique tracking number. |
| `POST` | `/requests/:id/cancel` | Cancels an eligible pending request. |
| `GET` | `/requests` | Lists the authenticated user's document requests. |
| `GET` | `/requests/:id` | Retrieves full request detail including fee snapshot, attachments, and timeline history. |
| `GET` | `/requests/tracking/:trackingNumber` | Direct tracking lookup for owned requests. |
| `POST` | `/requests/:id/files` | Multipart upload for up to 5 supporting documents (`files` field, PDF/image, 5 MB max each). |
| `POST` | `/requests/:id/receipt` | Multipart upload for payment receipt (`receipt` field, JPEG/PNG only, 5 MB max). |
| `POST` | `/requests/:id/resubmit-corrections` | Resubmits corrected request details or replacement files. |
| `GET` | `/payment/configuration` | Resolves parish payment instructions, QR image URL, and active payment modes. |

### 2.4 Scheduling and appointments

| Method | Endpoint | Description & Payload |
| --- | --- | --- |
| `GET` | `/schedule-requests` | Lists the user's upcoming and past schedule requests. |
| `GET` | `/schedule-requests/configuration` | Returns authoritative parish configuration (enabled services, time slots, daily/slot limits). Query param: `parishId`. |
| `GET` | `/schedule-requests/availability-dates` | Queries parish availability across a date range (`parishId`, `startDate`, `endDate`). |
| `GET` | `/schedule-requests/available-slots` | Computes dynamic available slots (`parishId`, `date`, `eventType`). |
| `POST` | `/schedule-requests` | Creates a schedule request `{ parishId, eventType, requestedDate, startDatetime, endDatetime, remarks }`. Supports `Idempotency-Key`. |
| `GET` | `/schedule-requests/:id` | Returns schedule booking details, priest assignment, and reschedule proposals. |
| `POST` | `/schedule-requests/:id/respond-reschedule` | Parishioner accepts (`status: "CONFIRMED"`) or declines (`status: "CANCELLED"`) a staff-proposed reschedule. |

### 2.5 Public parish events

| Method | Endpoint | Description & Payload |
| --- | --- | --- |
| `GET` | `/parish-events/all` | Public discovery feed for active liturgical events. Supports `year` (YYYY) and `month` (1-12) filters. |

### 2.6 Notifications

| Method | Endpoint | Description & Payload |
| --- | --- | --- |
| `GET` | `/notifications` | Returns user in-app notification alerts with reference metadata. |
| `PATCH` | `/notifications/read-all` | Marks all notifications for the user as read. |
| `PATCH` | `/notifications/:id/read` | Marks a single notification as read. |

## 3. Error response handling

Standard error format from the backend:

```json
{
  "success": false,
  "message": "Human-readable error explanation",
  "code": "OPTIONAL_ERROR_CODE",
  "errors": []
}
```

The mobile client maps error codes to actionable UI states:
- `400 / SERVICE_NOT_OFFERED`: Explains the selected service is not available at the parish.
- `400 / LEGAL_ACCEPTANCE_REQUIRED`: Triggers Google JIT legal modal challenge.
- `409 / CONFLICT / FULLY_BOOKED`: Slot was booked concurrently; prompts user to pick another slot.
- `413 / FILE_TOO_LARGE`: Alerts user to the 5 MB limit.
- `429 / RATE_LIMITED`: Displays retry cooldown message.
## Scheduling availability consistency update

Mobile continues to use the canonical Parish → Service → Date → Time Slot → Confirmation flow. It reads services and capacity from GET /schedule-requests/configuration, dates from /availability-dates, and slots from /available-slots. No client fallback may invent services, dates, slots, or capacities.

On PARISH_CLOSED, FULLY_BOOKED, SLOT_NOT_CONFIGURED, SCHEDULE_CONFLICT, DATE_UNAVAILABLE, SERVICE_UNAVAILABLE_ON_DAY, or the earlier canonical availability errors, the wizard invalidates/refetches configuration, date, and slot queries and returns the user to the affected step. Help remains a stack route under Profile/Settings; it is not a sixth tab.
