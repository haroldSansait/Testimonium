-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('SENDING', 'PENDING', 'VERIFIED', 'CONSUMED', 'EXPIRED', 'FAILED', 'INVALIDATED');

-- CreateTable
CREATE TABLE "otp_challenges" (
    "challenge_id" SERIAL NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "firebase_uid" VARCHAR(128),
    "purpose" "OtpPurpose" NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "binding" VARCHAR(180) NOT NULL,
    "operation_hash" VARCHAR(64),
    "operation_stage" VARCHAR(24),
    "operation_started_at" TIMESTAMP(3),
    "status" "OtpStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "invalidated_at" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reset_token_hash" VARCHAR(255),
    "reset_token_expires_at" TIMESTAMP(3),
    "reset_token_consumed_at" TIMESTAMP(3),
    "ip_address" VARCHAR(64),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("challenge_id")
);

-- CreateIndex
CREATE INDEX "otp_challenges_email_purpose_idx" ON "otp_challenges"("email", "purpose");

-- CreateIndex
CREATE INDEX "otp_challenges_firebase_uid_purpose_idx" ON "otp_challenges"("firebase_uid", "purpose");

-- CreateIndex
CREATE INDEX "otp_challenges_status_idx" ON "otp_challenges"("status");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "otp_challenges_created_at_idx" ON "otp_challenges"("created_at");

-- Row Level Security and permission lockdown
ALTER TABLE "otp_challenges" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "otp_challenges" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE "otp_challenges_challenge_id_seq" FROM PUBLIC, anon, authenticated;
