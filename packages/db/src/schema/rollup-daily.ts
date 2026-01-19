import { relations } from "drizzle-orm";
import { date, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { site } from "./site";

export const rollupDaily = pgTable(
  "rollup_daily",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    visitors: integer("visitors").default(0).notNull(),
    sessions: integer("sessions").default(0).notNull(),
    pageviews: integer("pageviews").default(0).notNull(),
    goals: integer("goals").default(0).notNull(),
    revenue: integer("revenue").default(0).notNull(),
  },
  (table) => [
    index("rollup_daily_siteId_idx").on(table.siteId),
    index("rollup_daily_date_idx").on(table.date),
    uniqueIndex("rollup_daily_bucket_idx").on(table.siteId, table.date),
  ],
);

export const rollupDailyRelations = relations(rollupDaily, ({ one }) => ({
  site: one(site, {
    fields: [rollupDaily.siteId],
    references: [site.id],
  }),
}));
