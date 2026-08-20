# PostgreSQL and Prisma Operations

**Last reconciled:** 20 August 2026
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

The migration history is stored in `testimonium-backend/prisma/migrations/`. Current migrations establish the relational schema, rename the coordinator role, make Firebase UID optional, and add parish patron-saint/email fields.

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
- Receipt image hashes are compared against receipts tied to verified payments to flag potential reuse. The flag requires staff review.
- Scheduling has separate venue information, slot/daily controls in parish event settings, availability blocks, and a composite index on parish/date.
- Parish settings such as document/event configuration, office hours, and directory metadata are stored as structured text/JSON fields; validate them at the service boundary.
- Deletion behavior follows the Prisma relations: request children cascade with their request; required user/parish references restrict deletion; optional actor/processor assignments set null.

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
- Build/verify both portals after changes that affect API payloads or enum values.

See [Testimonium_Database_Schema.md](Testimonium_Database_Schema.md) for the model-level reference.
