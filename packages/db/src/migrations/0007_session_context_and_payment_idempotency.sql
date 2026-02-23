-- Add first-pageview normalized context for session-dimension attribution
ALTER TABLE "analytics_session"
ADD COLUMN IF NOT EXISTS "first_normalized" jsonb;

-- Enforce idempotency for custom payments retries by site + transaction
-- Keep the most recent row when duplicates exist.
DELETE FROM "payment" p
USING "payment" newer
WHERE p."site_id" = newer."site_id"
  AND p."transaction_id" = newer."transaction_id"
  AND p."id" < newer."id";

CREATE UNIQUE INDEX IF NOT EXISTS "payment_site_transaction_unique_idx"
ON "payment" ("site_id", "transaction_id");
