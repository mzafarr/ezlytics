import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { buildApiKeyHeader, verifyApiKey } from "@my-better-t-app/api/api-key";
import { and, db, eq, rawEvent, sql } from "@my-better-t-app/db";
import { env } from "@my-better-t-app/env/server";
import { sanitizeMetadataRecord } from "@/lib/metadata-sanitize";
import { runRetentionCleanup } from "@/lib/retention";
import {
  extractDimensionRollups,
  metricsForEvent,
  metricsForSession,
  upsertDimensionRollups,
  upsertRollups,
} from "@/lib/rollups";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const DEFAULT_MAX_PAYLOAD_BYTES = 32 * 1024;
const MAX_PAYLOAD_BYTES = env.INGEST_MAX_PAYLOAD_BYTES ?? DEFAULT_MAX_PAYLOAD_BYTES;
const MAX_STRING_LENGTH = 512;
const MAX_METADATA_KEYS = 12;
const MAX_METADATA_KEY_LENGTH = 64;
const MAX_METADATA_VALUE_LENGTH = 255;
const MAX_FUTURE_EVENT_MS = 24 * 60 * 60 * 1000;

const ALLOWED_TOP_LEVEL_KEYS = new Set([
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

const SUPPORTED_TYPES = new Set(["pageview", "goal", "identify", "payment"]);

const idSchema = z.string().trim().min(1).max(128);
const nameSchema = z.string().trim().min(1).max(64);
const domainSchema = z.string().trim().min(1).max(255);
const pathSchema = z.string().trim().min(1).max(1024);
const timestampSchema = z.coerce.date();
const tsSchema = z.number().int();
const trackingValueSchema = z.string().trim().min(1).max(255);

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const metadataSchema = z
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
        const sanitized = rawValue.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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

const payloadSchema = z
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

const identifyMetadataSchema = metadataSchema.superRefine((value, ctx) => {
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
});

const isUniqueViolation = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
  );

const ALLOWLIST_DOCS = {
  maxPayloadBytes: MAX_PAYLOAD_BYTES,
  allowedKeys: Array.from(ALLOWED_TOP_LEVEL_KEYS),
  maxStringLength: MAX_STRING_LENGTH,
  maxMetadataKeys: MAX_METADATA_KEYS,
  maxMetadataKeyLength: MAX_METADATA_KEY_LENGTH,
  maxMetadataValueLength: MAX_METADATA_VALUE_LENGTH,
};

const clampString = (value: string, maxLength = MAX_STRING_LENGTH) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

const normalizeUrl = (value: string) => {
  const trimmed = clampString(value, 2048);
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed, "https://placeholder.local");
    const pathname = parsed.pathname || "/";
    const search = parsed.search || "";
    return `${pathname}${search}` || "/";
  } catch (error) {
    return trimmed;
  }
};

const normalizeReferrer = (value: string) => {
  const trimmed = clampString(value, 2048);
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed, "https://placeholder.local");
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin + parsed.pathname;
    }
    return parsed.href;
  } catch (error) {
    return trimmed;
  }
};

const normalizeTrackingValue = (value?: string) => {
  if (!value) {
    return "";
  }
  return clampString(value.toLowerCase(), 255);
};

const normalizeTrackingValues = (payload: z.infer<typeof payloadSchema>) => {
  const normalized: Record<string, string> = {};
  const entries: Array<[string, string | undefined]> = [
    ["utm_source", payload.utm_source],
    ["utm_medium", payload.utm_medium],
    ["utm_campaign", payload.utm_campaign],
    ["utm_term", payload.utm_term],
    ["utm_content", payload.utm_content],
    ["source", payload.source],
    ["via", payload.via],
    ["ref", payload.ref],
  ];

  for (const [key, value] of entries) {
    const normalizedValue = normalizeTrackingValue(value);
    if (normalizedValue) {
      normalized[key] = normalizedValue;
    }
  }

  return normalized;
};

const parseUserAgent = (value: string | null) => {
  if (!value) {
    return { device: "unknown", browser: "unknown", os: "unknown" };
  }
  const ua = value.toLowerCase();
  const device = /mobile|iphone|ipad|android/.test(ua) ? "mobile" : "desktop";
  const browser =
    ua.includes("edg/") || ua.includes("edge")
      ? "edge"
      : ua.includes("chrome")
        ? "chrome"
        : ua.includes("safari") && !ua.includes("chrome")
          ? "safari"
          : ua.includes("firefox")
            ? "firefox"
            : ua.includes("opera") || ua.includes("opr/")
              ? "opera"
              : "unknown";
  const os = ua.includes("windows")
    ? "windows"
    : ua.includes("mac os")
      ? "macos"
      : ua.includes("android")
        ? "android"
        : ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")
          ? "ios"
          : ua.includes("linux")
            ? "linux"
            : "unknown";
  return { device, browser, os };
};

const normalizeCountry = (value: string | null) => {
  if (!value) {
    return "unknown";
  }
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return "unknown";
  }
  return trimmed.length > 2 ? trimmed.slice(0, 2) : trimmed;
};

const normalizeGeoValue = (value: string | null, fallback: string) => {
  if (!value) {
    return fallback;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.length > MAX_STRING_LENGTH ? trimmed.slice(0, MAX_STRING_LENGTH) : trimmed;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const ensureAllowlistedKeys = (payload: Record<string, unknown>) => {
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return key;
    }
  }
  return null;
};

const resolveVersion = (payload: Record<string, unknown>) => {
  const raw = payload.v;
  if (raw === undefined || raw === null || raw === "") {
    return 1;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
};

const rateLimitResponse = (retryAfter: number) =>
  NextResponse.json(
    { error: "Rate limit exceeded", retry_after: retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
      },
    },
  );

