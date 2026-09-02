-- CreateEnum
CREATE TYPE "ParishCouncilType" AS ENUM ('PASTORAL', 'FINANCE');

-- CreateTable
CREATE TABLE "parish_council_configurations" (
    "config_id" SERIAL NOT NULL,
    "parish_id" INTEGER NOT NULL,
    "finance_council_enabled" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parish_council_configurations_pkey" PRIMARY KEY ("config_id")
);

-- CreateTable
CREATE TABLE "parish_council_members" (
    "member_id" SERIAL NOT NULL,
    "council_configuration_id" INTEGER NOT NULL,
    "council_type" "ParishCouncilType" NOT NULL,
    "position_title" VARCHAR(200) NOT NULL,
    "member_name" VARCHAR(200) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parish_council_members_pkey" PRIMARY KEY ("member_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parish_council_configurations_parish_id_key" ON "parish_council_configurations"("parish_id");

-- CreateIndex
CREATE INDEX "parish_council_members_council_configuration_id_council_type_idx" ON "parish_council_members"("council_configuration_id", "council_type");

-- CreateIndex
CREATE INDEX "parish_council_members_council_configuration_id_sort_order_idx" ON "parish_council_members"("council_configuration_id", "sort_order");

-- AddForeignKey
ALTER TABLE "parish_council_configurations" ADD CONSTRAINT "parish_council_configurations_parish_id_fkey" FOREIGN KEY ("parish_id") REFERENCES "parishes"("parish_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parish_council_members" ADD CONSTRAINT "parish_council_members_council_configuration_id_fkey" FOREIGN KEY ("council_configuration_id") REFERENCES "parish_council_configurations"("config_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing parishes (both active and inactive/archived) with default council configuration
INSERT INTO "parish_council_configurations" ("parish_id", "finance_council_enabled", "version", "created_at", "updated_at")
SELECT "parish_id", false, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "parishes";
