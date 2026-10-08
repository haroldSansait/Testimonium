# PostgreSQL and Prisma Operations

**Last reconciled:** 8 October 2026
**Canonical schema:** `testimonium-backend/prisma/schema.prisma`

TESTIMONIUM uses PostgreSQL through Prisma 7 and the `@prisma/adapter-pg` driver adapter. Application code accepts `SUPABASE_DATABASE_URL` or `DATABASE_URL`; Prisma CLI configuration uses `DATABASE_URL` first, so set that value in deployment environments that run migrations.

## Connection configuration

```ini
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public&sslmode=require"
# Optional application alias:
SUPABASE_DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?schema=public&sslmode=require"
```

Keep connection strings in backend deployment secrets. Do not expose any database variables through Vite `VITE_*` configuration.

## Schema management

The migration history is stored in `testimonium-backend/prisma/migrations/`. Current working-tree migrations include:
- `20260704123959_init_testimonium_relational_schema`
- `20260704140000_rename_vicariate_admin_to_diocese_coordinator`
- `20260705113749_make_firebase_uid_optional`
- `20260707131952_add_patron_saint_and_email_to_parish`
- `20260823120000_add_idempotency_keys`
- `20260829090000_planned_additions`
- `20260901120000_add_email_preference_and_document_email_types`
- `20260902120000_add_parish_councils`
- `20260904120000_receipt_attempt_versioning`
- `20260905120000_add_parish_council_member_photos`
- `20260905180000_phase4_scheduling_foundation`
- `20260908214500_add_schedule_requested_priest_id`
- `20260910120000_add_rag_chatbot`
- `20260913150000_add_caloy_control_center`
- `20260919120000_add_mother_parish_and_ready_for_signing`
- `20260928120000_correct_mother_parish_designation`
- `20260928180000_enforce_single_mother_parish`
- `20260929210000_add_government_id_verification`
- `20261004120000_add_legal_policies`

### Development change flow

1. Modify `prisma/schema.prisma`.
2. Create and inspect a migration:

   ```bash
   cd testimonium-backend
   npx prisma migrate dev --name meaningful_change_name
   npx prisma generate
   ```

3. Commit the schema and generated migration together.
4. Update affected validation, service, API, portal types, and documentation.

### Production change flow

```bash
cd testimonium-backend
npx prisma migrate deploy
npx prisma generate
```

Do not run `prisma migrate dev` or use `prisma db push` as a production deployment mechanism. `db push` is suitable only for disposable local prototyping because it bypasses committed migration history.

## Seed data

Run the seed script only when provisioning an intended environment:

```bash
cd testimonium-backend
node prisma/seed.js
```

It upserts the four application roles and the canonical parish dataset. Review the script before applying it to an environment containing operational data.

## Important persistence rules

