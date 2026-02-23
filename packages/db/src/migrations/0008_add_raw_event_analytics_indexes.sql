CREATE INDEX IF NOT EXISTS "raw_event_site_type_timestamp_idx"
ON "raw_event" ("site_id", "type", "timestamp");

CREATE INDEX IF NOT EXISTS "raw_event_site_type_timestamp_visitor_idx"
ON "raw_event" ("site_id", "type", "timestamp", "visitor_id");
