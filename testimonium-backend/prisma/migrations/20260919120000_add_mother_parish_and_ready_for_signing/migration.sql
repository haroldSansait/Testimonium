-- AlterEnum
ALTER TYPE "DocumentRequestStatus" ADD VALUE 'READY_FOR_SIGNING';

-- AlterTable
ALTER TABLE "parishes" ADD COLUMN "mother_parish_id" INTEGER;

-- CreateIndex
CREATE INDEX "parishes_mother_parish_id_idx" ON "parishes"("mother_parish_id");

-- AddForeignKey
ALTER TABLE "parishes" ADD CONSTRAINT "parishes_mother_parish_id_fkey" FOREIGN KEY ("mother_parish_id") REFERENCES "parishes"("parish_id") ON DELETE SET NULL ON UPDATE CASCADE;
