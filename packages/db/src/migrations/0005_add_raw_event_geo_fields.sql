ALTER TABLE "raw_event" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "raw_event" ADD COLUMN IF NOT EXISTS "region" text;
ALTER TABLE "raw_event" ADD COLUMN IF NOT EXISTS "city" text;
ALTER TABLE "raw_event" ADD COLUMN IF NOT EXISTS "latitude" real;
ALTER TABLE "raw_event" ADD COLUMN IF NOT EXISTS "longitude" real;

CREATE INDEX IF NOT EXISTS "raw_event_country_idx" ON "raw_event" ("country");
CREATE INDEX IF NOT EXISTS "raw_event_region_idx" ON "raw_event" ("region");
CREATE INDEX IF NOT EXISTS "raw_event_city_idx" ON "raw_event" ("city");
CREATE INDEX IF NOT EXISTS "raw_event_latitude_idx" ON "raw_event" ("latitude");
CREATE INDEX IF NOT EXISTS "raw_event_longitude_idx" ON "raw_event" ("longitude");
