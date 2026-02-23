/**
 * Ingest schema definitions and constants.
 *
 * This module contains all Zod schemas, validation constants, and type limits
 * used by the ingest API endpoint.
 */

import { z } from "zod";

// Size limits
export const DEFAULT_MAX_PAYLOAD_BYTES = 32 * 1024;
export const MAX_STRING_LENGTH = 512;
export const MAX_METADATA_KEYS = 12;
export const MAX_METADATA_KEY_LENGTH = 64;
export const MAX_METADATA_VALUE_LENGTH = 255;
export const MAX_FUTURE_EVENT_MS = 24 * 60 * 60 * 1000;
export const MAX_CLIENT_TS_SKEW_MS = 5 * 60 * 1000;
export const MAX_BACKFILL_MS = 24 * 60 * 60 * 1000;

export const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "v",
  "type",
  "name",
  "websiteId",
  "domain",
  "path",
  "referrer",
  "ts",
  "timestamp",
  "visitorId",
  "session_id",
  "sessionId",
  "eventId",
  "bot",
  "metadata",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "source",
  "via",
  "ref",
]);

export const SUPPORTED_TYPES = new Set([
  "pageview",
  "heartbeat",
  "goal",
  "identify",
  "payment",
]);

// Base schemas
export const idSchema = z.string().trim().min(1).max(128);
export const nameSchema = z.string().trim().min(1).max(64);
export const domainSchema = z.string().trim().min(1).max(255);
export const pathSchema = z.string().trim().min(1).max(1024);
export const timestampSchema = z.coerce.date();
export const tsSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return Number.NaN;
    }
    return Number(trimmed);
  }
  return value;
}, z.number().int());
export const trackingValueSchema = z.string().trim().min(1).max(255);

const metadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const metadataSchema = z
  .record(z.string(), metadataValueSchema)
  .superRefine((value, ctx) => {
    const entries = Object.entries(value);
    if (entries.length > MAX_METADATA_KEYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metadata cannot exceed ${MAX_METADATA_KEYS} entries`,
      });
    }

    for (const [rawKey, rawValue] of entries) {
      const key = rawKey.trim().toLowerCase();
      if (!key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "metadata keys cannot be empty",
        });
        continue;
      }
      if (key.length > MAX_METADATA_KEY_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `metadata key "${rawKey}" exceeds ${MAX_METADATA_KEY_LENGTH} characters`,
        });
      }
      if (!/^[a-z0-9_-]+$/.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `metadata key "${rawKey}" contains invalid characters`,
        });
      }

      if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `metadata value for "${rawKey}" cannot be empty`,
          });
        } else if (trimmed.length > MAX_METADATA_VALUE_LENGTH) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `metadata value for "${rawKey}" exceeds ${MAX_METADATA_VALUE_LENGTH} characters`,
          });
        }
      }
    }
  })
  .transform((value) => {
    const normalized: Record<string, string | number | boolean | null> = {};
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const key = rawKey.trim().toLowerCase();
      if (!key || key.length > MAX_METADATA_KEY_LENGTH) {
        continue;
      }
      if (!/^[a-z0-9_-]+$/.test(key)) {
        continue;
      }
      if (typeof rawValue === "string") {
        const sanitized = rawValue
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (!sanitized) {
          continue;
        }
        normalized[key] =
          sanitized.length > MAX_METADATA_VALUE_LENGTH
            ? sanitized.slice(0, MAX_METADATA_VALUE_LENGTH)
            : sanitized;
      } else {
        normalized[key] = rawValue;
      }
    }
    return normalized;
  })
  .optional();

export const payloadSchema = z
  .object({
    v: z.coerce.number().int().optional(),
    type: z.string().trim().min(1).max(32),
    name: nameSchema.optional(),
    websiteId: idSchema,
    domain: domainSchema,
    path: pathSchema,
    referrer: z.string().trim().max(1024).optional(),
    ts: tsSchema.optional(),
    timestamp: timestampSchema.optional(),
    visitorId: idSchema,
    session_id: idSchema.optional(),
    sessionId: idSchema.optional(),
    eventId: idSchema.optional(),
    bot: z.boolean().optional(),
    metadata: metadataSchema,
    utm_source: trackingValueSchema.optional(),
    utm_medium: trackingValueSchema.optional(),
    utm_campaign: trackingValueSchema.optional(),
    utm_term: trackingValueSchema.optional(),
    utm_content: trackingValueSchema.optional(),
    source: trackingValueSchema.optional(),
    via: trackingValueSchema.optional(),
    ref: trackingValueSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!SUPPORTED_TYPES.has(value.type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unsupported event type "${value.type}"`,
        path: ["type"],
      });
    }

    if (value.type === "goal" && !value.name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Goal events require a name",
        path: ["name"],
      });
    }

    if (value.type === "identify" && !value.metadata?.user_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Identify events require metadata.user_id",
        path: ["metadata", "user_id"],
      });
    }

    if (value.ts !== undefined && value.ts > Date.now() + MAX_FUTURE_EVENT_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ts cannot be more than 24h in the future",
        path: ["ts"],
      });
    }
  });

export const identifyMetadataSchema = metadataSchema.superRefine(
  (value, ctx) => {
    if (!value || typeof value !== "object") {
      return;
    }
    const userId = value.user_id;
    if (typeof userId !== "string" || !userId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Identify events require metadata.user_id",
        path: ["user_id"],
      });
    }
  },
);

export const isUniqueViolation = (error: unknown) =>
  Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "23505",
  );

export const ALLOWLIST_DOCS = {
  maxPayloadBytes: DEFAULT_MAX_PAYLOAD_BYTES,
  allowedKeys: Array.from(ALLOWED_TOP_LEVEL_KEYS),
  maxStringLength: MAX_STRING_LENGTH,
  maxMetadataKeys: MAX_METADATA_KEYS,
  maxMetadataKeyLength: MAX_METADATA_KEY_LENGTH,
  maxMetadataValueLength: MAX_METADATA_VALUE_LENGTH,
};

export type PayloadType = z.infer<typeof payloadSchema>;
