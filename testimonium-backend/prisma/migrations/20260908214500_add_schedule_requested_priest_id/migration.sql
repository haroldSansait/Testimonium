-- AlterTable
ALTER TABLE "schedules" ADD COLUMN "requested_priest_id" INTEGER;

-- CreateIndex
CREATE INDEX "schedules_requested_priest_id_idx" ON "schedules"("requested_priest_id");

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_requested_priest_id_fkey" FOREIGN KEY ("requested_priest_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
