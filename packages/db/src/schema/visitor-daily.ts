import { relations } from "drizzle-orm";
import { date, index, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { site } from "./site";

export const visitorDaily = pgTable(
  "visitor_daily",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    visitorId: text("visitor_id").notNull(),
  },
  (table) => [
    index("visitor_daily_siteId_idx").on(table.siteId),
    index("visitor_daily_date_idx").on(table.date),
    uniqueIndex("visitor_daily_unique_idx").on(table.siteId, table.date, table.visitorId),
  ],
);

export const visitorDailyRelations = relations(visitorDaily, ({ one }) => ({
  site: one(site, {
    fields: [visitorDaily.siteId],
    references: [site.id],
  }),
}));
