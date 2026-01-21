import { relations } from "drizzle-orm";
import { date, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { site } from "./site";

export const rollupHourly = pgTable(
  "rollup_hourly",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    hour: integer("hour").notNull(),
    visitors: integer("visitors").default(0).notNull(),
    sessions: integer("sessions").default(0).notNull(),
    bouncedSessions: integer("bounced_sessions").default(0).notNull(),
    avgSessionDurationMs: integer("avg_session_duration").default(0).notNull(),
    pageviews: integer("pageviews").default(0).notNull(),
    goals: integer("goals").default(0).notNull(),
    revenue: integer("revenue").default(0).notNull(),
    revenueByType: jsonb("revenue_by_type").notNull().default({ new: 0, renewal: 0, refund: 0 }),
  },
  (table) => [
    index("rollup_hourly_siteId_idx").on(table.siteId),
    index("rollup_hourly_date_idx").on(table.date),
    index("rollup_hourly_hour_idx").on(table.hour),
    uniqueIndex("rollup_hourly_bucket_idx").on(table.siteId, table.date, table.hour),
  ],
);

export const rollupHourlyRelations = relations(rollupHourly, ({ one }) => ({
  site: one(site, {
    fields: [rollupHourly.siteId],
    references: [site.id],
  }),
}));
