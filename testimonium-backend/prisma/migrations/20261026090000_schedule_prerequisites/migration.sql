-- CreateTable
CREATE TABLE "schedule_attachments" (
    "attachment_id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "requirement_id" VARCHAR(50) NOT NULL,
    "requirement_label" VARCHAR(150) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "r2_object_key" VARCHAR(255) NOT NULL,
    "file_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_attachments_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "schedule_attachments_r2_object_key_key" ON "schedule_attachments"("r2_object_key");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_attachments_schedule_id_requirement_id_key" ON "schedule_attachments"("schedule_id", "requirement_id");

-- AddForeignKey
ALTER TABLE "schedule_attachments" ADD CONSTRAINT "schedule_attachments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("schedule_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Private evidence is available through the authenticated Express API only.
ALTER TABLE "schedule_attachments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "schedule_attachments" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE "schedule_attachments_attachment_id_seq" FROM PUBLIC, anon, authenticated;
