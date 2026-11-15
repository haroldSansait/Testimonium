-- CreateTable
CREATE TABLE "schedule_drafts" (
    "draft_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "parish_id" INTEGER NOT NULL,
    "requested_priest_id" INTEGER,
    "event_type" "ScheduleEventType" NOT NULL,
    "display_title" VARCHAR(150),
    "preferred_date" DATE,
    "requested_date" DATE,
    "time_slot" VARCHAR(20),
    "location" VARCHAR(150),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_drafts_pkey" PRIMARY KEY ("draft_id")
);

-- CreateTable
CREATE TABLE "schedule_draft_attachments" (
    "draft_attachment_id" SERIAL NOT NULL,
    "draft_id" INTEGER NOT NULL,
    "requirement_id" VARCHAR(50) NOT NULL,
    "requirement_label" VARCHAR(150) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "r2_object_key" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_draft_attachments_pkey" PRIMARY KEY ("draft_attachment_id")
);

-- CreateIndex
CREATE INDEX "schedule_drafts_user_id_updated_at_idx" ON "schedule_drafts"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "schedule_drafts_parish_id_idx" ON "schedule_drafts"("parish_id");

-- CreateIndex
CREATE INDEX "schedule_drafts_requested_priest_id_idx" ON "schedule_drafts"("requested_priest_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_draft_attachments_r2_object_key_key" ON "schedule_draft_attachments"("r2_object_key");

-- CreateIndex
CREATE INDEX "schedule_draft_attachments_draft_id_idx" ON "schedule_draft_attachments"("draft_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_draft_attachments_draft_id_requirement_id_key" ON "schedule_draft_attachments"("draft_id", "requirement_id");

-- AddForeignKey
ALTER TABLE "schedule_drafts" ADD CONSTRAINT "schedule_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_drafts" ADD CONSTRAINT "schedule_drafts_parish_id_fkey" FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_drafts" ADD CONSTRAINT "schedule_drafts_requested_priest_id_fkey" FOREIGN KEY ("requested_priest_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_draft_attachments" ADD CONSTRAINT "schedule_draft_attachments_draft_id_fkey" FOREIGN KEY ("draft_id") REFERENCES "schedule_drafts"("draft_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Private draft data is available through the authenticated Express API only.
ALTER TABLE "schedule_drafts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "schedule_drafts" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE "schedule_drafts_draft_id_seq" FROM PUBLIC, anon, authenticated;

ALTER TABLE "schedule_draft_attachments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "schedule_draft_attachments" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE "schedule_draft_attachments_draft_attachment_id_seq" FROM PUBLIC, anon, authenticated;

