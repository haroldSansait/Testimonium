-- AlterTable
ALTER TABLE "schedules"
ADD COLUMN "priest_verbal_approval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "priest_verbal_approval_by" INTEGER,
ADD COLUMN "priest_verbal_approval_at" TIMESTAMP(3),
ADD COLUMN "priest_change_status" VARCHAR(50),
ADD COLUMN "priest_change_requested_priest_id" INTEGER,
ADD COLUMN "priest_change_note" TEXT,
ADD COLUMN "priest_change_requested_at" TIMESTAMP(3),
ADD COLUMN "priest_change_resolved_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "schedule_history"
ADD COLUMN "priest_verbal_approval" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "schedules_priest_verbal_approval_by_idx" ON "schedules"("priest_verbal_approval_by");

-- CreateIndex
CREATE INDEX "schedules_priest_change_requested_priest_id_idx" ON "schedules"("priest_change_requested_priest_id");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_priest_verbal_approval_by_fkey" FOREIGN KEY ("priest_verbal_approval_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_priest_change_requested_priest_id_fkey" FOREIGN KEY ("priest_change_requested_priest_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

