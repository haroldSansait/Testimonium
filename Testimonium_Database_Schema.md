# TESTIMONIUM Database Schema

**Last reconciled:** 8 October 2026
**Authoritative file:** `testimonium-backend/prisma/schema.prisma`
**Database:** PostgreSQL, accessed through Prisma 7 (`@prisma/adapter-pg`).

This reference summarizes the 35 physical models and 29 enums implemented in the TESTIMONIUM backend. Prisma model names map to the listed `snake_case` tables and database columns.

## Enums

| Enum | Values |
| --- | --- |
| `RoleName` | `PARISHIONER`, `SECRETARY`, `PRIEST`, `DIOCESE_COORDINATOR` |
| `UserStatus` | `ACTIVE`, `INACTIVE` |
| `ParishType` | `PARISH`, `QUASI_PARISH`, `MISSION_STATION` |
| `DocumentType` | `BAPTISMAL_CERTIFICATE`, `CONFIRMATION_CERTIFICATE`, `MARRIAGE_CERTIFICATE`, `FIRST_COMMUNION_CERTIFICATE`, `MARRIAGE_BANNS`, `PERMIT_TO_MARRY`, `STATUS_OF_LIBERTY` |
| `DocumentRequestStatus` | `PENDING`, `UNDER_REVIEW`, `NEEDS_CORRECTION`, `PAYMENT_PENDING`, `PAYMENT_UNDER_REVIEW`, `PAYMENT_NEEDS_CORRECTION`, `PAYMENT_VERIFIED`, `PROCESSING`, `READY_FOR_SIGNING`, `READY_FOR_PICKUP`, `COMPLETED`, `REJECTED`, `CANCELLED` |
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
| `GovernmentIdVerificationStatus` | `NOT_SUBMITTED`, `VERIFIED`, `REJECTED` |
| `GovernmentIdRejectionReason` | `IMAGE_BLURRY`, `FRONT_BACK_INCOMPLETE`, `NAME_MISMATCH`, `ID_EXPIRED`, `UNSUPPORTED_OR_INVALID_DOCUMENT` |
| `ParishCouncilType` | `PASTORAL`, `FINANCE` |
| `KnowledgeScope` | `DIOCESE`, `PARISH` |
| `KnowledgeAuthority` | `CONFIRMED`, `PROVISIONAL` |
| `KnowledgeSourceStatus` | `DRAFT`, `ACTIVE`, `RETIRED` |
| `KnowledgeSourceType` | `SYSTEM_GUIDE`, `PARISH_PROCEDURE`, `DIOCESE_PROCEDURE`, `CLERGY_INTERVIEW`, `OFFICIAL_SOURCE`, `LEGACY_FAQ`, `ADMIN_ENTRY` |
| `EmbeddingStatus` | `PENDING`, `PROCESSING`, `READY`, `FAILED`, `STALE` |
| `LegalPolicyType` | `TERMS_OF_SERVICE`, `PRIVACY_POLICY` |

## Identity and parish directory

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `roles` | `role_id` | unique `role_name`, `description` | One role to many users. |
| `parishes` | `parish_id` | unique `parish_name`, optional unique `slug`; `is_mother_parish` boolean (default `false`); type, contact/location/patron/email; coordinates (`latitude`, `longitude`), map zoom, pin color, show label; cover/logo/gallery; active flag; document/event/office/payment settings; available-documents JSON; venue capacity; `scheduling_config_version`; timestamps | One parish to users, requests, schedules, availabilities, templates, events, weekday/date rules, daily reports, activity logs, and one optional `councilConfiguration`. Partial unique index `parishes_single_mother_parish_idx` on `(is_mother_parish)` WHERE `is_mother_parish = true`. Indexed by type, active status, and municipality. |
| `users` | `user_id` | optional unique Firebase UID; unique email; profile/contact; role/parish IDs; assistant/verified/status/color; legal-acceptance (`terms_accepted_at`, `privacy_accepted_at`, `terms_version`, `privacy_version`) and verification-resend fields; `email_notifications_enabled` (Boolean, default `true`); timestamps | Required role; optional parish. Relations to document requests, schedules, priest commitments, notifications, logs, and one-to-one `governmentIdVerification`. Indexed by role, parish, status, creation date. |
| `government_id_verifications` | `verification_id` | `user_id` (Int, unique FK users), `status` (`GovernmentIdVerificationStatus`, default `NOT_SUBMITTED`), `front_object_key` (VarChar(255), optional), `back_object_key` (VarChar(255), optional), `id_type` (VarChar(50), optional), `verified_at` (Timestamp, optional), `expires_at` (Timestamp, optional), `rejection_reason` (`GovernmentIdRejectionReason`, optional), `last_attempt_at` (Timestamp, optional), `created_at`, `updated_at` | Belongs to `User` (1-to-1, cascades on user delete). Unique index on `user_id`. Indexed by `status` and `expires_at`. |

