import { relations } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { site } from "./site";

export const analyticsSession = pgTable(
  "analytics_session",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    visitorId: text("visitor_id").notNull(),
    firstTimestamp: bigint("first_timestamp", { mode: "number" }).notNull(),
    lastTimestamp: bigint("last_timestamp", { mode: "number" }).notNull(),
    firstNormalized: jsonb("first_normalized"),
    pageviews: integer("pageviews").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("analytics_session_siteId_idx").on(table.siteId),
    index("analytics_session_lastTimestamp_idx").on(table.lastTimestamp),
    index("analytics_session_sessionId_idx").on(table.sessionId),
    uniqueIndex("analytics_session_unique_idx").on(table.siteId, table.sessionId, table.visitorId),
  ],
);

export const analyticsSessionRelations = relations(analyticsSession, ({ one }) => ({
  site: one(site, {
    fields: [analyticsSession.siteId],
    references: [site.id],
  }),
}));
