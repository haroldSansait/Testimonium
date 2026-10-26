# Web scheduling prerequisites

Implemented locally on October 26, 2026. Nothing was committed, pushed, deployed, or migrated on production. Android source and release configuration were untouched.

## Behavior and compatibility boundary

The Web booking flow conditionally adds **Upload Requirements** after time selection. It uses the parish's authoritative configuration, displays configured names, supports replacement/removal, validates PDF/JPEG/PNG/WebP files up to 5 MiB each, and blocks submission until all enabled prerequisites are selected. There are at most three files, matching the existing Settings catalog. Empty browser MIME types are supplied from the accepted extension before upload; the server verifies extension, MIME, binary signature, and size.

Exactly these services have configurable prerequisites:

| Service | Existing possible prerequisites |
| --- | --- |
| `WEDDING` | CENOMAR; Marriage License; Baptismal Certificate |
| `MARRIAGE_SPECIAL` | CENOMAR; Marriage License; Baptismal Certificate |
| `BAPTISM` | Marriage Certificate; Birth Certificate / Immunization Card |
| `CONFIRMATION` | Baptismal Certificate |
| `WAKE_MASS` | Death Certificate |
| `FUNERAL` | Death Certificate |

Only entries explicitly saved as `true` under `eventSettings[service].requirements[id]` are mandatory. Unselected prerequisites and the separate certificate Endorsement Letter are excluded. Disabled services still fail the existing service-availability checks. Services without prerequisites retain the existing steps.

`POST /api/v1/schedule-requests/web` is an authenticated, Parishioner-only multipart endpoint. It requires an `Idempotency-Key`; fields are `booking` (JSON matching the existing booking schema), `requirementIds` (JSON array aligned with files), and `files` (zero to three files). Configuration responses add requirement IDs/labels to enabled service entries. The server rechecks requirements under the existing parish lock and Serializable booking transaction.

**Enforcement is temporarily Web-only.** Existing `POST /api/v1/schedule-requests` JSON bookings remain compatible and do not require uploads, including Android bookings. A caller can still use that legacy endpoint without prerequisites. There is no User-Agent detection or client-provided enforcement flag.

The new Web idempotency namespace is `SCHEDULE_WEB_CREATE`; the legacy namespace and booking hash remain unchanged. Web keys include authenticated UID, booking fields, requirement IDs, and file content hashes. Retries and reselecting identical file contents reuse the key. Actual changed evidence receives a different key. The backend independently hashes file contents and rejects a reused key with changed data.

The Web scheduler also fixes a request-generation race discovered in Chrome: switching services while a date was already selected could let an obsolete slot fetch cancel date loading. Date, slot, configuration, and focus refresh operations now have separate guards. Preferred-priest selection, calendar availability, notes, statuses, proposals, and confirmation remain in their existing flow.

## Private storage and failure recovery

Files use opaque keys under `schedule-requirements/<parish>/<requester>/<uuid>` in the **existing approved private registrant-ID bucket**. They never use the public document bucket or public object URLs, and do not enter the registrant-ID OCR pipeline. There are no new environment variables or R2 infrastructure changes.

Before each upload, a durable `PrivateObjectCleanupJob` records the key with reason `SCHEDULE_ATTACHMENT_PENDING`, due one hour later. Uploads have a two-minute timeout per file. The booking, nested attachment records, cancellation of recovery jobs, notifications, and idempotency record share the existing booking transaction. If any upload, validation, booking, or persistence operation fails, no incomplete booking commits. Recovery jobs remain pending after partial failures, duplicate races, or process interruptions. Uncommitted files can temporarily remain in private storage until the existing cleanup worker deletes them; these are tracked recovery objects. The worker checks references before deletion and retries storage failures using its existing lease/backoff policy. Failed/exhausted jobs require the same operational monitoring as existing private-file cleanup jobs.

The transaction refuses to attach files whose cleanup jobs have already been claimed. Schedule deletion is restricted while evidence exists, preventing dangling objects from a parent-row cascade. This implementation adds no schedule/attachment deletion workflow.

`GET /api/v1/schedule-requests/:id/attachments` returns safe metadata only. `GET /api/v1/schedule-requests/:id/attachments/:attachmentId/file` streams authenticated bytes with `private, no-store` and `nosniff` headers. Access is allowed to the owning requester, same-parish Secretary/Priest, and Diocese Coordinator. Missing parish assignments and unrelated users/roles fail closed. Attachment IDs are constrained to their schedule. Raw object keys are never returned. Existing secure viewers are reused in Schedule Requests details and the requester's Web schedule details.

## Migration and deployment dependencies

Generated additive Prisma migration: `testimonium-backend/prisma/migrations/20261026090000_schedule_prerequisites/migration.sql`.

It creates `schedule_attachments`, a restrictive schedule foreign key, unique schedule/requirement and object-key constraints, and private metadata fields. Ownership/parish are inherited from the existing parent schedule. It enables RLS and revokes public-client table/sequence privileges. Existing tables and rows are not rewritten. **The migration has not been applied to production Supabase.**

Deployment order, when separately authorized:

