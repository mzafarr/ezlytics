import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    INGEST_MAX_PAYLOAD_BYTES: z.coerce.number().int().min(1024).optional(),
    RAW_EVENT_RETENTION_DAYS: z.coerce.number().int().min(1).optional(),
    ROLLUP_DAILY_RETENTION_DAYS: z.coerce.number().int().min(1).optional(),
    ROLLUP_HOURLY_RETENTION_DAYS: z.coerce.number().int().min(1).optional(),
    RETENTION_CLEANUP_INTERVAL_MINUTES: z.coerce.number().int().min(1).optional(),
    RETENTION_CRON_SECRET: z.string().min(1).optional(),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).optional(),
    RATE_LIMIT_MAX_REQUESTS_PER_IP: z.coerce.number().int().min(1).optional(),
    RATE_LIMIT_MAX_REQUESTS_PER_SITE: z.coerce.number().int().min(1).optional(),
    GEOIP_MMDB_PATH: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    LEMONSQUEEZY_WEBHOOK_SECRET: z.string().min(1).optional(),
    REVENUE_PROVIDER_KEY_SECRET: z.string().min(32),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