- `DocumentRequest.fee` is a request-time snapshot; later parish pricing changes must not alter in-flight requests.
- A request keeps correction notes, correction requirement IDs, payment state, receipt reference, and append-only `RequestHistory` records.
- Receipt evidence is retained in R2, while `ReceiptUpload`, `PaymentTransaction`, and one-to-one `OcrResult` persist verification state and OCR metadata.
- `ReceiptUpload` tracks attempt versioning: `attempt_version` > 0, compound uniqueness on `[payment_transaction_id, attempt_version]`, and a partial unique index on `payment_transaction_id` WHERE `is_superseded = false`. Re-uploading after correction automatically marks previous receipts as superseded while preserving full historical audit logs.
- Receipt image hashes are compared against receipts tied to verified payments to flag potential reuse. The flag requires staff review.
- Scheduling has separate venue information, slot/daily controls in parish event settings, availability blocks, and a composite index on parish/date.
- `ParishWeekdayRule`, `ParishServiceWeekdayRule`, and `ParishScheduleDateRule` persist booking policy. The migration backfills all weekdays as available, then persists Sunday unavailable service overrides for `WEDDING`, `MARRIAGE_SPECIAL`, and `FUNERAL`; these rows remain editable configuration, not source constants.
- Scheduling settings share `Parish.schedulingConfigVersion`. Writers lock the parish row and increment the version; booking transactions take the same lock before final validation.
- `Schedule` rows track integer `version` for optimistic concurrency and optional `requested_priest_id` for parishioner preferred priest selection. State mutations, reschedules, and emergency reschedules append historical snapshots to `ScheduleHistory`.
- `PriestPersonalSchedule` records store priest calendar commitments with an interval check constraint (`end_at > start_at`), optimistic versioning (`version`), and indexes on `[priest_id]` and `[start_at, end_at]` to support conflict detection.
- Existing `ParishEvent` rows are backfilled to `PUBLIC` before visibility becomes non-null. Event, report, and schedule writes use optimistic integer versions.
- `DailyReport` enforces `PARISH` plus non-null parish or `DIOCESE` plus null parish with a database check constraint. Reports archive in place.
- `EmailOutbox.transitionKey` is unique. Claim queries use `FOR UPDATE SKIP LOCKED`, a processing token, and an expiring lease; status/next-attempt indexes support recovery and retries. Dispatches respect `User.emailNotificationsEnabled` (default `true`); when disabled, transactional emails are omitted while in-app notifications persist.
- `EmailType` covers seven canonical lifecycle events across documents and schedules (`DOCUMENT_SUBMITTED`, `DOCUMENT_NEEDS_CORRECTION`, `DOCUMENT_PAYMENT_NEEDS_CORRECTION`, `DOCUMENT_READY_FOR_PICKUP`, `SCHEDULE_SUBMITTED`, `SCHEDULE_PROPOSED_RESCHEDULE`, `SCHEDULE_CONFIRMED`).
- `ParishCouncilConfiguration` has a 1-to-1 unique relationship with `Parish`. It manages `finance_council_enabled` and optimistic `version`. Associated `ParishCouncilMember` rows store `council_type` (`PASTORAL` or `FINANCE`), `position_title`, `member_name`, optional officer photos (`photo_url`, `photo_object_key`), and integer `sort_order`. Toggling PFC off retains dormant finance member rows in the database to prevent accidental data loss.
- `KnowledgeSource` stores diocesan and parish procedure text with a database check constraint (`scope = 'DIOCESE' AND parish_id IS NULL` OR `scope = 'PARISH' AND parish_id IS NOT NULL`), governance lifecycle (`authority`: `PROVISIONAL` -> `CONFIRMED`, `status`: `DRAFT` -> `ACTIVE` -> `RETIRED`), and optimistic integer `version`. Content and knowledge edits create a new version set of chunks and invalidate the previous version as `STALE`; governance-only confirm, publish, retire, and embedding-retry transitions preserve the content version. Migrated legacy FAQ records start in `DRAFT` and `PROVISIONAL` status without automatic retrieval; Coordinators subsequently review the source text, supply reviewed chunk sets, confirm, embed, and publish through standard governance.
- `KnowledgeChunk` stores chunk content, deterministic SHA-256 `contentHash`, `sourceVersion`, and 768-dimensional embeddings (`vector(768)` via PostgreSQL `pgvector`). Versioned chunk uniqueness is enforced via `@@unique([sourceId, sourceVersion, chunkOrder])`. Worker lease fields (`processingToken`, `leaseExpiresAt`, `embeddingAttemptCount`, `embeddingErrorCode`) manage background embedding progression (`PENDING` -> `PROCESSING` -> `READY` / `FAILED` / `STALE`). Chunks become eligible for embedding once the source is `CONFIRMED` in `DRAFT` status; sources become `ACTIVE` only when all current-version chunks are `READY`.
- `ChatbotLog` records additive telemetry including `selectedParishId`, `retrievedChunkIds`, `retrievalScores`, `fallback`, `category`, and latency. Default privacy posture writes `NULL` for `question` and `response` (`CHATBOT_LOG_RAW_TEXT=false`).
- `CaloyRuntimeConfig` manages diocesan assistant operational settings as a singleton row (`config_id = 1`). The table is unseeded on migration, allowing deployments to operate against validated `.env` values until the Diocese Coordinator saves settings (`expectedVersion = 0` creates the initial row). Stale updates are rejected via `409 CONFIG_VERSION_CONFLICT`. Check constraints enforce bounded limits (`ai_ten_minute_max >= 5`, `ai_daily_max >= ai_ten_minute_max`, `chatbot_request_deadline_ms BETWEEN 5000 AND 28000`, `log_retention_days BETWEEN 14 AND 365`). Settings updates and corresponding audit entries in `activity_logs` execute within a single atomic database transaction.
- `SystemLease` provides distributed atomic coordination using PostgreSQL database time (`NOW()`). The automated retention worker contends for the daily key `CALOY_TELEMETRY_RETENTION:YYYY-MM-DD` (eligible 03:00-03:59 Asia/Manila, executed at most once per Manila day). Both automated and manual telemetry purges contend for and periodically renew `CALOY_TELEMETRY_PURGE` while executing bounded 5,000-row batch deletions; lease loss immediately halts subsequent batches.
- `AiUsageEvent` captures privacy-safe, non-blocking telemetry for every external AI generation and embedding attempt (including retries) with latency, token consumption (`input_tokens`, `output_tokens`, `total_tokens`), and sanitized error categories. Telemetry rows correlate with `ChatbotLog` via `trace_id` without persisting user questions, responses, or API credentials.
- `Parish.is_mother_parish` is a non-null boolean designation with a safe default of `false`. It describes the parish itself; there is no parent/child parish relationship. Migration `20260928180000_enforce_single_mother_parish` establishes a PostgreSQL partial unique index `parishes_single_mother_parish_idx` ON `parishes ("is_mother_parish") WHERE "is_mother_parish" = true`, strictly guaranteeing at most one Mother Parish per diocese at the database engine level.
- `Parish.document_settings` persists JSON-structured document settings with per-type base prices (`price`) and custom requirement configuration (`requirements` map of canonical requirement IDs to boolean values).
- `DocumentRequestStatus` includes `READY_FOR_SIGNING` between `PROCESSING` and `READY_FOR_PICKUP`. Transition to `READY_FOR_SIGNING` represents the internal completion of drafting awaiting the active primary priest's physical signature and triggers an in-app notification to the active primary priest.
- Document request mutations (`PATCH /document-requests/:id/status`) are strictly restricted to Secretary and Diocese Coordinator; Priests have parish-scoped read-only access. Similarly, parish document settings and available documents mutations (`PATCH /parishes/:id/settings`) are restricted to Secretary and Diocese Coordinator (`PRIEST` receives `403 FORBIDDEN`).
- For `NEEDS_CORRECTION`, `valid_id` is strictly excluded from authoritative correction eligibility; direct attempts to include it in `correctionRequirementIds` return 400 `NON_CORRECTABLE_REQUIREMENT`. On resubmission (`POST /requests/:id/resubmit-corrections`), attachment replacements are checked only for attachment-backed requirements; legacy requests containing `valid_id` verify that the user's Government ID verification is effective (`isEffectivelyVerified`), rejecting with 403 `IDENTITY_NOT_VERIFIED` if unverified without demanding a replacement attachment file. Status CAS concurrency conflicts return 409 `DOCUMENT_REQUEST_CONCURRENCY_CONFLICT`.
- `GovernmentIdVerification` maintains a 1-to-1 unique relationship with `User` (`user_id`). It persists verification lifecycle state (`status`: `NOT_SUBMITTED`, `VERIFIED`, `REJECTED`), card type (`id_type`), verification timestamp (`verified_at`), expiration timestamp (`expires_at`), rejection reason (`rejection_reason`: `IMAGE_BLURRY`, `FRONT_BACK_INCOMPLETE`, `NAME_MISMATCH`, `ID_EXPIRED`, `UNSUPPORTED_OR_INVALID_DOCUMENT`), private R2 object keys (`front_object_key`, `back_object_key`), and `last_attempt_at`. Deleting a user cascades to delete their verification record.
- Government ID verification concurrency is coordinated via `SystemLease` key `GOVERNMENT_ID_VERIFICATION:<userId>`. Any material change to `User.fullName` in `PUT /auth/profile` or `PUT /users/:id` automatically invalidates active verification under the lease lock and purges old R2 images. Rate limiting is isolated per authenticated account via `governmentIdRateLimiter` (default 6 attempts / 10m).
- Verified Government ID status (`isEffectivelyVerified`) is checked before creating or submitting sacramental document requests (`DocumentRequest`) and schedule appointments (`Schedule`), returning 403 `IDENTITY_NOT_VERIFIED` when unverified. Effective Government ID verification automatically fulfills the canonical `valid_id` requirement during document request submission.
- `LegalPolicy` model stores authoritative Terms of Service and Privacy Policy (`legal_policies` table) keyed by enum `LegalPolicyType` (`TERMS_OF_SERVICE`, `PRIVACY_POLICY`). Columns include database-constrained `content` (plain text, nonblank, <= 50,000 characters), `revision` (integer >= 1, default 1), `effective_at` (`TIMESTAMPTZ(6)`), `updated_by_id` (FK `users`, SetNull on delete), `created_at`, and `updated_at`. Migration seeds exactly Terms v1.0 and Privacy v1.0 effective 2026-08-01; runtime reads fail closed if either authoritative row is unavailable. Publications lock the target row and use a revision-qualified update (`expectedRevision`, 409 `LEGAL_POLICY_VERSION_CONFLICT`). User acceptance/registration holds shared locks on both policy rows through the user write, preventing publication races. Unchanged normalized content returns `{ changed: false }` without bumping revision or timestamp. Content revisions bump independently (`v{revision}.0`) and create atomic audit logs recording SHA-256 content hashes (never storing full legal text in audit tables).
- Supabase RLS and Security Hardening Deferral: Row Level Security policies, table grants, Supabase Data API exposure, role permissions, and Supabase Auth configuration are intentionally untouched in this feature batch; RLS/security remediation is explicitly deferred to a dedicated later security phase.
- Feature Deployment Sequence: Safe rollout order requires: (1) forward additive database migration seeded with v1.0, (2) backend deployment, (3) parishioner web deployment, (4) mobile Android release, and (5) coordinator legal editing enabled after client deployment.
- Deletion behavior follows the Prisma relations: request children cascade with their request; required user/parish references restrict deletion; council configurations and members cascade with parish deletion; priest personal schedules cascade with priest deletion; government ID verification cascades with user deletion; legal policy updater references set null; optional actor/processor assignments set null.

