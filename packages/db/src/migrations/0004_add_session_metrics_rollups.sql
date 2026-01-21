ALTER TABLE "rollup_daily" ADD COLUMN "bounced_sessions" integer NOT NULL DEFAULT 0;
ALTER TABLE "rollup_daily" ADD COLUMN "avg_session_duration" integer NOT NULL DEFAULT 0;
ALTER TABLE "rollup_hourly" ADD COLUMN "bounced_sessions" integer NOT NULL DEFAULT 0;
ALTER TABLE "rollup_hourly" ADD COLUMN "avg_session_duration" integer NOT NULL DEFAULT 0;
