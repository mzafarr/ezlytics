CREATE TYPE "payment_event_type" AS ENUM ('new', 'renewal', 'refund');

ALTER TABLE "payment" ADD COLUMN "event_type" "payment_event_type" NOT NULL DEFAULT 'new';

ALTER TABLE "rollup_daily" ADD COLUMN "revenue_by_type" jsonb NOT NULL DEFAULT '{"new":0,"renewal":0,"refund":0}';
ALTER TABLE "rollup_hourly" ADD COLUMN "revenue_by_type" jsonb NOT NULL DEFAULT '{"new":0,"renewal":0,"refund":0}';
ALTER TABLE "rollup_dimension_daily" ADD COLUMN "revenue_by_type" jsonb NOT NULL DEFAULT '{"new":0,"renewal":0,"refund":0}';
ALTER TABLE "rollup_dimension_hourly" ADD COLUMN "revenue_by_type" jsonb NOT NULL DEFAULT '{"new":0,"renewal":0,"refund":0}';
