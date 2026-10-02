-- CreateEnum
CREATE TYPE "GovernmentIdVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GovernmentIdRejectionReason" AS ENUM ('IMAGE_BLURRY', 'FRONT_BACK_INCOMPLETE', 'NAME_MISMATCH', 'ID_EXPIRED', 'UNSUPPORTED_OR_INVALID_DOCUMENT');

-- CreateTable
CREATE TABLE "government_id_verifications" (
    "verification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "GovernmentIdVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "front_object_key" VARCHAR(255),
    "back_object_key" VARCHAR(255),
    "id_type" VARCHAR(50),
    "verified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "rejection_reason" "GovernmentIdRejectionReason",
    "last_attempt_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_id_verifications_pkey" PRIMARY KEY ("verification_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "government_id_verifications_user_id_key" ON "government_id_verifications"("user_id");

-- CreateIndex
CREATE INDEX "government_id_verifications_status_idx" ON "government_id_verifications"("status");

-- CreateIndex
CREATE INDEX "government_id_verifications_expires_at_idx" ON "government_id_verifications"("expires_at");

-- AddForeignKey
ALTER TABLE "government_id_verifications" ADD CONSTRAINT "government_id_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