## Parish council governance

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `parish_council_configurations` | `config_id` | unique `parish_id`, `finance_council_enabled` (Boolean, default false), `version` (Int, default 1), timestamps | Cascades with parish. Unique constraint on `parish_id`. One configuration to many council members. |
| `parish_council_members` | `member_id` | `council_configuration_id`, `council_type` (`PASTORAL`, `FINANCE`), `position_title` (VarChar(200)), `member_name` (VarChar(200)), `photo_url` (VarChar(500), optional), `photo_object_key` (VarChar(255), optional), `sort_order` (Int), timestamps | Cascades with council configuration. Composite indexes on `[council_configuration_id, council_type]` and `[council_configuration_id, sort_order]`. |

## Document-request and payment flow

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `document_requests` | `request_id` | owner/parish/processor IDs; unique tracking number; applicant, relationship, draft flag, document type, purpose; request status (including `READY_FOR_SIGNING`) and payment statuses; R2 proof key/QR reference; fee snapshot (`Decimal(10,2)`); remarks/correction fields (`correction_note`, `payment_correction_note`, `correction_requirement_ids`); processing dates | Required submitter and parish; optional processor. One-to-many attachments, transactions, history. Indexed by owner, parish, processor, type, status, payment status, date, composite `[parish_id, date_requested]`, tracking number. |
| `request_attachments` | `attachment_id` | request ID, original name, R2 key, type, size, category (`primary`, `supporting`, `authorization_letter`, `receipt`, or canonical requirement ID), upload time | Cascades when request is deleted; indexed by request. |
| `payment_transactions` | `payment_id` | request ID, amount (`Decimal(10,2)`), provider/reference, verification status, verifier/date, creation time | Cascades with request; one-to-many receipts; indexed by request, verifier, composite `[status, created_at]`. |
| `receipt_uploads` | `receipt_id` | payment transaction ID, R2 key, name, MIME type, size, SHA-256 image hash, `attempt_version` (Int, default 1, CHECK > 0), `is_superseded` (Boolean, default false), upload time | Cascades with transaction; one-to-one OCR result; unique compound constraint on `[payment_transaction_id, attempt_version]`; unique partial index on `payment_transaction_id` WHERE `is_superseded = false`; indexed by transaction, image hash, upload time. |
| `ocr_results` | `ocr_id` | unique receipt ID; parsed reference/amount/date/provider/merchant/account; raw text; status/confidences (`ocr_confidence`, `parser_confidence`, `final_confidence`); compression/engine metadata; duplicate flags (`is_duplicate`, `duplicate_request_id`, `duplicate_reason`) | Cascades with receipt; indexed by reference number. |
| `request_history` | `history_id` | request/optional actor IDs, action, old/new status, remarks, timestamp | Cascades with request; actor is set null if user removed; indexed by request, actor, composite `[new_status, created_at]`. |

