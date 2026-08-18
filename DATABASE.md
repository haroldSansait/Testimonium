# PostgreSQL & Prisma Database Administration Guide

This guide details database schema migration management, canonical parish seeding, validation rules, capacity controls, automated backup strategies, and disaster recovery procedures for TESTIMONIUM.

---

## 1. Database Connection Architecture

TESTIMONIUM uses PostgreSQL (hosted on Supabase) via Prisma ORM (`@prisma/client` `v7.8.0` and `@prisma/adapter-pg` driver adapter).

### Connection String Format

```ini
# Primary database connection (with transaction connection pooling)
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?schema=public&sslmode=require"

# Direct database connection for migration execution
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres?schema=public"
```

---

## 2. Prisma Schema Migrations & Commands

### Running Migrations in Production

DO NOT run `npx prisma migrate dev` in production environments. Always run:

```bash
cd testimonium-backend
npx prisma migrate deploy
```

### Creating New Schema Changes (Development)

1. Modify `testimonium-backend/prisma/schema.prisma`.
2. Generate migration SQL file:
   ```bash
   npx prisma migrate dev --name describe_change_here
   ```
3. Commit generated migration files under `prisma/migrations/`.

### Prototyping Without Migration Files (`prisma db push`)

For rapid prototyping when schema changes do not need to be versioned:
```bash
npx prisma db push
npx prisma generate
```

---

## 3. Core Database Models & Architectural Rules

### 1. Document Request Fee Snapshotting
- `document_requests.fee Decimal(10, 2)`: Persisted immediately upon request draft creation.
- Prevents retroactive price changes made in Parish Settings from mutating past/in-flight document requests.

### 2. Capacity & Concurrency Architecture
- **Venue Capacity (`parishes.venue_capacity Int?`)**: Maximum physical occupancy of the church sanctuary (informational limit shown to parishioners on the scheduling interface).
- **Slot Capacity (`event_settings.capacitySettings.slotCapacity Int`)**: Maximum concurrent bookings per time slot enforced atomically via Serializable transactions.
- **Daily Limit (`event_settings.capacitySettings.dailyLimit Int`)**: Maximum total confirmed/pending appointments allowed per parish per calendar date.

### 3. Canonical Default Time Slots
When `eventSettings.timeSlots` is `null` or `undefined`, the backend enforces canonical defaults:
- **Weekdays (Mon–Fri)**: `["08:00 AM", "09:30 AM", "01:30 PM", "03:30 PM"]`
- **Saturdays**: `["06:00 AM", "08:00 AM", "09:30 AM", "01:30 PM", "03:30 PM"]`
- Explicit configured lists override defaults.
- Explicit empty lists `[]` indicate zero online availability and do NOT fall back to defaults.

---

## 4. Database Seeding & Canonical Dataset

### Seeding Execution

To populate default roles (`DIOCESE_COORDINATOR`, `PRIEST`, `SECRETARY`, `PARISHIONER`), vicariate parishes, pre-provisioned staff, mass schedule templates, and parish events:

```bash
cd testimonium-backend
npx prisma db seed
# Or using node directly:
node prisma/seed.js
```

### Seeded Canlaon Vicariate Dataset

TESTIMONIUM maintains a seeded canonical dataset of the 7 official parishes/stations in the Canlaon Vicariate (Diocese of San Carlos):
1. **Our Lady of the Mountains Quasi-Parish** (San Carlos City, Negros Occidental)
2. **St. Joseph Parish** (Canlaon City, Negros Oriental)
3. **Our Lady of the Miraculous Medal Parish** (Don Salvador Benedicto, Negros Occidental)
4. **Nuestra Señora De Las Flores Mission Station** (Canlaon City, Negros Oriental)
5. **Our Lady of Peace and Good Voyage Quasi-Parish** (San Carlos City, Negros Occidental)
6. **Holy Child Parish** (San Carlos City, Negros Occidental)
7. **Our Lady of Guadalupe Parish** (Vallehermoso, Negros Oriental)

Pre-provisioned staff accounts (Priest & Secretary per parish, plus Diocese Coordinator) are initialized with `firebaseUid: null` and dynamically linked on first login via Just-In-Time (JIT) authentication.

---

## 5. Automated Backup Strategy

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

## 6. Restore & Rollback Procedures

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
