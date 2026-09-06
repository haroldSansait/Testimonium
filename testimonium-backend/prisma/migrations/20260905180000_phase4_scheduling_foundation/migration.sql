-- ==============================================================================
-- PHASE 4 MIGRATION: SCHEDULING FOUNDATION & PRIEST PERSONAL CALENDAR
-- ==============================================================================
-- 1. Adds optimistic concurrency version to schedules table.
-- 2. Creates schedule_history table for append-only prior state snapshots.
-- 3. Creates priest_personal_schedules table with interval check constraint.
-- 4. Establishes foreign keys and query performance indexes.
-- ==============================================================================

-- Step 1: Add version to schedules table with safe default
ALTER TABLE "schedules" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Step 2: Create schedule_history table
CREATE TABLE "schedule_history" (
    "history_id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "requested_date" DATE NOT NULL,
    "start_datetime" TIMESTAMP(3),
    "end_datetime" TIMESTAMP(3),
    "remarks" TEXT,
    "status" "ScheduleStatus" NOT NULL,
    "assigned_priest_id" INTEGER,
    "priest_response_status" VARCHAR(50),
    "reason" TEXT NOT NULL,
    "actor_id" INTEGER,
    "actor_role" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_history_pkey" PRIMARY KEY ("history_id")
);

-- Step 3: Create priest_personal_schedules table
CREATE TABLE "priest_personal_schedules" (
    "id" SERIAL NOT NULL,
    "priest_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "notes" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "priest_personal_schedules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "priest_personal_schedules_interval_check" CHECK ("end_at" > "start_at")
);

-- Step 4: Add foreign key constraints
ALTER TABLE "schedule_history" ADD CONSTRAINT "schedule_history_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("schedule_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_history" ADD CONSTRAINT "schedule_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "priest_personal_schedules" ADD CONSTRAINT "priest_personal_schedules_priest_id_fkey" FOREIGN KEY ("priest_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Add indexes
CREATE INDEX "schedule_history_schedule_id_idx" ON "schedule_history"("schedule_id");
CREATE INDEX "schedule_history_actor_id_idx" ON "schedule_history"("actor_id");
CREATE INDEX "schedule_history_created_at_idx" ON "schedule_history"("created_at");
CREATE INDEX "schedule_history_schedule_id_created_at_idx" ON "schedule_history"("schedule_id", "created_at");

CREATE INDEX "priest_personal_schedules_priest_id_idx" ON "priest_personal_schedules"("priest_id");
CREATE INDEX "priest_personal_schedules_priest_id_start_at_end_at_idx" ON "priest_personal_schedules"("priest_id", "start_at", "end_at");
CREATE INDEX "priest_personal_schedules_start_at_end_at_idx" ON "priest_personal_schedules"("start_at", "end_at");