## Scheduling and parish operations

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `schedules` | `schedule_id` | requester/parish/processor/assigned-priest IDs; optional `requested_priest_id` (preferred priest); event type (16 canonical types); requested/start/end and proposed dates/times; location; status/conflict flag; display title; `proposal_version`; `version` (Int, default 1); priest assignment response status and reason; timestamps | Required requester/parish; optional staff references. Relations to append-only `schedule_history`. Indexed by user, parish, assigned priest, requested priest, processor, event type, status, requested date, composite `[parish_id, requested_date]`, `created_at`, composite `[parish_id, created_at]`. |
| `schedule_history` | `history_id` | `schedule_id` (FK schedules), `version` (Int), `requested_date` (Date), `start_datetime`, `end_datetime`, `remarks`, `status` (`ScheduleStatus`), optional `assigned_priest_id`, `priest_response_status`, `reason` (Text), optional `actor_id` (FK users), `actor_role` (VarChar(50)), `created_at` (Timestamp) | Foreign key to `schedules` (RESTRICT) and `users` (SET NULL). Append-only audit record created upon reschedule proposals, status changes, emergency reschedules, and priest responses. Indexed by `schedule_id`, `actor_id`, `created_at`, and `[schedule_id, created_at]`. |
| `priest_personal_schedules` | `id` | `priest_id` (FK users), `title` (VarChar(150)), `notes` (Text, optional), `start_at` (Timestamp), `end_at` (Timestamp), `version` (Int, default 1), `created_at`, `updated_at` | Cascades when priest user is deleted. Interval check constraint (`end_at > start_at`). Indexed by `priest_id`, composite `[priest_id, start_at, end_at]`, and `[start_at, end_at]`. |
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
| `activity_logs` | `log_id` | optional user, action, affected table/record, IP/user-agent, archive fields, system flag, `role`, `parish_id`, `previous_values`, `new_values`, `metadata`, timestamps | User/parish set null; indexed by user, affected table, created date, parish. |
| `idempotency_keys` | `idempotency_id` | user ID, unique key string (`VarChar(128)`), resource type (`VarChar(50)`), resource ID (`Int`), payload hash SHA-256 (`VarChar(64)`), creation time | Cascades with user; unique compound constraint on `[user_id, key, resource_type]`; indexed by `[user_id, key]`. |

