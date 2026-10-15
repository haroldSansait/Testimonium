-- Additive only. Deployment requires separate authorization.
ALTER TABLE "mass_schedule_templates" ADD COLUMN "occurrence_revision" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "mass_occurrence_overrides" (
  "override_id" SERIAL NOT NULL,
  "template_id" INTEGER NOT NULL,
  "occurrence_date" DATE NOT NULL,
  "day_type" VARCHAR(20) NOT NULL,
  "time_slot" VARCHAR(20) NOT NULL,
  "template_revision" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_id" INTEGER NOT NULL,
  "revoked_by_id" INTEGER,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mass_occurrence_overrides_pkey" PRIMARY KEY ("override_id"),
  CONSTRAINT "mass_occurrence_overrides_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "mass_schedule_templates"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mass_occurrence_overrides_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mass_occurrence_overrides_revoked_by_id_fkey" FOREIGN KEY ("revoked_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "mass_occurrence_overrides_template_id_occurrence_date_key" ON "mass_occurrence_overrides"("template_id", "occurrence_date");
