ALTER TABLE "raw_event" ADD COLUMN IF NOT EXISTS "timestamp" bigint;
ALTER TABLE "raw_event" ADD COLUMN IF NOT EXISTS "session_id" text;

UPDATE "raw_event"
SET "timestamp" = (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint
WHERE "timestamp" IS NULL;

ALTER TABLE "raw_event" ALTER COLUMN "timestamp" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "raw_event_site_timestamp_idx" ON "raw_event" ("site_id", "timestamp");
CREATE INDEX IF NOT EXISTS "raw_event_sessionId_idx" ON "raw_event" ("session_id");
