# TESTIMONIUM Database Schema

**Last reconciled:** 20 August 2026
**Authoritative file:** `testimonium-backend/prisma/schema.prisma`
**Database:** PostgreSQL, accessed through Prisma 7.

This reference summarizes the implemented physical models. Prisma model names map to the listed `snake_case` tables and keys.

## Enums

| Enum | Values |
| --- | --- |
| `RoleName` | `PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR` |
| `UserStatus` | `ACTIVE`, `INACTIVE` |
| `ParishType` | `PARISH`, `QUASI_PARISH`, `MISSION_STATION` |
| `DocumentType` | `BAPTISMAL_CERTIFICATE`, `CONFIRMATION_CERTIFICATE`, `MARRIAGE_CERTIFICATE`, `FIRST_COMMUNION_CERTIFICATE`, `MARRIAGE_BANNS`, `PERMIT_TO_MARRY`, `STATUS_OF_LIBERTY` |
| `DocumentRequestStatus` | `PENDING`, `UNDER_REVIEW`, `NEEDS_CORRECTION`, `PAYMENT_PENDING`, `PAYMENT_UNDER_REVIEW`, `PAYMENT_NEEDS_CORRECTION`, `PAYMENT_VERIFIED`, `PROCESSING`, `READY_FOR_PICKUP`, `COMPLETED`, `REJECTED`, `CANCELLED` |
| `PaymentStatus` | `UNPAID`, `PROOF_SUBMITTED`, `CONFIRMED` |
| `PaymentVerificationStatus` | `PENDING`, `VERIFIED`, `REJECTED` |
| `ScheduleEventType` | `WEDDING`, `BAPTISM`, `CONFIRMATION`, `PRIVATE_MASS`, `MASS_INTENTION`, `MARRIAGE_SPECIAL`, `WAKE_MASS`, `FUNERAL`, `ANOINTING_OF_THE_SICK`, `FIESTA`, `BLESSING`, `DELIVERANCE`, `THANKSGIVING`, `FIRST_COMMUNION`, `MASS_OF_HOLY_SPIRIT`, `CONFESSION` |
| `ScheduleStatus` | `PENDING`, `REQUESTED`, `PROPOSED_RESCHEDULE`, `WAITING_PARISHIONER_RESPONSE`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED` |
| `AvailabilityType` | `PARISH_CLOSED`, `SECRETARY_LEAVE`, `PRIEST_LEAVE`, `FULLY_BOOKED` |
| `NotificationType` | `PUSH`, `IN_APP`, `EMAIL` |
| `NotificationReferenceType` | `DOCUMENT_REQUEST`, `SCHEDULE_REQUEST`, `GENERAL` |
| `OcrStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |

## Identity and parish directory

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `roles` | `role_id` | unique `role_name`, `description` | One role to many users. |
| `parishes` | `parish_id` | unique `parish_name`, optional unique `slug`; type, contact/location/patron/email; map data; cover/logo/gallery; active flag; document/event/office/payment settings; available-documents JSON; venue capacity; timestamps | One parish to users, requests, schedules, availabilities, templates, events, and activity logs. Indexed by type, active status, municipality. |
| `users` | `user_id` | optional unique Firebase UID; unique email; profile/contact; role/parish IDs; assistant/verified/status/color; legal-acceptance and verification-resend fields; timestamps | Required role; optional parish. Indexed by role, parish, and status. |

## Document-request and payment flow

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `document_requests` | `request_id` | owner/parish/processor IDs; unique tracking number; applicant, relationship, draft/type/purpose; request and payment statuses; R2 proof key/QR reference; fee snapshot; remarks/correction fields; processing dates | Required submitter and parish; optional processor. One-to-many attachments, transactions, history. Indexed by owner, parish, processor, type, status, payment status, date, tracking number. |
| `request_attachments` | `attachment_id` | request ID, original name, R2 key, type, size, category, upload time | Cascades when request is deleted; indexed by request. |
| `payment_transactions` | `payment_id` | request ID, amount, provider/reference, verification status, verifier/date, creation time | Cascades with request; one-to-many receipts. |
| `receipt_uploads` | `receipt_id` | payment transaction ID, R2 key, name, MIME type, size, SHA-256 image hash, upload time | Cascades with transaction; one-to-one OCR result; indexed by transaction and hash. |
| `ocr_results` | `ocr_id` | unique receipt ID; parsed reference/amount/date/provider; raw text; status/confidences; compression/engine metadata; duplicate flags and duplicate request ID | Cascades with receipt; indexed by reference number. |
| `request_history` | `history_id` | request/optional actor IDs, action, old/new status, remarks, timestamp | Cascades with request; actor is set null if removed. |

## Scheduling and parish operations

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `schedules` | `schedule_id` | requester/parish/processor/assigned-priest IDs; event type; requested/start/end and proposed dates/times; location; status/conflict; display title; assignment response; timestamps | Required requester/parish; optional staff references. Indexed by IDs, event type/status/date, and parish/date. |
| `parish_availabilities` | `availability_id` | parish/optional user IDs, availability type, inclusive date range, title/description, timestamps | Cascades with parish; user set null. Indexed by parish and date range. |
| `mass_schedule_templates` | `template_id` | parish, day type, time slot, label, active flag, optional priest and response, timestamps | Cascades with parish; priest set null. Indexed by parish/day type. |
| `parish_events` | `event_id` | parish, creator, title/type/description/location, event date/times, assigned priest/response, active flag, timestamps | Cascades with parish; users set null. Indexed by parish and event date. |

## Communication, knowledge, and audit

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `notifications` | `notification_id` | user, title/message, delivery type, read state/time, sent/created dates, optional reference type/ID | Cascades with user; indexed by user, read state, sent date. |
| `faq_knowledge_base` | `faq_id` | question, answer, category, active flag, optional updater, timestamps | Updater set null; indexed by updater, active, category. |
| `chatbot_logs` | `chatbot_log_id` | optional user/session, question, response, timestamp | User set null; indexed by user, session, created date. |
| `activity_logs` | `log_id` | optional user, action, affected table/record, IP/user-agent, archive fields, system flag, role/parish, before/after/metadata text | User/parish set null; indexed by user, affected table, created date, parish. |

## Relationship overview

```text
Role 1 ── * User * ── 0..1 Parish
User 1 ── * DocumentRequest * ── 1 Parish
DocumentRequest 1 ── * RequestAttachment
DocumentRequest 1 ── * PaymentTransaction 1 ── * ReceiptUpload 1 ── 0..1 OcrResult
DocumentRequest 1 ── * RequestHistory
User 1 ── * Schedule * ── 1 Parish
Parish 1 ── * (ParishAvailability, MassScheduleTemplate, ParishEvent)
User 1 ── * (Notification, ActivityLog, ChatbotLog)
```

## Data integrity notes

- Prisma uses database enums for role/workflow constraints and explicit foreign-key delete rules.
- `Decimal(10,2)` is used for document fees and payment amounts.
- `DocumentRequest.correctionRequirementIds` and `Parish.gallery` are PostgreSQL string arrays; `Parish.availableDocuments` is JSON.
- Current timestamp fields use `now()` for creation and Prisma `@updatedAt` for updates where specified.
- Schema changes require a Prisma migration. Consult [DATABASE.md](DATABASE.md) for the operating procedure.
