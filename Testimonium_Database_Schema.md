# TESTIMONIUM Database Schema

**Last reconciled:** 3 September 2026
**Authoritative file:** `testimonium-backend/prisma/schema.prisma`
**Database:** PostgreSQL, accessed through Prisma 7 (`@prisma/adapter-pg`).

This reference summarizes the 26 physical models and 21 enums implemented in the TESTIMONIUM backend. Prisma model names map to the listed `snake_case` tables and database columns.

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
| `Weekday` | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` |
| `ScheduleDateRuleMode` | `INHERIT`, `AVAILABLE`, `UNAVAILABLE` |
| `EventVisibility` | `PUBLIC`, `PARISH_PRIVATE` |
| `ReportScope` | `PARISH`, `DIOCESE` |
| `ReportCategory` | `MEETING`, `ACTIVITY`, `IMPORTANT_EVENT`, `OTHER` |
| `EmailOutboxStatus` | `QUEUED`, `PROCESSING`, `SENT`, `RETRY`, `FAILED` |
| `EmailType` | `DOCUMENT_SUBMITTED`, `DOCUMENT_NEEDS_CORRECTION`, `DOCUMENT_PAYMENT_NEEDS_CORRECTION`, `DOCUMENT_READY_FOR_PICKUP`, `SCHEDULE_SUBMITTED`, `SCHEDULE_PROPOSED_RESCHEDULE`, `SCHEDULE_CONFIRMED` |
| `OcrStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `ParishCouncilType` | `PASTORAL`, `FINANCE` |

## Identity and parish directory

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `roles` | `role_id` | unique `role_name`, `description` | One role to many users. |
| `parishes` | `parish_id` | unique `parish_name`, optional unique `slug`; type, contact/location/patron/email; coordinates (`latitude`, `longitude`), map zoom, pin color, show label; cover/logo/gallery; active flag; document/event/office/payment settings; available-documents JSON; venue capacity; `scheduling_config_version`; timestamps | One parish to users, requests, schedules, availabilities, templates, events, weekday/date rules, daily reports, activity logs, and one optional `councilConfiguration`. Indexed by type, active status, municipality. |
| `users` | `user_id` | optional unique Firebase UID; unique email; profile/contact; role/parish IDs; assistant/verified/status/color; legal-acceptance (`terms_accepted_at`, `privacy_accepted_at`, `terms_version`, `privacy_version`) and verification-resend fields; `email_notifications_enabled` (Boolean, default `true`); timestamps | Required role; optional parish. Indexed by role, parish, status, creation date. |

## Parish council governance

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `parish_council_configurations` | `config_id` | unique `parish_id`, `finance_council_enabled` (Boolean, default false), `version` (Int, default 1), timestamps | Cascades with parish. Unique constraint on `parish_id`. One configuration to many council members. |
| `parish_council_members` | `member_id` | `council_configuration_id`, `council_type` (`PASTORAL`, `FINANCE`), `position_title` (VarChar(200)), `member_name` (VarChar(200)), `sort_order` (Int), timestamps | Cascades with council configuration. Composite indexes on `[council_configuration_id, council_type]` and `[council_configuration_id, sort_order]`. |