1. Review pending migration history and apply the additive migration through the existing Prisma deployment process, after its predecessor migrations. Do not use schema push/reset. The backend database role must retain its existing privileged server access; public Supabase clients receive no attachment policies.
2. Generate Prisma Client from the updated schema and deploy/restart the backend, including the existing `PrivateObjectCleanupWorker`. The migration must precede requests to the new endpoints.
3. Confirm existing `R2_REGISTRANT_ID_BUCKET_NAME` and `R2_REGISTRANT_ID_BUCKET_APPROVED` identify an actually private approved bucket, distinct from public/identity buckets. Existing R2 credentials must permit bucket availability checks and object upload/read/delete. No secrets or configuration values were changed or printed in this task. Live bucket privacy and delivery were not inspected.
4. Deploy Parishioner Web and Admin against that backend. Any proxy/request limit must accommodate three 5 MiB files plus multipart fields. Uploads/downloads pass through the backend, so no browser-to-R2 CORS or public bucket access is needed.
5. Perform a live Web booking, Secretary preview/download, and failure-cleanup smoke test after deployment. No Android rebuild or APK installation is required.

## Validation

- Backend: **108/108 passed** across new service/HTTP/recovery tests (including the full three-document multipart envelope and overflow rejection), disposable migration test, Phase 5 scheduling, Phase 4 foundation/blocker checks, supporting upload middleware, and private-file regressions.
- The migration executes against a disposable PGlite PostgreSQL instance. Tests verify existing schedules survive, foreign keys and uniqueness work, parent deletion is restricted, RLS is enabled, and both `anon` and `authenticated` lack direct table/sequence access. No configured/shared database is contacted.
- Web: **42/42 existing regressions passed** for scheduling, upload policy, private viewers, and related features.
- Chrome: **5/5 passed** using the real React scheduler, calendar, selectors, upload policy, and API provider with controlled authentication and HTTP transport. Coverage includes all-required blocking, invalid files, replacement/removal, duplicate-click blocking, 390px layout, service/parish changes, refreshed requirements, retry keys including identical-file reselection, and no-prerequisite bookings. This is browser evidence with fixture transport, not a live backend/R2 test.
- Admin: **16/16 focused checks passed**, including the new attachment component rendering/metadata endpoint tests, existing requirement-management checks (including Endorsement Letter), and transport/cache isolation checks.
- Both portal TypeScript checks and Vite production builds passed. Focused lint has only existing warnings: Web `parishes` hook dependency and Admin's existing empty-array check. Admin build retains its existing large-chunk warning.
- Additional Admin regressions are not fully green: `features_regression.test.mjs` contains an unchanged assertion that Diocese Coordinator has document-management permission; `request_management_permissions.test.mjs` has three existing null-query mocks. Those three failures were reproduced with the original HEAD Schedule Requests page in a temporary test, which was removed. Related schedule mutation/control cases pass.
- No physical Android, live Firebase authentication, live R2, shared-database concurrency, or deployed end-to-end behavior is claimed. Android compatibility is covered by unchanged-source verification and backend service/HTTP tests of attachment-free JSON bookings.

Repeatable focused command in each of the three application directories: `npm run test:schedule-requirements`. Browser tests require Chrome/Chromium and permission to start local Vite/Chrome processes. New tests are also included in their application default test scripts.

## Changed files

Backend:

- `testimonium-backend/controllers/ScheduleController.js`
- `testimonium-backend/routes/scheduleRoutes.js`
- `testimonium-backend/middlewares/scheduleUploadMiddleware.js` (new)
- `testimonium-backend/services/ScheduleService.js`
- `testimonium-backend/services/ScheduleRequirements.js` (new)
- `testimonium-backend/services/ScheduleAttachmentService.js` (new)
- `testimonium-backend/services/R2Service.js`
- `testimonium-backend/services/PrivateObjectCleanupWorker.js`
- `testimonium-backend/prisma/schema.prisma`
- `testimonium-backend/prisma/migrations/20261026090000_schedule_prerequisites/migration.sql` (new)
- `testimonium-backend/scripts/schedule_requirements.test.js` (new)
- `testimonium-backend/scripts/schedule_requirements_migration.test.js` (new)
- `testimonium-backend/package.json`

Parishioner Web:

- `testimonium-parishioner-web/src/pages/dashboard/EventSchedulerPage.tsx`
- `testimonium-parishioner-web/src/pages/dashboard/ScheduleDetailPage.tsx`
- `testimonium-parishioner-web/src/providers/api/scheduler.ts`
- `testimonium-parishioner-web/src/providers/types.ts`
- `testimonium-parishioner-web/src/features/scheduler/components/ScheduleAttachments.tsx` (new)
- `testimonium-parishioner-web/scripts/schedule_requirements.test.js` (new)
- `testimonium-parishioner-web/scripts/helpers/scheduler-browser.js` (new)
- `testimonium-parishioner-web/scripts/fixtures/scheduler-app.tsx` (new)
- `testimonium-parishioner-web/scripts/fixtures/scheduler-boundaries.ts` (new)
- `testimonium-parishioner-web/package.json`

Admin:

- `testimonium-admin-portal/src/pages/ScheduleRequestsPage.tsx`
- `testimonium-admin-portal/src/components/schedule-requests/ScheduleAttachments.tsx` (new)
- `testimonium-admin-portal/scripts/schedule_requirements.test.mjs` (new)
- `testimonium-admin-portal/package.json`

Report: `docs/SCHEDULE_PREREQUISITES.md` (new).
