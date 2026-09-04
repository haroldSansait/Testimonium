BEGIN;

-- ==============================================================================
-- PHASE 2 MIGRATION: RECEIPT ATTEMPT VERSIONING & CONCURRENCY INVARIANTS
-- ==============================================================================
-- 1. Adds attempt_version and is_superseded columns with safe defaults.
-- 2. Enforces attempt_version > 0 constraint.
-- 3. Deterministically backfills historical receipts respecting canonical
--    DocumentRequest.payment_proof_object_key pointers.
-- 4. Enforces (payment_transaction_id, attempt_version) uniqueness.
-- 5. Enforces at most ONE active receipt (is_superseded = false) per transaction
--    via PostgreSQL partial unique index.
-- ==============================================================================

-- Step 1: Add columns with initial default values
ALTER TABLE "receipt_uploads" ADD COLUMN "attempt_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "receipt_uploads" ADD COLUMN "is_superseded" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Ensure attempt_version > 0
ALTER TABLE "receipt_uploads" ADD CONSTRAINT "receipt_uploads_attempt_version_check" CHECK ("attempt_version" > 0);

-- Step 3: Deterministic historical receipt authority backfill
--
-- Authority semantics per payment transaction:
-- A. Canonical Pointer Match (Normal Case):
--    If exactly one receipt in the transaction matches the canonical
--    DocumentRequest.payment_proof_object_key pointer, that receipt is designated
--    as the authoritative active proof (is_superseded = false), and all other
--    receipts in the transaction are marked superseded (is_superseded = true).
--
-- B. No Canonical Pointer (Fallback Case):
--    If DocumentRequest.payment_proof_object_key is NULL or empty string, the latest
--    receipt uploaded chronologically (highest uploaded_at, broken deterministically
--    by highest receipt_id) becomes authoritative (is_superseded = false). All earlier
--    attempts are marked superseded (is_superseded = true). This reflects latest user intent.
--
-- C. Pointer Mismatch or Multi-Match Collision (Defensive Fallback Case):
--    If a canonical pointer is populated but does not match any receipt in the transaction,
--    or matches more than one receipt (e.g., identical key reuse), the deterministic
--    fallback designates the latest receipt (highest uploaded_at, highest receipt_id)
--    as is_superseded = false. This ensures the database invariant (at most one active receipt)
--    is preserved without corrupting historical verified payment states or request statuses.
--
-- D. Verified Historical Payments Preserved:
--    Historical request and payment statuses are NEVER modified by this migration.
--    Attempt metadata is normalized strictly within receipt_uploads.
WITH receipt_order AS (
  SELECT
    r.receipt_id,
    r.payment_transaction_id,
    r.r2_object_key,
    ROW_NUMBER() OVER (
      PARTITION BY r.payment_transaction_id 
      ORDER BY r.uploaded_at ASC, r.receipt_id ASC
    ) AS calc_attempt_version,
    ROW_NUMBER() OVER (
      PARTITION BY r.payment_transaction_id 
      ORDER BY r.uploaded_at DESC, r.receipt_id DESC
    ) AS rev_rank,
    dr.payment_proof_object_key,
    COUNT(*) FILTER (
      WHERE dr.payment_proof_object_key IS NOT NULL 
        AND dr.payment_proof_object_key <> ''
        AND dr.payment_proof_object_key = r.r2_object_key
    ) OVER (PARTITION BY r.payment_transaction_id) AS canonical_match_count
  FROM "receipt_uploads" r
  JOIN "payment_transactions" pt ON r.payment_transaction_id = pt.payment_id
  JOIN "document_requests" dr ON pt.request_id = dr.request_id
),
resolved_authority AS (
  SELECT
    receipt_id,
    calc_attempt_version,
    CASE
      -- Semantics A: Exactly one receipt matches the canonical pointer
      WHEN canonical_match_count = 1 THEN
        CASE 
          WHEN payment_proof_object_key IS NOT NULL 
               AND payment_proof_object_key = r2_object_key THEN false 
          ELSE true 
        END
      -- Semantics B & C: No pointer, zero matches, or multiple matches -> latest upload is authoritative
      ELSE
        CASE 
          WHEN rev_rank = 1 THEN false 
          ELSE true 
        END
    END AS calc_is_superseded
  FROM receipt_order
)
UPDATE "receipt_uploads" r
SET 
  attempt_version = ra.calc_attempt_version,
  is_superseded = ra.calc_is_superseded
FROM resolved_authority ra
WHERE r.receipt_id = ra.receipt_id;

-- Fallback for any orphaned receipt uploads without matching request join (defensive)
WITH orphan_ranked AS (
  SELECT
    receipt_id,
    ROW_NUMBER() OVER (
      PARTITION BY payment_transaction_id 
      ORDER BY uploaded_at ASC, receipt_id ASC
    ) AS calc_attempt_version,
    ROW_NUMBER() OVER (
      PARTITION BY payment_transaction_id 
      ORDER BY uploaded_at DESC, receipt_id DESC
    ) AS rev_rank
  FROM "receipt_uploads"
  WHERE payment_transaction_id NOT IN (
    SELECT pt.payment_id 
    FROM "payment_transactions" pt 
    JOIN "document_requests" dr ON pt.request_id = dr.request_id
  )
)
UPDATE "receipt_uploads" r
SET
  attempt_version = o.calc_attempt_version,
  is_superseded = (o.rev_rank > 1)
FROM orphan_ranked o
WHERE r.receipt_id = o.receipt_id;

-- Step 4: Guarantee uniqueness of attempt_version per payment transaction
CREATE UNIQUE INDEX "receipt_uploads_payment_transaction_id_attempt_version_key" 
ON "receipt_uploads"("payment_transaction_id", "attempt_version");

-- Step 5: Guarantee at most ONE active (non-superseded) receipt per payment transaction
CREATE UNIQUE INDEX "receipt_uploads_single_active_attempt_idx" 
ON "receipt_uploads"("payment_transaction_id") 
WHERE "is_superseded" = false;

COMMIT;