## Knowledge Base and AI/RAG Chatbot

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `knowledge_sources` | `source_id` | `title`, `source_text`, `category`, `source_type` (Enum), `source_reference`, `scope` (Enum), `parish_id`, `authority` (Enum, default `PROVISIONAL`), `status` (Enum, default `DRAFT`), `version` (Int, default 1), `approved_by_id`, `approved_at`, `updated_by_id`, `effective_from`, `retired_at`, timestamps | Optional parish relation. Optional User relations (`approvedBy`, `updatedBy`). One source to many chunks. Check constraint: `(scope = 'DIOCESE' AND parish_id IS NULL) OR (scope = 'PARISH' AND parish_id IS NOT NULL)`. Indexed by `[scope, status, authority]`, `[parish_id]`, `[category]`, `[source_type]`. |
| `knowledge_chunks` | `chunk_id` | `source_id`, `content`, `chunk_order`, `content_hash` (SHA-256), `source_version`, `embedding` (`vector(768)` via pgvector), `embedding_provider`, `embedding_model`, `embedding_dimensions`, `embedding_status` (Enum, default `PENDING`), `embedded_at`, `processing_token`, `lease_expires_at`, `embedding_attempt_count`, `embedding_error_code`, `metadata` (JSON), timestamps | Belongs to `knowledge_sources`. Versioned uniqueness constraint: `@@unique([source_id, source_version, chunk_order])`. Indexed by `[source_id]`, `[embedding_status]`, `[source_id, source_version]`, `[source_id, embedding_status]`. |
| `chatbot_logs` | `chatbot_log_id` | `user_id`, `session_id`, `selected_parish_id`, `question` (nullable), `response` (nullable), `response_type` (nullable VarChar(50)), `trace_id` (nullable VarChar(100)), `retrieved_chunk_ids` (PostgreSQL `INTEGER[]`), `retrieval_scores` (PostgreSQL `DOUBLE PRECISION[]`), `fallback` (Boolean), `fallback_reason`, `category`, `embedding_provider`, `generation_provider`, `generation_model`, `latency_ms`, `error_category`, `created_at` | Optional User relation. Nullable text supports metadata-only logging when `CHATBOT_LOG_RAW_TEXT=false`. Indexed by `[user_id]`, `[session_id]`, `[created_at]`, `[response_type, created_at]`, `[generation_model, created_at]`, `[selected_parish_id, created_at]`, `[fallback, created_at]`, `[error_category, created_at]`, and `[trace_id]`. |
| `caloy_runtime_config` | `config_id` | `enabled` (Boolean, default true), `generation_provider` (`VarChar(50)`), `generation_model` (`VarChar(100)`), `ai_ten_minute_max` (Int), `ai_daily_max` (Int), `chatbot_request_deadline_ms` (Int), `automatic_retention_enabled` (Boolean, default false), `log_retention_days` (Int, default 90), `version` (Int, default 1), `updated_by_id`, timestamps | Singleton row (`config_id = 1`). Optional User relation (`updatedBy`). Unseeded on migration (empty table; falls back to `.env`). Managed via atomic optimistic concurrency (`expectedVersion`). Check constraints: `config_id = 1`, `version >= 1`, `ai_ten_minute_max >= 5`, `ai_daily_max >= ai_ten_minute_max`, `chatbot_request_deadline_ms BETWEEN 5000 AND 28000`, `log_retention_days BETWEEN 14 AND 365`. |
| `system_leases` | `lease_key` | `lease_key` (`VarChar(100)`, PK), `owner_token` (`VarChar(100)`), `lease_expires_at` (`TIMESTAMPTZ(6)`), `updated_at` | Atomic DB-backed coordination using PostgreSQL `NOW()` for expiry, owner-token renewal, and owner-token release. Daily retention uses `CALOY_TELEMETRY_RETENTION:YYYY-MM-DD`; manual and automatic deletion share renewable lease `CALOY_TELEMETRY_PURGE`. |
| `ai_usage_events` | `event_id` | `trace_id` (nullable UUID string), `provider` (`VarChar(50)`), `model` (`VarChar(100)`), `operation` (`VarChar(50)`: `GENERATE_CONTENT`, `EMBED_CONTENT`), `purpose` (`VarChar(50)`: `SEMANTIC_ROUTING`, `RAG_GENERATION`, `RESPONSE_COMPOSER`, `QUERY_EMBEDDING`, `DOCUMENT_EMBEDDING`), `attempt_number` (Int), `success` (Boolean), `status_code` (nullable Int), `error_category` (nullable VarChar(100)), `latency_ms` (Int), `input_tokens` (nullable Int), `output_tokens` (nullable Int), `total_tokens` (nullable Int), `created_at` | Non-blocking best-effort provider usage telemetry. Correlates with `chatbot_logs.trace_id`. Check constraints: `operation IN ('GENERATE_CONTENT', 'EMBED_CONTENT')`, `purpose IN ('SEMANTIC_ROUTING', 'RAG_GENERATION', 'RESPONSE_COMPOSER', 'QUERY_EMBEDDING', 'DOCUMENT_EMBEDDING')`, `attempt_number >= 1`, `latency_ms >= 0`, tokens `>= 0`. Indexed by `[created_at]`, `[trace_id]`, `[operation, created_at]`, `[purpose, created_at]`, `[model, created_at]`, and `[success, created_at]`. |

## Legal Policy Governance

| Table | Primary key | Important columns | Relations/indexes |
| --- | --- | --- | --- |
| `legal_policies` | `policy_type` (`LegalPolicyType`) | `content` (Text, non-empty, <= 50,000 chars), `revision` (Int, default 1), `effective_at` (`TIMESTAMPTZ(6)`), `updated_by_id` (optional Int FK users), `created_at` (`TIMESTAMPTZ(6)`), `updated_at` (`TIMESTAMPTZ(6)`) | Optional User relation (`updatedBy`). Managed exclusively by Diocese Coordinators with optimistic concurrency (`expectedRevision`). |

## Relationship graph summary

