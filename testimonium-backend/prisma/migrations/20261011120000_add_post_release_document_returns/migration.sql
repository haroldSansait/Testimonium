-- AlterEnum
ALTER TYPE "DocumentRequestStatus" ADD VALUE 'RETURNED';

-- CreateTable
CREATE TABLE "document_returns" (
    "return_id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL DEFAULT 1,
    "reason_code" VARCHAR(50) NOT NULL,
    "notes" TEXT,
    "returned_object_key" VARCHAR(255) NOT NULL,
    "returned_file_name" VARCHAR(255) NOT NULL,
    "returned_file_type" VARCHAR(100),
    "returned_file_size" INTEGER,
    "returned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_by_user_id" INTEGER NOT NULL,
    "corrected_object_key" VARCHAR(255),
    "corrected_file_name" VARCHAR(255),
    "corrected_file_type" VARCHAR(100),
    "corrected_file_size" INTEGER,
    "corrected_at" TIMESTAMP(3),
    "corrected_by_staff_id" INTEGER,
    "corrected_revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_returns_pkey" PRIMARY KEY ("return_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_returns_request_id_cycle_number_key" ON "document_returns"("request_id", "cycle_number");

-- CreateIndex
CREATE INDEX "document_returns_request_id_returned_at_idx" ON "document_returns"("request_id", "returned_at");

-- CreateIndex
CREATE INDEX "document_returns_returned_by_user_id_idx" ON "document_returns"("returned_by_user_id");

-- CreateIndex
CREATE INDEX "document_returns_corrected_by_staff_id_idx" ON "document_returns"("corrected_by_staff_id");

-- AddForeignKey
ALTER TABLE "document_returns" ADD CONSTRAINT "document_returns_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "document_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_returns" ADD CONSTRAINT "document_returns_returned_by_user_id_fkey" FOREIGN KEY ("returned_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_returns" ADD CONSTRAINT "document_returns_corrected_by_staff_id_fkey" FOREIGN KEY ("corrected_by_staff_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Post-release document evidence is server-only. Keep the table and its
-- sequence inaccessible through Supabase's public Data API roles even when
-- automatic grants are enabled for the public schema.
ALTER TABLE "document_returns" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "document_returns"
FROM PUBLIC, anon, authenticated;

REVOKE ALL PRIVILEGES ON SEQUENCE "document_returns_return_id_seq"
FROM PUBLIC, anon, authenticated;
