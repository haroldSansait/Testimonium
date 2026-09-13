-- ==============================================================================
-- CENTRALIZED CALOY CONTROL CENTER MIGRATION
-- Adds caloy_runtime_config, system_leases, ai_usage_events, and chatbot_logs telemetry extensions
-- ==============================================================================

-- Step 1: Create caloy_runtime_config table (Empty by design, no seed row)
CREATE TABLE "caloy_runtime_config" (
    "config_id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "generation_provider" VARCHAR(50) NOT NULL DEFAULT 'gemini',
    "generation_model" VARCHAR(100) NOT NULL DEFAULT 'gemini-3.5-flash-lite',
    "ai_ten_minute_max" INTEGER NOT NULL DEFAULT 20,
    "ai_daily_max" INTEGER NOT NULL DEFAULT 50,
    "chatbot_request_deadline_ms" INTEGER NOT NULL DEFAULT 25000,
    "automatic_retention_enabled" BOOLEAN NOT NULL DEFAULT false,
    "log_retention_days" INTEGER NOT NULL DEFAULT 90,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "caloy_runtime_config_pkey" PRIMARY KEY ("config_id"),
    CONSTRAINT "caloy_runtime_config_singleton_check" CHECK ("config_id" = 1),
    CONSTRAINT "caloy_runtime_config_limits_check" CHECK (
        "ai_ten_minute_max" >= 5 AND
        "ai_daily_max" >= "ai_ten_minute_max" AND
        "chatbot_request_deadline_ms" >= 5000 AND
        "chatbot_request_deadline_ms" <= 28000 AND
        "log_retention_days" >= 14 AND
        "log_retention_days" <= 365 AND
        "version" >= 1
    )
);

ALTER TABLE "caloy_runtime_config" ADD CONSTRAINT "caloy_runtime_config_updated_by_id_fkey"
FOREIGN KEY ("updated_by_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 2: Create system_leases table for distributed cluster task coordination
CREATE TABLE "system_leases" (
    "lease_key" VARCHAR(100) NOT NULL,
    "owner_token" VARCHAR(100) NOT NULL,
    "lease_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_leases_pkey" PRIMARY KEY ("lease_key")
);

-- Step 3: Create ai_usage_events table for provider-level attempt telemetry
CREATE TABLE "ai_usage_events" (
    "event_id" SERIAL NOT NULL,
    "trace_id" VARCHAR(100),
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "purpose" VARCHAR(50) NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL,
    "status_code" INTEGER,
    "error_category" VARCHAR(100),
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "total_tokens" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("event_id"),
    CONSTRAINT "ai_usage_events_operation_check" CHECK ("operation" IN ('GENERATE_CONTENT', 'EMBED_CONTENT')),
    CONSTRAINT "ai_usage_events_purpose_check" CHECK ("purpose" IN ('SEMANTIC_ROUTING', 'RAG_GENERATION', 'RESPONSE_COMPOSER', 'QUERY_EMBEDDING', 'DOCUMENT_EMBEDDING')),
    CONSTRAINT "ai_usage_events_attempt_check" CHECK ("attempt_number" >= 1 AND "latency_ms" >= 0),
    CONSTRAINT "ai_usage_events_tokens_check" CHECK (
        ("input_tokens" IS NULL OR "input_tokens" >= 0) AND
        ("output_tokens" IS NULL OR "output_tokens" >= 0) AND
        ("total_tokens" IS NULL OR "total_tokens" >= 0)
    )
);

CREATE INDEX "ai_usage_events_created_at_idx" ON "ai_usage_events"("created_at");
CREATE INDEX "ai_usage_events_operation_created_at_idx" ON "ai_usage_events"("operation", "created_at");
CREATE INDEX "ai_usage_events_purpose_created_at_idx" ON "ai_usage_events"("purpose", "created_at");
CREATE INDEX "ai_usage_events_model_created_at_idx" ON "ai_usage_events"("model", "created_at");
CREATE INDEX "ai_usage_events_success_created_at_idx" ON "ai_usage_events"("success", "created_at");
CREATE INDEX "ai_usage_events_trace_id_idx" ON "ai_usage_events"("trace_id");

-- Step 4: Extend chatbot_logs with trace_id and response_type
ALTER TABLE "chatbot_logs" ADD COLUMN "trace_id" VARCHAR(100);
ALTER TABLE "chatbot_logs" ADD COLUMN "response_type" VARCHAR(50);

CREATE INDEX "chatbot_logs_response_type_created_at_idx" ON "chatbot_logs"("response_type", "created_at");
CREATE INDEX "chatbot_logs_generation_model_created_at_idx" ON "chatbot_logs"("generation_model", "created_at");
CREATE INDEX "chatbot_logs_error_category_created_at_idx" ON "chatbot_logs"("error_category", "created_at");
CREATE INDEX "chatbot_logs_selected_parish_id_created_at_idx" ON "chatbot_logs"("selected_parish_id", "created_at");
CREATE INDEX "chatbot_logs_fallback_created_at_idx" ON "chatbot_logs"("fallback", "created_at");
CREATE INDEX "chatbot_logs_trace_id_idx" ON "chatbot_logs"("trace_id");
