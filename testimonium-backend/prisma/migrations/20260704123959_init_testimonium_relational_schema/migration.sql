-- CreateEnum
CREATE TYPE "RoleName" AS ENUM ('PARISHIONER', 'SECRETARY', 'PRIEST', 'VICARIATE_ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ParishType" AS ENUM ('PARISH', 'QUASI_PARISH', 'MISSION_STATION');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BAPTISMAL_CERTIFICATE', 'CONFIRMATION_CERTIFICATE', 'MARRIAGE_CERTIFICATE', 'FIRST_COMMUNION_CERTIFICATE');

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'PAYMENT_PENDING', 'PAYMENT_VERIFIED', 'PROCESSING', 'READY_FOR_PICKUP', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PROOF_SUBMITTED', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "ScheduleEventType" AS ENUM ('WEDDING', 'BAPTISM', 'CONFIRMATION', 'PRIVATE_MASS', 'MASS_INTENTION');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('PUSH', 'IN_APP', 'EMAIL');

-- CreateTable
CREATE TABLE "roles" (
    "role_id" SERIAL NOT NULL,
    "role_name" "RoleName" NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("role_id")
);

-- CreateTable
CREATE TABLE "parishes" (
    "parish_id" SERIAL NOT NULL,
    "parish_name" VARCHAR(150) NOT NULL,
    "type" "ParishType" NOT NULL,
    "address" TEXT,
    "municipality_city" VARCHAR(100) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "contact_number" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parishes_pkey" PRIMARY KEY ("parish_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "firebase_uid" VARCHAR(128) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "contact_number" VARCHAR(20),
    "role_id" INTEGER NOT NULL,
    "parish_id" INTEGER,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "document_requests" (
    "request_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parish_id" INTEGER NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "purpose" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "payment_proof_object_key" VARCHAR(255),
    "payment_qr_reference" VARCHAR(100),
    "processed_by" INTEGER,
    "remarks" TEXT,
    "date_requested" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_processed" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "requirement_id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "r2_object_key" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(50),
    "file_size" INTEGER,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("requirement_id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "schedule_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parish_id" INTEGER NOT NULL,
    "event_type" "ScheduleEventType" NOT NULL,
    "requested_date" DATE NOT NULL,
    "start_datetime" TIMESTAMP(3),
    "end_datetime" TIMESTAMP(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "conflict_flag" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "processed_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "date_sent" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "faq_knowledge_base" (
    "faq_id" SERIAL NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_knowledge_base_pkey" PRIMARY KEY ("faq_id")
);

-- CreateTable
CREATE TABLE "chatbot_logs" (
    "chatbot_log_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "session_id" VARCHAR(100),
    "question" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_logs_pkey" PRIMARY KEY ("chatbot_log_id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "log_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" VARCHAR(255) NOT NULL,
    "affected_table" VARCHAR(100),
    "affected_record_id" INTEGER,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_role_name_key" ON "roles"("role_name");

-- CreateIndex
CREATE UNIQUE INDEX "parishes_parish_name_key" ON "parishes"("parish_name");

-- CreateIndex
CREATE INDEX "parishes_type_idx" ON "parishes"("type");

-- CreateIndex
CREATE INDEX "parishes_is_active_idx" ON "parishes"("is_active");

-- CreateIndex
CREATE INDEX "parishes_municipality_city_idx" ON "parishes"("municipality_city");

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_parish_id_idx" ON "users"("parish_id");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "document_requests_user_id_idx" ON "document_requests"("user_id");

-- CreateIndex
CREATE INDEX "document_requests_parish_id_idx" ON "document_requests"("parish_id");

-- CreateIndex
CREATE INDEX "document_requests_processed_by_idx" ON "document_requests"("processed_by");

-- CreateIndex
CREATE INDEX "document_requests_document_type_idx" ON "document_requests"("document_type");

-- CreateIndex
CREATE INDEX "document_requests_status_idx" ON "document_requests"("status");

-- CreateIndex
CREATE INDEX "document_requests_payment_status_idx" ON "document_requests"("payment_status");

-- CreateIndex
CREATE INDEX "document_requests_date_requested_idx" ON "document_requests"("date_requested");

-- CreateIndex
CREATE INDEX "requirements_request_id_idx" ON "requirements"("request_id");

-- CreateIndex
CREATE INDEX "schedules_user_id_idx" ON "schedules"("user_id");

-- CreateIndex
CREATE INDEX "schedules_parish_id_idx" ON "schedules"("parish_id");

-- CreateIndex
CREATE INDEX "schedules_processed_by_idx" ON "schedules"("processed_by");

-- CreateIndex
CREATE INDEX "schedules_event_type_idx" ON "schedules"("event_type");

-- CreateIndex
CREATE INDEX "schedules_status_idx" ON "schedules"("status");

-- CreateIndex
CREATE INDEX "schedules_requested_date_idx" ON "schedules"("requested_date");

-- CreateIndex
CREATE INDEX "schedules_parish_id_requested_date_idx" ON "schedules"("parish_id", "requested_date");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_date_sent_idx" ON "notifications"("date_sent");

-- CreateIndex
CREATE INDEX "faq_knowledge_base_updated_by_idx" ON "faq_knowledge_base"("updated_by");

-- CreateIndex
CREATE INDEX "faq_knowledge_base_is_active_idx" ON "faq_knowledge_base"("is_active");

-- CreateIndex
CREATE INDEX "faq_knowledge_base_category_idx" ON "faq_knowledge_base"("category");

-- CreateIndex
CREATE INDEX "chatbot_logs_user_id_idx" ON "chatbot_logs"("user_id");

-- CreateIndex
CREATE INDEX "chatbot_logs_session_id_idx" ON "chatbot_logs"("session_id");

-- CreateIndex
CREATE INDEX "chatbot_logs_created_at_idx" ON "chatbot_logs"("created_at");

-- CreateIndex
CREATE INDEX "activity_logs_user_id_idx" ON "activity_logs"("user_id");

-- CreateIndex
CREATE INDEX "activity_logs_affected_table_idx" ON "activity_logs"("affected_table");

-- CreateIndex
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("role_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_parish_id_fkey" FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_parish_id_fkey" FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "document_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_parish_id_fkey" FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_knowledge_base" ADD CONSTRAINT "faq_knowledge_base_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chatbot_logs" ADD CONSTRAINT "chatbot_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
