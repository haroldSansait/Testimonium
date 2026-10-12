-- Additive Lay Minister assignment state. Existing rows retain their current
-- meanings because every new flag defaults to false.
ALTER TABLE "schedules"
  ADD COLUMN "lay_minister_assigned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "mass_schedule_templates"
  ADD COLUMN "lay_minister_assigned" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "schedule_history"
  ADD COLUMN "lay_minister_assigned" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "schedule_alternative_proposals" (
  "proposal_id" SERIAL NOT NULL,
  "schedule_id" INTEGER NOT NULL,
  "created_by_id" INTEGER NOT NULL,
  "proposed_date" DATE NOT NULL,
  "proposed_start_datetime" TIMESTAMP(3) NOT NULL,
  "proposed_end_datetime" TIMESTAMP(3) NOT NULL,
  "note" VARCHAR(1000),
  "status" VARCHAR(30) NOT NULL DEFAULT 'SUBMITTED',
  "nominated_priest_id" INTEGER,
  "priest_response_status" VARCHAR(30),
  "priest_response_reason" VARCHAR(1000),
  "resolved_by_id" INTEGER,
  "resolved_at" TIMESTAMP(3),
  "base_schedule_version" INTEGER NOT NULL,
  "base_requested_date" DATE NOT NULL,
  "base_start_datetime" TIMESTAMP(3),
  "nomination_revision" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "schedule_alternative_proposals_pkey" PRIMARY KEY ("proposal_id"),
  CONSTRAINT "schedule_alternative_proposals_interval_check"
    CHECK ("proposed_end_datetime" > "proposed_start_datetime"),
  CONSTRAINT "schedule_alternative_proposals_status_check"
    CHECK ("status" IN ('SUBMITTED', 'PRIEST_PENDING', 'APPLIED', 'DECLINED', 'WITHDRAWN', 'SUPERSEDED')),
  CONSTRAINT "schedule_alternative_proposals_response_check"
    CHECK ("priest_response_status" IS NULL OR "priest_response_status" IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  CONSTRAINT "schedule_alternative_proposals_pending_nominee_check"
    CHECK (
      "status" <> 'PRIEST_PENDING'
      OR ("nominated_priest_id" IS NOT NULL AND "priest_response_status" = 'PENDING')
    ),
  CONSTRAINT "schedule_alternative_proposals_applied_nominee_check"
    CHECK (
      "status" <> 'APPLIED'
      OR ("nominated_priest_id" IS NOT NULL AND "priest_response_status" = 'ACCEPTED')
    ),
  CONSTRAINT "schedule_alternative_proposals_revision_check"
    CHECK ("nomination_revision" >= 0)
);

ALTER TABLE "schedules" ADD CONSTRAINT "schedules_lay_minister_assignment_check"
  CHECK (
    NOT "lay_minister_assigned"
    OR (
      "assigned_priest_id" IS NULL
      AND "priest_response_status" IS NULL
      AND "event_type" IN ('FUNERAL', 'BLESSING')
    )
  );

ALTER TABLE "mass_schedule_templates" ADD CONSTRAINT "mass_templates_lay_minister_assignment_check"
  CHECK (
    NOT "lay_minister_assigned"
    OR ("assigned_priest_id" IS NULL AND "priest_response_status" IS NULL)
  );

ALTER TABLE "schedule_alternative_proposals" ADD CONSTRAINT "schedule_alternative_proposals_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "schedules"("schedule_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_alternative_proposals" ADD CONSTRAINT "schedule_alternative_proposals_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_alternative_proposals" ADD CONSTRAINT "schedule_alternative_proposals_nominated_priest_id_fkey"
  FOREIGN KEY ("nominated_priest_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "schedule_alternative_proposals" ADD CONSTRAINT "schedule_alternative_proposals_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "schedule_alternative_proposals_schedule_id_idx"
  ON "schedule_alternative_proposals"("schedule_id");
CREATE INDEX "schedule_alternative_proposals_created_by_id_idx"
  ON "schedule_alternative_proposals"("created_by_id");
CREATE INDEX "schedule_alternative_proposals_nominated_priest_id_status_idx"
  ON "schedule_alternative_proposals"("nominated_priest_id", "status");
CREATE INDEX "schedule_alternative_proposals_status_idx"
  ON "schedule_alternative_proposals"("status");
CREATE INDEX "schedule_alternative_proposals_created_at_idx"
  ON "schedule_alternative_proposals"("created_at");
CREATE UNIQUE INDEX "schedule_alternative_proposals_one_open_per_schedule_idx"
  ON "schedule_alternative_proposals"("schedule_id")
  WHERE "status" IN ('SUBMITTED', 'PRIEST_PENDING');

-- The application accesses this table only through the backend's privileged
-- Prisma connection. Do not expose proposal rows through Supabase Data API.
ALTER TABLE "schedule_alternative_proposals" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "schedule_alternative_proposals" FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON SEQUENCE "schedule_alternative_proposals_proposal_id_seq" FROM PUBLIC, anon, authenticated;