export const POST = async (request: NextRequest) => {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader) {
    const length = Number.parseInt(lengthHeader, 10);
    if (Number.isFinite(length) && length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: "Payload too large", limit: MAX_PAYLOAD_BYTES },
        { status: 413 },
      );
    }
  }

  const bodyText = await request.text();
  if (Buffer.byteLength(bodyText) > MAX_PAYLOAD_BYTES) {
    return NextResponse.json(
      { error: "Payload too large", limit: MAX_PAYLOAD_BYTES },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const payloadValue = body;
  const invalidKey = ensureAllowlistedKeys(body);
  if (invalidKey) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: { [invalidKey]: ["Key is not allowlisted"] },
        allowlist: ALLOWLIST_DOCS,
      },
      { status: 400 },
    );
  }

  const version = resolveVersion(body);
  if (version !== 1) {
    return NextResponse.json(
      { error: "Unsupported schema version", supported: [1] },
      { status: 400 },
    );
  }

  const parsed = payloadSchema.safeParse(payloadValue);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
        allowlist: ALLOWLIST_DOCS,
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const headerAuth = request.headers.get("authorization");
  const queryKey = new URL(request.url).searchParams.get("api_key");
  const authResult = await verifyApiKey(headerAuth || buildApiKeyHeader(queryKey));
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (authResult.siteId !== payload.websiteId) {
    return NextResponse.json({ error: "API key does not match website id" }, { status: 403 });
  }

  if (payload.type === "identify") {
    const identifyValidation = identifyMetadataSchema.safeParse(payload.metadata ?? {});
    if (!identifyValidation.success) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: identifyValidation.error.flatten().fieldErrors,
          allowlist: ALLOWLIST_DOCS,
        },
        { status: 400 },
      );
    }
  }
  const rateLimit = checkRateLimit({
    ip: getClientIp(request),
    siteId: authResult.siteId,
    scope: "ingest",
  });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit.retryAfter);
  }

  await runRetentionCleanup();

  const { device, browser, os } = parseUserAgent(request.headers.get("user-agent"));
  const country = normalizeCountry(request.headers.get("x-vercel-ip-country"));
  const region = normalizeGeoValue(request.headers.get("x-vercel-ip-country-region"), "unknown");
  const city = normalizeGeoValue(request.headers.get("x-vercel-ip-city"), "unknown");

  const normalized = {
    url: normalizeUrl(payload.path),
    path: normalizeUrl(payload.path),
    referrer: payload.referrer ? normalizeReferrer(payload.referrer) : "",
    domain: clampString(payload.domain, 255).toLowerCase(),
    utm: normalizeTrackingValues(payload),
    device,
    browser,
    os,
    country,
    region,
    city,
  };

  const createdAt = payload.ts !== undefined ? new Date(payload.ts) : payload.timestamp ?? new Date();
  const metadata = sanitizeMetadataRecord(payload.metadata ?? null, MAX_METADATA_VALUE_LENGTH);
  const eventId = payload.eventId ?? null;
  const timestamp = createdAt.getTime();
  const sessionId = payload.sessionId ?? payload.session_id ?? null;
  const sessionEventTimestamp = createdAt.getTime();
  let previousPageviews = 0;
  let previousMaxTimestamp: number | null = null;

  if (payload.type === "pageview" && sessionId) {
    const [prior] = await db
      .select({
        count: sql<number>`count(*)`,
        maxTimestamp: sql<number | null>`max(${rawEvent.timestamp})`,
      })
      .from(rawEvent)
      .where(
        and(
          eq(rawEvent.siteId, authResult.siteId),
          eq(rawEvent.sessionId, sessionId),
          eq(rawEvent.visitorId, payload.visitorId),
          eq(rawEvent.type, "pageview"),
        ),
      );
    previousPageviews = Number(prior?.count ?? 0);
    previousMaxTimestamp =
      prior?.maxTimestamp !== null && prior?.maxTimestamp !== undefined
        ? Number(prior.maxTimestamp)
        : null;
  }

  try {
    await db.insert(rawEvent).values({
      id: randomUUID(),
      siteId: authResult.siteId,
      eventId,
      type: payload.type,
      name: payload.name ?? null,
      visitorId: payload.visitorId,
      sessionId,
      timestamp,
      metadata,
      normalized,
      createdAt,
    });
  } catch (error) {
    if (eventId && isUniqueViolation(error)) {
      return NextResponse.json({ ok: true, deduped: true });
    }
    throw error;
  }

  const metrics = metricsForEvent({
    type: payload.type,
    metadata: metadata && typeof metadata === "object" ? metadata : null,
  });
  const sessionMetrics =
    payload.type === "pageview" && sessionId
      ? metricsForSession({
          eventType: payload.type,
          previousPageviews,
          previousMaxTimestamp,
          eventTimestamp: sessionEventTimestamp,
        })
      : metricsForSession({
          eventType: "noop",
          previousPageviews: 0,
          previousMaxTimestamp: null,
          eventTimestamp: sessionEventTimestamp,
        });

  await upsertRollups({
    siteId: authResult.siteId,
    timestamp: createdAt,
    metrics,
  });
  await upsertRollups({
    siteId: authResult.siteId,
    timestamp: createdAt,
    metrics: sessionMetrics,
  });

  await upsertDimensionRollups({
    siteId: authResult.siteId,
    timestamp: createdAt,
    metrics,
    dimensions: extractDimensionRollups({
      type: payload.type,
      name: payload.name ?? null,
      metadata: metadata && typeof metadata === "object" ? metadata : null,
      normalized,
    }),
  });

  return NextResponse.json({ ok: true });
};