## Document-request and payment flow

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `document_requests` | `request_id` | owner/parish/processor IDs; unique tracking number; applicant, relationship, draft flag, document type, purpose; request and payment statuses; R2 proof key/QR reference; fee snapshot (`Decimal(10,2)`); remarks/correction fields (`correction_note`, `payment_correction_note`, `correction_requirement_ids`); processing dates | Required submitter and parish; optional processor. One-to-many attachments, transactions, history. Indexed by owner, parish, processor, type, status, payment status, date, composite `[parish_id, date_requested]`, tracking number. |
| `request_attachments` | `attachment_id` | request ID, original name, R2 key, type, size, category (`primary`, `supporting`, `receipt`), upload time | Cascades when request is deleted; indexed by request. |
| `payment_transactions` | `payment_id` | request ID, amount (`Decimal(10,2)`), provider/reference, verification status, verifier/date, creation time | Cascades with request; one-to-many receipts; indexed by request, verifier, composite `[status, created_at]`. |
| `receipt_uploads` | `receipt_id` | payment transaction ID, R2 key, name, MIME type, size, SHA-256 image hash, upload time | Cascades with transaction; one-to-one OCR result; indexed by transaction, image hash, upload time. |
| `ocr_results` | `ocr_id` | unique receipt ID; parsed reference/amount/date/provider/merchant/account; raw text; status/confidences (`ocr_confidence`, `parser_confidence`, `final_confidence`); compression/engine metadata; duplicate flags (`is_duplicate`, `duplicate_request_id`, `duplicate_reason`) | Cascades with receipt; indexed by reference number. |
| `request_history` | `history_id` | request/optional actor IDs, action, old/new status, remarks, timestamp | Cascades with request; actor is set null if user removed; indexed by request, actor, composite `[new_status, created_at]`. |

## Scheduling and parish operations

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `schedules` | `schedule_id` | requester/parish/processor/assigned-priest IDs; event type (16 canonical types); requested/start/end and proposed dates/times; location; status/conflict flag; display title; `proposal_version`; priest assignment response status and reason; timestamps | Required requester/parish; optional staff references. Indexed by user, parish, assigned priest, processor, event type, status, requested date, composite `[parish_id, requested_date]`, `created_at`, composite `[parish_id, created_at]`. |
| `parish_weekday_rules` | `rule_id` | parish ID, `weekday`, `is_available`, timestamps | Cascades with parish. Unique constraint on `[parish_id, weekday]`; indexed by parish. |
| `parish_service_weekday_rules` | `rule_id` | parish ID, `event_type`, `weekday`, `is_available`, timestamps | Cascades with parish. Unique constraint on `[parish_id, event_type, weekday]`; indexed by parish. |
| `parish_schedule_date_rules` | `date_rule_id` | parish ID, `exception_date`, `base_mode` (`INHERIT`, `AVAILABLE`, `UNAVAILABLE`), reason, creator ID, timestamps | Cascades with parish; creator set null. Unique constraint on `[parish_id, exception_date]`; indexed by `[parish_id, exception_date]`. One-to-many service overrides. |
| `parish_schedule_date_service_overrides` | `override_id` | date rule ID, `event_type`, `mode` (`INHERIT`, `AVAILABLE`, `UNAVAILABLE`) | Cascades with date rule. Unique constraint on `[date_rule_id, event_type]`; indexed by date rule. |
| `parish_availabilities` | `availability_id` | parish/optional user IDs, availability type, inclusive date range (`start_date`, `end_date`), title/description, timestamps | Cascades with parish; user set null. Indexed by parish and date range `[start_date, end_date]`. |
| `mass_schedule_templates` | `template_id` | parish, day type, time slot, label, active flag, optional priest and response, timestamps | Cascades with parish; priest set null. Indexed by parish and day type. |
| `parish_events` | `event_id` | parish, creator, title/type/description/location, event date/times, assigned priest/response, active flag, `visibility` (`PUBLIC`, `PARISH_PRIVATE`), `version`, timestamps | Cascades with parish; users set null. Indexed by parish, event date, composite `[parish_id, event_date]`, and composite `[visibility, event_date]`. |

