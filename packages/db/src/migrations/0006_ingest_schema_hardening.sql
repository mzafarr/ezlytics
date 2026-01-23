-- Align schema constraints with ingest normalization limits

-- Clamp existing data to avoid constraint failures
UPDATE "raw_event"
SET
  type = LEFT(type, 32),
  name = LEFT(name, 64),
  visitor_id = LEFT(visitor_id, 128),
  session_id = LEFT(session_id, 128),
  event_id = LEFT(event_id, 128),
  country = LEFT(country, 2),
  region = LEFT(region, 512),
  city = LEFT(city, 512);

UPDATE "analytics_session"
SET
  session_id = LEFT(session_id, 128),
  visitor_id = LEFT(visitor_id, 128);

UPDATE "visitor_daily"
SET visitor_id = LEFT(visitor_id, 128);

UPDATE "rollup_dimension_hourly"
SET
  dimension = LEFT(dimension, 32),
  dimension_value = LEFT(dimension_value, 128);

UPDATE "rollup_dimension_daily"
SET
  dimension = LEFT(dimension, 32),
  dimension_value = LEFT(dimension_value, 128);

-- Add length checks
ALTER TABLE "raw_event" ADD CONSTRAINT "raw_event_type_len" CHECK (char_length(type) <= 32);
ALTER TABLE "raw_event" ADD CONSTRAINT "raw_event_name_len" CHECK (name IS NULL OR char_length(name) <= 64);
ALTER TABLE "raw_event" ADD CONSTRAINT "raw_event_visitor_id_len" CHECK (char_length(visitor_id) <= 128);
ALTER TABLE "raw_event" ADD CONSTRAINT "raw_event_session_id_len" CHECK (session_id IS NULL OR char_length(session_id) <= 128);
ALTER TABLE "raw_event" ADD CONSTRAINT "raw_event_event_id_len" CHECK (event_id IS NULL OR char_length(event_id) <= 128);
ALTER TABLE "raw_event" ADD CONSTRAINT "raw_event_country_len" CHECK (country IS NULL OR char_length(country) <= 2);
ALTER TABLE "raw_event" ADD CONSTRAINT "raw_event_region_len" CHECK (region IS NULL OR char_length(region) <= 512);
ALTER TABLE "raw_event" ADD CONSTRAINT "raw_event_city_len" CHECK (city IS NULL OR char_length(city) <= 512);

ALTER TABLE "analytics_session" ADD CONSTRAINT "analytics_session_session_id_len" CHECK (char_length(session_id) <= 128);
ALTER TABLE "analytics_session" ADD CONSTRAINT "analytics_session_visitor_id_len" CHECK (char_length(visitor_id) <= 128);

ALTER TABLE "visitor_daily" ADD CONSTRAINT "visitor_daily_visitor_id_len" CHECK (char_length(visitor_id) <= 128);

ALTER TABLE "rollup_dimension_hourly" ADD CONSTRAINT "rollup_dimension_hourly_dimension_len" CHECK (char_length(dimension) <= 32);
ALTER TABLE "rollup_dimension_hourly" ADD CONSTRAINT "rollup_dimension_hourly_value_len" CHECK (char_length(dimension_value) <= 128);

ALTER TABLE "rollup_dimension_daily" ADD CONSTRAINT "rollup_dimension_daily_dimension_len" CHECK (char_length(dimension) <= 32);
ALTER TABLE "rollup_dimension_daily" ADD CONSTRAINT "rollup_dimension_daily_value_len" CHECK (char_length(dimension_value) <= 128);

-- Add index to support retention cleanup
CREATE INDEX IF NOT EXISTS "raw_event_created_at_idx" ON "raw_event" ("created_at");