```text
Role 1 ── * User * ── 0..1 Parish
User 1 ── 0..1 GovernmentIdVerification
Parish 1 ── 0..1 ParishCouncilConfiguration 1 ── * ParishCouncilMember
User 1 ── * DocumentRequest * ── 1 Parish
DocumentRequest 1 ── * RequestAttachment
DocumentRequest 1 ── * PaymentTransaction 1 ── * ReceiptUpload 1 ── 0..1 OcrResult
DocumentRequest 1 ── * RequestHistory
User 1 ── * Schedule * ── 1 Parish
Schedule 1 ── * ScheduleHistory
User 1 ── * PriestPersonalSchedule
Parish 1 ── * ParishWeekdayRule
Parish 1 ── * ParishServiceWeekdayRule
Parish 1 ── * ParishScheduleDateRule 1 ── * ParishScheduleDateServiceOverride
Parish 1 ── * (ParishAvailability, MassScheduleTemplate, ParishEvent)
Parish 0..1 ── * DailyReport
Parish 0..1 ── * KnowledgeSource 1 ── * KnowledgeChunk
User 1 ── * (Notification, ActivityLog, ChatbotLog, IdempotencyKey)
User 0..1 ── * CaloyRuntimeConfig (Singleton updater relation)
User 0..1 ── * LegalPolicy (Policy updater relation)
ChatbotLog 1 (trace_id) ── 0..* AiUsageEvent (via unconstrained trace_id correlation)
SystemLease (Standalone distributed coordination lease ledger)
EmailOutbox (Standalone transactional outbox ledger)
```

## Data integrity and constraints

