-- Add the parish-level Mother Parish designation with a safe default.
ALTER TABLE "parishes"
ADD COLUMN "is_mother_parish" BOOLEAN NOT NULL DEFAULT false;

-- Remove the incorrectly modeled parish-to-parish hierarchy.
ALTER TABLE "parishes"
DROP CONSTRAINT "parishes_mother_parish_id_fkey";

DROP INDEX "parishes_mother_parish_id_idx";

ALTER TABLE "parishes"
DROP COLUMN "mother_parish_id";
