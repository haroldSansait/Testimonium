# PostgreSQL & Prisma Database Administration Guide

This guide details database schema migration management, canonical parish seeding, validation rules, automated backup strategies, and disaster recovery procedures for TESTIMONIUM.

---

## 1. Database Connection Architecture

TESTIMONIUM uses PostgreSQL (hosted on Supabase) via Prisma ORM (`@prisma/client` and `@prisma/adapter-pg`).

### Connection String Format

```ini
# Primary database connection (with connection pooling)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?schema=public&sslmode=require"

# Direct database connection for migration execution
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?schema=public"
```

---

## 2. Prisma Schema Migrations

### Running Migrations in Production

DO NOT run `npx prisma migrate dev` in production environment. Always run:

```bash
cd testimonium-backend
npx prisma migrate deploy
```

### Creating New Schema Changes (Development Only)

1. Modify `testimonium-backend/prisma/schema.prisma`.
2. Generate migration SQL file:
   ```bash
   npx prisma migrate dev --name describe_change_here
   ```
3. Commit generated migration files under `prisma/migrations/`.

---

## 3. Database Seeding & Canonical Validation

### Database Seeding

To populate default roles (`DIOCESE_COORDINATOR`, `PARISH_ADMIN`, `PRIEST`, `SECRETARY`, `PARISHIONER`), dioceses, and canonical parishes:

```bash
cd testimonium-backend
npx prisma db seed
```

### Canonical Parish Dataset Validation

TESTIMONIUM maintains a canonical dataset of 28 archdiocesan parishes in `address_parishes.md`. On non-production startup, `server.js` executes automatic data integrity checks:

- Validates total parish count against canonical dataset (28 parishes).
- Checks for missing geographical coordinates (`latitude`, `longitude`).
- Rejects stub `(0, 0)` coordinates.
- Validates feast day and cover image presence.

---

## 4. Automated Backup Strategy

### Daily Logical Backups (`pg_dump` Cron Job)

Create a backup script on the server at `/usr/local/bin/backup_testimonium.sh`:

```bash
#!/usr/bin/env bash
set -e

BACKUP_DIR="/var/backups/testimonium"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/testimonium_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

# Dump PostgreSQL Database
pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_FILE}"

# Retain backups for 30 days
find "${BACKUP_DIR}" -type f -name "*.sql.gz" -mtime +30 -delete

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE}"
```

Make script executable and add to crontab:

```bash
chmod +x /usr/local/bin/backup_testimonium.sh
# Add to crontab (Run daily at 2:00 AM)
0 2 * * * /usr/local/bin/backup_testimonium.sh >> /var/log/testimonium_backup.log 2>&1
```

### Supabase Automatic Point-In-Time Recovery (PITR)

If using Supabase Pro/Enterprise:
- Enable **Point-in-Time Recovery (PITR)** under Database Settings.
- Supabase automatically retains continuous write-ahead logs (WAL) allowing restore to any second within the retention window.

---

## 5. Restore & Rollback Procedures

### Restoring from a Gzip SQL Backup

```bash
# 1. Stop backend application to prevent write conflicts
pm2 stop testimonium-backend

# 2. Decompress and restore database dump
gunzip -c /var/backups/testimonium/testimonium_backup_20260803_020000.sql.gz | psql "${DATABASE_URL}"

# 3. Verify Prisma client state
npx prisma migrate status

# 4. Restart backend application
pm2 restart testimonium-backend
```

### Rolling Back a Failed Migration

If a migration fails during `npx prisma migrate deploy`:

1. Inspect status:
   ```bash
   npx prisma migrate status
   ```
2. Mark failed migration as resolved if rolled back manually:
   ```bash
   npx prisma migrate resolve --rolled-back "20260803_failed_migration_name"
   ```