## Daily reports, transactional outbox, communication, and audit

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `daily_reports` | `report_id` | `report_date`, `scope` (`PARISH`, `DIOCESE`), optional `parish_id`, title, `category` (`MEETING`, `ACTIVITY`, `IMPORTANT_EVENT`, `OTHER`), description, creator ID, `is_archived`, `archived_at`, `archived_by`, `version`, timestamps | Parish optional (restricted on deletion); creator/archiver references. Indexed by `[parish_id, report_date]`, `[scope, report_date]`, `[category, report_date]`, creator, `is_archived`. |
| `email_outbox` | `email_outbox_id` | unique `transition_key`, recipient email, `email_type`, `reference_type`, `reference_id`, `payload` (JSON), `status` (`QUEUED`, `PROCESSING`, `SENT`, `RETRY`, `FAILED`), `attempt_count`, `next_attempt_at`, `last_error`, `provider_message_id`, `processing_token`, `processing_at`, `lease_expires_at`, `queued_at`, `sent_at`, timestamps | Indexed by `[status, next_attempt_at]`, `[lease_expires_at]`, `[reference_type, reference_id]`. |
| `notifications` | `notification_id` | user, title/message, delivery type (`PUSH`, `IN_APP`, `EMAIL`), read state/time, sent/created dates, optional reference type (`DOCUMENT_REQUEST`, `SCHEDULE_REQUEST`, `GENERAL`) and reference ID | Cascades with user; indexed by user, read state, sent date. |
| `faq_knowledge_base` | `faq_id` | question, answer, category, active flag, optional updater, timestamps | Updater set null; indexed by updater, active, category. |
| `chatbot_logs` | `chatbot_log_id` | optional user/session, question, response, timestamp | User set null; indexed by user, session, created date. |
| `activity_logs` | `log_id` | optional user, action, affected table/record, IP/user-agent, archive fields, system flag, `role`, `parish_id`, `previous_values`, `new_values`, `metadata`, timestamps | User/parish set null; indexed by user, affected table, created date, parish. |
| `idempotency_keys` | `idempotency_id` | user ID, unique key string (`VarChar(128)`), resource type (`VarChar(50)`), resource ID (`Int`), payload hash SHA-256 (`VarChar(64)`), creation time | Cascades with user; unique compound constraint on `[user_id, key, resource_type]`; indexed by `[user_id, key]`. |

## Entity relationship diagram

```text
Role 1 ── * User * ── 0..1 Parish
Parish 1 ── 0..1 ParishCouncilConfiguration 1 ── * ParishCouncilMember
User 1 ── * DocumentRequest * ── 1 Parish
DocumentRequest 1 ── * RequestAttachment
DocumentRequest 1 ── * PaymentTransaction 1 ── * ReceiptUpload 1 ── 0..1 OcrResult
DocumentRequest 1 ── * RequestHistory
User 1 ── * Schedule * ── 1 Parish
Parish 1 ── * ParishWeekdayRule
Parish 1 ── * ParishServiceWeekdayRule
Parish 1 ── * ParishScheduleDateRule 1 ── * ParishScheduleDateServiceOverride
Parish 1 ── * (ParishAvailability, MassScheduleTemplate, ParishEvent)
Parish 0..1 ── * DailyReport
User 1 ── * (Notification, ActivityLog, ChatbotLog, IdempotencyKey)
EmailOutbox (Standalone transactional outbox ledger)
```

## Data integrity and constraints

- PostgreSQL native database enums enforce role, status, event type, weekdays, visibility, report scopes/categories, email states, and workflow boundaries.
- `Decimal(10,2)` is used for all fee snapshots and payment amounts.
- `DocumentRequest.correctionRequirementIds` and `Parish.gallery` are PostgreSQL string arrays; `Parish.availableDocuments` and `EmailOutbox.payload` are JSON.
- `IdempotencyKey` enforces strict compound uniqueness on `[user_id, key, resource_type]` to prevent concurrent duplicate resource creation.
- `Parish.schedulingConfigVersion` coordinates optimistic Admin writes with row-locked booking validation.
- `ParishCouncilConfiguration.version` coordinates optimistic Admin writes on council members and finance toggle; lost updates return `409 COUNCIL_CONFIGURATION_STALE`.
- Toggling `finance_council_enabled` to false preserves dormant finance member records in `parish_council_members` rather than deleting them.
- Schema changes require explicit Prisma migrations. Consult [DATABASE.md](DATABASE.md) for the database migration protocol.
