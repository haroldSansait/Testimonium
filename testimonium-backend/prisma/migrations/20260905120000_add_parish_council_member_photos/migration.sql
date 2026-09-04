-- ==============================================================================
-- PHASE 3 MIGRATION: PARISH COUNCIL OFFICER PHOTOS
-- ==============================================================================
-- 1. Adds nullable photo_url to parish_council_members (stores canonical CDN URL).
-- 2. Adds nullable photo_object_key to parish_council_members (stores R2 object key).
-- 3. Non-destructive: existing council member rows default to NULL.
-- 4. Preserves all existing PPC and PFC data and configuration.
-- ==============================================================================

-- AlterTable
ALTER TABLE "parish_council_members" ADD COLUMN "photo_url" VARCHAR(500);
ALTER TABLE "parish_council_members" ADD COLUMN "photo_object_key" VARCHAR(255);
