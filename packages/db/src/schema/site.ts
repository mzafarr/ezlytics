import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const site = pgTable(
  "site",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    websiteId: text("website_id").notNull(),
    apiKey: text("api_key").notNull(),
    revenueProvider: text("revenue_provider").notNull().default("none"),
    revenueProviderKeyEncrypted: text("revenue_provider_key_encrypted"),
    revenueProviderKeyUpdatedAt: timestamp("revenue_provider_key_updated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("site_userId_idx").on(table.userId),
    uniqueIndex("site_websiteId_idx").on(table.websiteId),
    uniqueIndex("site_apiKey_idx").on(table.apiKey),
  ],
);

export const siteRelations = relations(site, ({ one }) => ({
  owner: one(user, {
    fields: [site.userId],
    references: [user.id],
  }),
}));
