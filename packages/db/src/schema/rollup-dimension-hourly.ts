import { relations } from "drizzle-orm";
import { date, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { site } from "./site";

export const rollupDimensionHourly = pgTable(
  "rollup_dimension_hourly",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    hour: integer("hour").notNull(),
    dimension: text("dimension").notNull(),
    dimensionValue: text("dimension_value").notNull(),
    visitors: integer("visitors").default(0).notNull(),
    sessions: integer("sessions").default(0).notNull(),
    pageviews: integer("pageviews").default(0).notNull(),
    goals: integer("goals").default(0).notNull(),
    revenue: integer("revenue").default(0).notNull(),
  },
  (table) => [
    index("rollup_dimension_hourly_siteId_idx").on(table.siteId),
    index("rollup_dimension_hourly_date_idx").on(table.date),
    index("rollup_dimension_hourly_hour_idx").on(table.hour),
    index("rollup_dimension_hourly_dimension_idx").on(table.dimension),
    index("rollup_dimension_hourly_value_idx").on(table.dimensionValue),
    uniqueIndex("rollup_dimension_hourly_bucket_idx").on(
      table.siteId,
      table.date,
      table.hour,
      table.dimension,
      table.dimensionValue,
    ),
  ],
);

export const rollupDimensionHourlyRelations = relations(rollupDimensionHourly, ({ one }) => ({
  site: one(site, {
    fields: [rollupDimensionHourly.siteId],
    references: [site.id],
  }),
}));