## Backup and recovery

Use provider backups/PITR where available and take independent logical backups before every production migration.

```bash
pg_dump --format=custom --no-owner --file=testimonium-$(date +%F).dump "$DATABASE_URL"
pg_restore --list testimonium-YYYY-MM-DD.dump
```

A restore is an operational event: put the API in maintenance/read-only mode, restore to a verified target, run `npx prisma generate`, validate health and key records, then release traffic. Test restoration periodically; a backup is not a recovery plan until it has been restored successfully.

## Migration incident response

1. Stop the rollout and identify the applied migration with `npx prisma migrate status`.
2. Prefer a forward corrective migration for a live database.
3. Restore from a tested backup only when the approved recovery plan requires it.
4. Do not alter applied migration files or manually delete Prisma migration records to force alignment.
5. Record the incident and confirm request, payment, schedule, and audit-log integrity before reopening writes.

## Operational checks

- Monitor `GET /api/v1/health` after database releases.
- Ensure connection pooling is appropriate for the hosting provider and process count.
- Restrict database credentials to the backend/migration runner and rotate them through the secret manager.
- Build/verify both portals and mobile app types after changes that affect API payloads or enum values.

See [Testimonium_Database_Schema.md](Testimonium_Database_Schema.md) for the model-level reference (38 models and 31 enums).

## Relationship-evidence persistence

Migration 20261008120000_add_registrant_id_evidence adds RegistrantIdEvidence (one row per request with independent side revisions and OCR lease/version state), RelationshipEvidenceCorrection (per-round replacement baselines), and PrivateObjectCleanupJob (durable orphan/superseded-object cleanup). It also adds RegistrantIdOcrStatus and PrivateObjectCleanupStatus. The migration is additive and has not been applied to any live database by this implementation task.
