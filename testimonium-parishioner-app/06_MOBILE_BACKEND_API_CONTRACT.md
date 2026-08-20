# TESTIMONIUM Parishioner Mobile — Backend API Contract

**Base URL:** `/api/v1`  
**Baseline:** API documentation reconciled 20 August 2026.

## 1. Authentication convention

Except for `GET /health`, current documented endpoints require:

```http
Authorization: Bearer <firebase-id-token>
```

The mobile app must obtain the Firebase ID token through the Firebase client SDK and attach it through the centralized API client.

`ENABLE_DEV_AUTH=true` is backend-development-only and must never be relied on by a production mobile build.

## 2. Roles

Current backend roles:
- `PARISHIONER`
- `SECRETARY`
- `PRIEST`
- `DIOCESE_COORDINATOR`

The mobile app is parishioner-facing. Do not expose staff endpoints simply because they are documented.

## 3. Standard response expectations

Successful responses normally follow:

```json
{
  "success": true,
  "data": {}
}
```

Errors normally provide:
- `success`
- `message`
- optional `errors`

Some list endpoints may include pagination metadata.

The API client must safely tolerate empty/non-JSON error bodies and normalize them.

## 4. Auth/profile endpoints relevant to mobile

| Method | Path | Mobile use |
| --- | --- | --- |
| GET | `/auth/profile` | Restore/sync current backend profile. |
| PUT | `/auth/profile` | Update signed-in profile. |
| POST | `/auth/login` | Interactive login/bootstrap after Firebase auth. |
| POST | `/auth/register` | Register/complete backend user after Firebase auth. |
| POST | `/auth/legal-acceptance` | Record legal acceptance. |
| POST | `/auth/resend-verification` | Verification resend; rate-limited. |

### Rule
Do not use `POST /auth/login` as a generic profile refresh.

Interactive login and passive profile retrieval have different semantics.

## 5. Parish directory

| Method | Path | Mobile use |
| --- | --- | --- |
| GET | `/parishes` | Active/visible parish directory. |
| GET | `/parishes/:id` | Parish details. |

Coordinator-only map-config mutation endpoints are not mobile-parishioner features.

Document metadata:
- `GET /document-requirements`
- `GET /document-requirements/:type`

Use parish/type parameters only as supported by current backend validation.

## 6. Document requests

| Method | Path | Mobile use |
| --- | --- | --- |
| POST | `/requests` | Create validated draft. |
| POST | `/requests/:id/submit` | Submit owned draft. |
| POST | `/requests/:id/cancel` | Cancel eligible owned request. |
| GET | `/requests` | List caller's requests. |
| GET | `/requests/:id` | Request detail. |
| GET | `/requests/tracking/:trackingNumber` | Tracking lookup for owner. |
| POST | `/requests/:id/files` | Supporting files. |
| POST | `/requests/:id/receipt` | Payment receipt. |
| POST | `/requests/:id/resubmit-corrections` | Correction resubmission. |

### Ownership
The backend enforces ownership. Mobile must not assume a request ID is accessible just because it was passed through navigation.

## 7. Payment

| Method | Path | Mobile use |
| --- | --- | --- |
| GET | `/payment/configuration` | Resolve current payment configuration for caller/context. |

Receipt upload:
- field: `receipt`
- JPEG/PNG
- max 5 MB
- one file
- rate-limited

Receipt submission:
- stores receipt in R2;
- creates payment/OCR records;
- moves request to `PAYMENT_UNDER_REVIEW`;
- OCR runs asynchronously;
- staff remains final verifier.

## 8. Supporting uploads

`POST /requests/:id/files`

Current rules:
- up to five files;
- each max 5 MB;
- PDF, PNG, JPEG, WebP;
- multipart field `files`.

Client validation is advisory only. Backend rejection must be handled.

## 9. Scheduling

| Method | Path | Mobile use |
| --- | --- | --- |
| GET | `/schedule-requests` | Caller-scope schedules. |
| POST | `/schedule-requests` | Create validated schedule request. |
| GET | `/schedule-requests/available-slots` | Fetch available slots. |
| PATCH | `/schedule-requests/:id/status` | Only if parishioner is an authorized workflow participant for the requested transition. |
| POST | `/schedule-requests/:id/respond-reschedule` | Parishioner accepts/declines staff proposal. |
| GET | `/parish-availabilities` | Read relevant closures/leave/full-booked data if used in UI. |
| GET | `/calendar/events` | Caller-scope calendar events. |
| GET | `/parish-events/all` | Parishioner discovery feed. |

Do not expose:
- staff propose-reschedule;
- staff priest assignment;
- staff availability mutations;
- mass-template mutations;
- parish-event mutations.

## 10. Events

Use `GET /parish-events/all` for parishioner discovery.

Be careful with route ordering if backend routes are changed: named static routes such as `/all` must not be shadowed by dynamic `/:parishId` routes.

The current endpoint returns sanitized active/month-filtered discovery data per the implemented backend behavior.

## 11. Notifications

| Method | Path | Mobile use |
| --- | --- | --- |
| GET | `/notifications` | Notification list. |
| PATCH | `/notifications/read-all` | Mark all read. |
| PATCH | `/notifications/:id/read` | Mark one read. |

Current API docs do not define a device push-token registration endpoint. Therefore native push is not part of baseline v1 backend capability.

## 12. Dashboard

Documented authenticated endpoints:
- `/dashboard/stats`
- `/dashboard/schedule`
- `/dashboard/alerts`

Use only if current backend responses are appropriate for parishioner Home. Otherwise compose Home from narrower parishioner endpoints.

Do not assume staff dashboard DTOs are safe for parishioners simply because the route is "Authenticated"; inspect actual scope/DTO before use.

## 13. Error/status handling recommendations

### 400
Validation/domain error.
- show field/general message;
- preserve form.

### 401
Token/session invalid.
- one forced refresh attempt maximum;
- then reauth.

### 403
User authenticated but not authorized.
- do not retry;
- show safe access message;
- inspect if mobile called wrong endpoint.

### 404
Resource not found or no longer accessible.
- remove stale navigation/cache entry if appropriate.

### 409
Potential conflict.
- scheduling/duplicate state should refetch authoritative state.

### 413
File too large.
- show exact supported limit from current contract.

### 429
Rate limited.
- do not hammer retry;
- honor `Retry-After` if backend sends it;
- show retry-later message.

### 5xx
Server failure.
- safe retry for reads;
- no automatic retry for ambiguous non-idempotent mutation.

## 14. API change checklist

Before mobile consumes a new/changed endpoint:
- route registered in backend server;
- Firebase auth middleware;
- role/ownership/tenant middleware;
- validation schema;
- controller/service behavior;
- error behavior;
- rate limit if necessary;
- API documentation;
- mobile type/provider;
- tests.

## 15. Public URL caveat

Current R2 integration may return public object URLs and does not implement signed URLs.

Mobile must not broaden exposure by:
- sharing private URLs;
- logging them;
- storing them in analytics;
- making a "public documents gallery" out of request attachments.

If confidential-document download needs stronger access control, implement authenticated proxy/signed URLs in backend first.
