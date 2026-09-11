-- CreateTable
CREATE TABLE "idempotency_keys" (
    "idempotency_id" SERIAL NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "user_id" INTEGER NOT NULL,
    "resource_type" VARCHAR(50) NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("idempotency_id")
);

-- CreateIndex
CREATE INDEX "idempotency_keys_user_id_key_idx" ON "idempotency_keys"("user_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_user_id_key_resource_type_key" ON "idempotency_keys"("user_id", "key", "resource_type");

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
