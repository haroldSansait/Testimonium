CREATE TYPE "RegistrantIdOcrStatus" AS ENUM (
  'AWAITING_IMAGES', 'PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'UNAVAILABLE'
);

CREATE TYPE "PrivateObjectCleanupStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'FAILED'
);

CREATE TABLE "registrant_id_evidence" (
  "registrant_id_evidence_id" SERIAL NOT NULL,
  "request_id" INTEGER NOT NULL,
  "front_object_key" VARCHAR(255),
  "front_mime_type" VARCHAR(50),
  "front_size" INTEGER,
  "front_sha256" VARCHAR(64),
  "front_uploaded_at" TIMESTAMP(3),
  "front_revision" INTEGER NOT NULL DEFAULT 0,
  "back_object_key" VARCHAR(255),
  "back_mime_type" VARCHAR(50),
  "back_size" INTEGER,
  "back_sha256" VARCHAR(64),
  "back_uploaded_at" TIMESTAMP(3),
  "back_revision" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "ocr_status" "RegistrantIdOcrStatus" NOT NULL DEFAULT 'AWAITING_IMAGES',
  "ocr_attempt_count" INTEGER NOT NULL DEFAULT 0,
  "ocr_next_attempt_at" TIMESTAMP(3),
  "ocr_processing_token" UUID,
  "ocr_processing_at" TIMESTAMP(3),
  "ocr_lease_expires_at" TIMESTAMP(3),
  "ocr_claimed_version" INTEGER,
  "ocr_claimed_front_key" VARCHAR(255),
  "ocr_claimed_back_key" VARCHAR(255),
  "ocr_processed_version" INTEGER,
  "ocr_provider" VARCHAR(50),
  "ocr_error_code" VARCHAR(80),
  "extracted_name" VARCHAR(200),
  "detected_id_type" VARCHAR(80),
  "id_number" VARCHAR(120),
  "date_of_birth" DATE,
  "expiry_date" DATE,
  "front_text" TEXT,
  "back_text" TEXT,
  "advisory_flags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "processed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registrant_id_evidence_pkey" PRIMARY KEY ("registrant_id_evidence_id")
);

CREATE TABLE "relationship_evidence_corrections" (
  "relationship_evidence_correction_id" SERIAL NOT NULL,
  "request_id" INTEGER NOT NULL,
  "requested_requirement_ids" TEXT[] NOT NULL,
  "baseline_front_revision" INTEGER NOT NULL DEFAULT 0,
  "baseline_back_revision" INTEGER NOT NULL DEFAULT 0,
  "baseline_auth_attachment_id" INTEGER,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "relationship_evidence_corrections_pkey" PRIMARY KEY ("relationship_evidence_correction_id")
);

CREATE TABLE "private_object_cleanup_jobs" (
  "cleanup_job_id" SERIAL NOT NULL,
  "object_key" VARCHAR(255) NOT NULL,
  "status" "PrivateObjectCleanupStatus" NOT NULL DEFAULT 'PENDING',
  "reason_code" VARCHAR(80) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processing_token" UUID,
  "processing_at" TIMESTAMP(3),
  "lease_expires_at" TIMESTAMP(3),
  "last_error_code" VARCHAR(80),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "private_object_cleanup_jobs_pkey" PRIMARY KEY ("cleanup_job_id")
);

CREATE UNIQUE INDEX "registrant_id_evidence_request_id_key" ON "registrant_id_evidence"("request_id");
CREATE INDEX "registrant_id_evidence_ocr_status_ocr_next_attempt_at_idx" ON "registrant_id_evidence"("ocr_status", "ocr_next_attempt_at");
CREATE INDEX "registrant_id_evidence_ocr_lease_expires_at_idx" ON "registrant_id_evidence"("ocr_lease_expires_at");
CREATE INDEX "relationship_evidence_corrections_request_id_requested_at_idx" ON "relationship_evidence_corrections"("request_id", "requested_at");
CREATE UNIQUE INDEX "private_object_cleanup_jobs_object_key_key" ON "private_object_cleanup_jobs"("object_key");
CREATE INDEX "private_object_cleanup_jobs_status_next_attempt_at_idx" ON "private_object_cleanup_jobs"("status", "next_attempt_at");
CREATE INDEX "private_object_cleanup_jobs_lease_expires_at_idx" ON "private_object_cleanup_jobs"("lease_expires_at");

ALTER TABLE "registrant_id_evidence" ADD CONSTRAINT "registrant_id_evidence_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "document_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "relationship_evidence_corrections" ADD CONSTRAINT "relationship_evidence_corrections_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "document_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Private evidence and worker state are server-only. The migration/runtime
-- database owner retains direct access; Supabase Data API roles receive none.
ALTER TABLE "registrant_id_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "relationship_evidence_corrections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "private_object_cleanup_jobs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  "registrant_id_evidence",
  "relationship_evidence_corrections",
  "private_object_cleanup_jobs"
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE
  "registrant_id_evidence_registrant_id_evidence_id_seq",
  "relationship_evidence_correct_relationship_evidence_correct_seq",
  "private_object_cleanup_jobs_cleanup_job_id_seq"
FROM PUBLIC, anon, authenticated;
