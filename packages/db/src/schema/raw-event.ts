import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { site } from "./site";

export const rawEvent = pgTable(
  "raw_event",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name"),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("raw_event_siteId_idx").on(table.siteId),
    index("raw_event_visitorId_idx").on(table.visitorId),
    index("raw_event_type_idx").on(table.type),
  ],
);

export const rawEventRelations = relations(rawEvent, ({ one }) => ({
  site: one(site, {
    fields: [rawEvent.siteId],
    references: [site.id],
  }),
}));
