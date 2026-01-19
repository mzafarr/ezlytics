import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { site } from "./site";

export const payment = pgTable(
  "payment",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => site.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id"),
    eventId: text("event_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    provider: text("provider").notNull(),
    transactionId: text("transaction_id").notNull(),
    customerId: text("customer_id"),
    email: text("email"),
    name: text("name"),
    renewal: boolean("renewal").default(false).notNull(),
    refunded: boolean("refunded").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("payment_siteId_idx").on(table.siteId),
    index("payment_visitorId_idx").on(table.visitorId),
    index("payment_eventId_idx").on(table.eventId),
    index("payment_transactionId_idx").on(table.transactionId),
  ],
);

export const paymentRelations = relations(payment, ({ one }) => ({
  site: one(site, {
    fields: [payment.siteId],
    references: [site.id],
  }),
}));