- PostgreSQL native database enums enforce role, status, event type, weekdays, visibility, report scopes/categories, email states, council types, government ID statuses/reasons, legal policy types, and workflow boundaries.
- `Decimal(10,2)` is used for all fee snapshots and payment amounts.
- `DocumentRequest.correctionRequirementIds` and `Parish.gallery` are PostgreSQL string arrays; `Parish.availableDocuments`, `Parish.documentSettings`, and `EmailOutbox.payload` are JSON.
- `Parish.is_mother_parish` is a non-null boolean with a safe default of `false`. A PostgreSQL partial unique index `parishes_single_mother_parish_idx` ON `parishes ("is_mother_parish") WHERE "is_mother_parish" = true` guarantees at most one Mother Parish exists per diocese at the database engine level.
- `DocumentRequestStatus` includes `READY_FOR_SIGNING` between `PROCESSING` and `READY_FOR_PICKUP`. Transitioning to `READY_FOR_SIGNING` represents the internal completion of drafting awaiting the active primary priest's physical signature, triggering an in-app notification to the active primary priest. Priests have parish-scoped read-only access to document requests, and mutations are restricted to Secretary and Coordinator (`PRIEST` receives `403 FORBIDDEN`).
- Document requirements are dynamically resolved by merging the system-wide `DOCUMENT_REQUIREMENTS_MATRIX` with parish-specific `documentSettings.requirements` (supporting both adding canonical requirements and disabling default requirements).
- Document request `NEEDS_CORRECTION` transition enforces canonical reason selection (`correctionReasonCode`), non-empty authoritative attachment-backed requirement IDs (`correctionRequirementIds`), and optional note (`correctionNote` <= 1000 chars), storing an authoritative multiline human-readable snapshot in `correction_notes` / `request_history`, emitting a dedicated notification with `{ throwOnError: true }`, and enqueuing an HTML-escaped email payload. The canonical `valid_id` is system-satisfied by effective Government ID verification and is rejected as a new correction target with 400 `NON_CORRECTABLE_REQUIREMENT`. Legacy rows containing `valid_id` require current effective verification on explicit parishioner resubmission but never require an attachment for that ID. Status CAS conflict returns 409 `DOCUMENT_REQUEST_CONCURRENCY_CONFLICT`.
- `GovernmentIdVerification` enforces 1-to-1 uniqueness on `user_id` and cascades on user deletion. Images are stored exclusively in dedicated private bucket `R2_IDENTITY_BUCKET_NAME`. Sharp-based Laplacian variance sharpness (threshold >= 15) and distinct SHA-256 binary hash validation prevent blurry or duplicate uploads. Multi-marker regexes with strength rankings (`STRONG`, `SUPPORTING`, `SHARED`) identify 5 supported Philippine card types (`PHIL_SYS`, `DRIVERS_LICENSE`, `UMID`, `VOTER_ID`, `POSTAL_ID`). Deterministic side classification detects misoriented uploads (`FRONT_IS_BACK`, `BACK_IS_FRONT`, `BOTH_APPEAR_FRONT`, `BOTH_APPEAR_BACK`, `SIDES_SWAPPED`). Fuzzy Levenshtein token matching against legal profile `fullName` and expiration checks protect identity integrity. Concurrency is guarded via `SystemLease` key `GOVERNMENT_ID_VERIFICATION:<userId>`, and any material profile name change automatically invalidates active verification and cleans up prior R2 objects. Effective verification gates document requests and appointments, and automatically satisfies the canonical `valid_id` checklist requirement.
- `LegalPolicy` table contains exactly two authoritative rows keyed by `LegalPolicyType` (`TERMS_OF_SERVICE`, `PRIVACY_POLICY`) with database checks for revision, nonblank content, and the 50,000-character limit. Runtime reads fail closed if either row is unavailable. Revision increments on publication (`v{revision}.0`) while unchanged content returns `{ changed: false }`. Publication locks the target row and performs a revision-qualified update; acceptance/registration holds shared locks on both rows through the user write. Stale writers receive 409 `LEGAL_POLICY_VERSION_CONFLICT`. Publication executes transactional audit logging recording SHA-256 content hashes (never storing full legal text in audit rows).
- Supabase RLS and Security Hardening Deferral: Row Level Security policies, table grants, Supabase Data API exposure, role permissions, and Supabase Auth configuration are intentionally untouched in this feature batch; RLS/security remediation is explicitly deferred to a dedicated later security phase.
- `ReceiptUpload` enforces `attempt_version > 0`, uniqueness on `[payment_transaction_id, attempt_version]`, and at most ONE active attempt (`is_superseded = false`) per payment transaction via a unique partial index.
- `PriestPersonalSchedule` enforces an interval check constraint (`end_at > start_at`) and optimistic versioning (`version`).
- `Schedule` maintains optimistic concurrency control via integer `version`, references optional `requested_priest_id` for parishioner priest preferences, and generates append-only `ScheduleHistory` records across transitions.
- `IdempotencyKey` enforces strict compound uniqueness on `[user_id, key, resource_type]` to prevent concurrent duplicate resource creation.
- `Parish.schedulingConfigVersion` coordinates optimistic Admin writes with row-locked booking validation.
- `ParishCouncilConfiguration.version` coordinates optimistic Admin writes on council members and finance toggle; lost updates return `409 COUNCIL_CONFIGURATION_STALE`.
- Toggling `finance_council_enabled` to false preserves dormant finance member records in `parish_council_members` rather than deleting them.
- `KnowledgeSource` enforces a check constraint: `(scope = 'DIOCESE' AND parish_id IS NULL) OR (scope = 'PARISH' AND parish_id IS NOT NULL)` to guarantee strict diocesan vs parish tenancy.
- `KnowledgeChunk` enforces compound uniqueness on `[source_id, source_version, chunk_order]` to allow non-destructive versioned chunk evolution.
- `CaloyRuntimeConfig` enforces singleton constraint `config_id = 1`, optimistic `version >= 1`, bounded limits, and is not seeded by migration to prevent overwriting deployment environment settings.
- `SystemLease` ownership changes are guarded by `lease_key` plus `owner_token`. Purge lease loss halts subsequent delete batches; the once-per-Manila-day marker is retained after success and released after failure.
- `AiUsageEvent` captures individual SDK attempts (including retries) with privacy-safe error categories, latency, and token usage without storing prompts, responses, or secrets.
- Schema changes require explicit Prisma migrations. Consult [DATABASE.md](DATABASE.md) for the database migration protocol.
