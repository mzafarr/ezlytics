import { relations } from "drizzle-orm";
import { date, index, integer, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { site } from "./site";

export const rollupDimensionDaily = pgTable(
  "rollup_dimension_daily",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    dimension: text("dimension").notNull(),
    dimensionValue: text("dimension_value").notNull(),
    visitors: integer("visitors").default(0).notNull(),
    sessions: integer("sessions").default(0).notNull(),
    pageviews: integer("pageviews").default(0).notNull(),
    goals: integer("goals").default(0).notNull(),
    revenue: integer("revenue").default(0).notNull(),
    revenueByType: jsonb("revenue_by_type").notNull().default({ new: 0, renewal: 0, refund: 0 }),
  },
  (table) => [
    index("rollup_dimension_daily_siteId_idx").on(table.siteId),
    index("rollup_dimension_daily_date_idx").on(table.date),
    index("rollup_dimension_daily_dimension_idx").on(table.dimension),
    index("rollup_dimension_daily_value_idx").on(table.dimensionValue),
    uniqueIndex("rollup_dimension_daily_bucket_idx").on(
      table.siteId,
      table.date,
      table.dimension,
      table.dimensionValue,
    ),
  ],
);

export const rollupDimensionDailyRelations = relations(rollupDimensionDaily, ({ one }) => ({
  site: one(site, {
    fields: [rollupDimensionDaily.siteId],
    references: [site.id],
  }),
}));
