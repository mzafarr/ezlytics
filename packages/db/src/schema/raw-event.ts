import { relations } from "drizzle-orm";
import {
  bigint,
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { site } from "./site";

export const rawEvent = pgTable(
  "raw_event",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    eventId: text("event_id"),
    type: text("type").notNull(),
    name: text("name"),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id"),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    metadata: jsonb("metadata"),
    normalized: jsonb("normalized"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("raw_event_siteId_idx").on(table.siteId),
    index("raw_event_site_timestamp_idx").on(table.siteId, table.timestamp),
    index("raw_event_created_at_idx").on(table.createdAt),
    index("raw_event_visitorId_idx").on(table.visitorId),
    index("raw_event_sessionId_idx").on(table.sessionId),
    index("raw_event_type_idx").on(table.type),
    index("raw_event_eventId_idx").on(table.eventId),
    uniqueIndex("raw_event_site_eventId_idx").on(table.siteId, table.eventId),
  ],
);

export const rawEventRelations = relations(rawEvent, ({ one }) => ({
  site: one(site, {
    fields: [rawEvent.siteId],
    references: [site.id],
  }),
}));
