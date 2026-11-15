-- Additive columns for structured schedule rejection details
ALTER TABLE "schedules"
ADD COLUMN "rejection_reason_code" VARCHAR(64),
ADD COLUMN "rejection_affected_requirements" JSONB,
ADD COLUMN "rejection_note" TEXT;

