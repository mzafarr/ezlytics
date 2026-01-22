import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import { NextRequest, NextResponse } from "next/server";
import * as maxmind from "maxmind";
import { z } from "zod";

import { buildApiKeyHeader, verifyApiKey } from "@my-better-t-app/api/api-key";
import {
  analyticsSession,
  and,
  db,
  eq,
  rawEvent,
  sql,
  visitorDaily,
} from "@my-better-t-app/db";
import { env } from "@my-better-t-app/env/server";
import { sanitizeMetadataRecord } from "@/lib/metadata-sanitize";
import { extractDimensionRollups, metricsForEvent, upsertDimensionRollups, upsertRollups } from "@/lib/rollups";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const DEFAULT_MAX_PAYLOAD_BYTES = 32 * 1024;
const MAX_PAYLOAD_BYTES =
  env.INGEST_MAX_PAYLOAD_BYTES ?? DEFAULT_MAX_PAYLOAD_BYTES;
const MAX_STRING_LENGTH = 512;
const MAX_METADATA_KEYS = 12;
const MAX_METADATA_KEY_LENGTH = 64;
const MAX_METADATA_VALUE_LENGTH = 255;
const MAX_FUTURE_EVENT_MS = 24 * 60 * 60 * 1000;
const MAX_CLIENT_TS_SKEW_MS = 5 * 60 * 1000;

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

const metadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

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

const normalizeDomain = (value: string) => {
  const trimmed = clampString(value, 255).toLowerCase();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase();
  } catch (error) {
    return trimmed.split("/")[0] || "";
  }
};

const isDomainAllowed = (eventDomain: string, siteDomain: string) => {
  if (!eventDomain || !siteDomain) {
    return false;
  }
  if (eventDomain === siteDomain) {
    return true;
  }
  return eventDomain.endsWith(`.${siteDomain}`);
};

const botSignatures = [
  "bot",
  "crawler",
  "spider",
  "crawling",
  "headless",
  "slurp",
  "baiduspider",
  "bingbot",
  "duckduckbot",
  "facebookexternalhit",
  "facebot",
  "ia_archiver",
  "yandex",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "python-requests",
  "curl",
  "wget",
  "postmanruntime",
  "httpclient",
  "axios",
  "okhttp",
  "go-http-client",
];

const isBotUserAgent = (value: string | null) => {
  if (!value) {
    return true;
  }
  const normalized = value.toLowerCase();
  return botSignatures.some((signature) => normalized.includes(signature));
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

const toBucketDate = (timestamp: Date) =>
  new Date(Date.UTC(timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate()))
    .toISOString()
    .slice(0, 10);

const resolveEventTimestamp = (payload: { ts?: number; timestamp?: Date }) => {
  const nowMs = Date.now();
  const candidate =
    typeof payload.ts === "number" && Number.isFinite(payload.ts)
      ? payload.ts
      : payload.timestamp && Number.isFinite(payload.timestamp.getTime())
        ? payload.timestamp.getTime()
        : null;
  if (candidate === null) {
    return {
      eventDate: new Date(nowMs),
      serverDate: new Date(nowMs),
      clientTimestamp: null,
      clockSkewMs: null,
      usedClientTimestamp: false,
    };
  }
  const skew = candidate - nowMs;
  const withinSkew = Math.abs(skew) <= MAX_CLIENT_TS_SKEW_MS;
  const eventDate = new Date(withinSkew ? candidate : nowMs);
  return {
    eventDate,
    serverDate: new Date(nowMs),
    clientTimestamp: candidate,
    clockSkewMs: skew,
    usedClientTimestamp: withinSkew,
  };
};

const createEmptyMetrics = () => metricsForEvent({ type: "noop" });

type DbLike = Pick<typeof db, "insert" | "update" | "execute">;

const buildSessionMetrics = async ({
  db: dbLike = db,
  siteId,
  sessionId,
  visitorId,
  eventTimestamp,
}: {
  db?: DbLike;
  siteId: string;
  sessionId: string;
  visitorId: string;
  eventTimestamp: number;
}) => {
  const inserted = await dbLike
    .insert(analyticsSession)
    .values({
      id: randomUUID(),
      siteId,
      sessionId,
      visitorId,
      firstTimestamp: eventTimestamp,
      lastTimestamp: eventTimestamp,
      pageviews: 1,
    })
    .onConflictDoNothing({
      target: [analyticsSession.siteId, analyticsSession.sessionId, analyticsSession.visitorId],
    })
    .returning({ id: analyticsSession.id });

  if (inserted.length > 0) {
    const metrics = createEmptyMetrics();
    metrics.sessions = 1;
    metrics.bouncedSessions = 1;
    return metrics;
  }

  const existing = await dbLike.execute(
    sql`select pageviews, last_timestamp from analytics_session where site_id = ${siteId} and session_id = ${sessionId} and visitor_id = ${visitorId} for update`,
  );
  const row = existing.rows[0] as
    | { pageviews: number; last_timestamp: number }
    | undefined;
  if (!row) {
    return createEmptyMetrics();
  }

  const previousPageviews = Number(row.pageviews ?? 0);
  const previousLastTimestamp = Number(row.last_timestamp ?? 0);
  const nextLastTimestamp = Math.max(previousLastTimestamp, eventTimestamp);
  const durationDelta = Math.max(0, nextLastTimestamp - previousLastTimestamp);

  await dbLike
    .update(analyticsSession)
    .set({
      pageviews: previousPageviews + 1,
      lastTimestamp: nextLastTimestamp,
    })
    .where(
      and(
        eq(analyticsSession.siteId, siteId),
        eq(analyticsSession.sessionId, sessionId),
        eq(analyticsSession.visitorId, visitorId),
      ),
    );

  const metrics = createEmptyMetrics();
  if (previousPageviews === 1) {
    metrics.bouncedSessions = -1;
  }
  if (durationDelta > 0) {
    metrics.avgSessionDurationMs = durationDelta;
  }
  return metrics;
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
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === "unknown") {
    return null;
  }
  const upper = trimmed.toUpperCase();
  return upper.length > 2 ? upper.slice(0, 2) : upper;
};

const getHeaderValue = (headers: Headers, keys: string[]) => {
  for (const key of keys) {
    const value = headers.get(key);
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const parseCoordinateHeader = (value: string | null, min: number, max: number) => {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return clampCoordinate(parsed, min, max);
};

const normalizeGeoValue = (value: string | null) => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.toLowerCase() === "unknown") {
    return null;
  }
  return trimmed.length > MAX_STRING_LENGTH
    ? trimmed.slice(0, MAX_STRING_LENGTH)
    : trimmed;
};

const clampCoordinate = (
  value: number | null | undefined,
  min: number,
  max: number,
) => {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
};

let geoReaderPromise: Promise<maxmind.Reader<maxmind.CityResponse>> | null =
  null;
let geoReaderPath: string | null = null;

const readGeoDatabase = (path: string) => {
  if (!existsSync(path)) {
    return null;
  }
  if (!geoReaderPromise || geoReaderPath !== path) {
    geoReaderPath = path;
    geoReaderPromise = maxmind.open<maxmind.CityResponse>(path).catch(() => {
      geoReaderPromise = null;
      geoReaderPath = null;
      return Promise.reject(new Error("MaxMind database open failed"));
    });
  }
  return geoReaderPromise;
};

const resolveGeoFromMaxMind = async (ip: string, mmdbPath: string) => {
  if (!maxmind.validate(ip)) {
    return null;
  }
  const readerPromise = readGeoDatabase(mmdbPath);
  if (!readerPromise) {
    return null;
  }
  let reader: maxmind.Reader<maxmind.CityResponse>;
  try {
    reader = await readerPromise;
  } catch (error) {
    return null;
  }
  if (!reader) {
    return null;
  }
  const result = reader.get(ip);
  if (!result) {
    return null;
  }
  const region =
    result.subdivisions?.[0]?.names?.en ??
    result.subdivisions?.[0]?.names?.["en"];
  return {
    country: normalizeCountry(result.country?.iso_code ?? null),
    region: normalizeGeoValue(region ?? null),
    city: normalizeGeoValue(
      result.city?.names?.en ?? result.city?.names?.["en"] ?? null,
    ),
    latitude: clampCoordinate(result.location?.latitude, -90, 90),
    longitude: clampCoordinate(result.location?.longitude, -180, 180),
  };
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
  withCors(
    NextResponse.json(
      { error: "Rate limit exceeded", retry_after: retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
        },
      },
    ),
  );

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const withCors = (response: NextResponse) => {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
};

const payloadTooLargeResponse = () =>
  withCors(
    NextResponse.json(
      { error: "Payload too large", limit: MAX_PAYLOAD_BYTES },
      { status: 413 },
    ),
  );

const readBodyText = async (request: NextRequest) => {
  const stream = request.body;
  if (!stream) {
    return "";
  }
  const decoder = new TextDecoder();
  let totalBytes = 0;
  const chunks: string[] = [];
  const reader = stream.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAX_PAYLOAD_BYTES) {
      throw new Error("payload_too_large");
    }
    chunks.push(decoder.decode(value, { stream: true }));
  }
  chunks.push(decoder.decode());
  return chunks.join("");
};

export const OPTIONS = () => {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
};

export const POST = async (request: NextRequest) => {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader) {
    const length = Number.parseInt(lengthHeader, 10);
    if (Number.isFinite(length) && length > MAX_PAYLOAD_BYTES) {
      return payloadTooLargeResponse();
    }
  }

  const headerAuth = request.headers.get("authorization");
  const queryKey = new URL(request.url).searchParams.get("api_key");
  const authResult = await verifyApiKey(
    headerAuth || buildApiKeyHeader(queryKey),
  );
  if (!authResult.ok) {
    return withCors(
      NextResponse.json({ error: authResult.error }, { status: 401 }),
    );
  }

  const rateLimit = checkRateLimit({
    ip: getClientIp(request),
    siteId: authResult.siteId,
    scope: "ingest",
  });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit.retryAfter);
  }

  let bodyText = "";
  try {
    bodyText = await readBodyText(request);
  } catch (error) {
    if (error instanceof Error && error.message === "payload_too_large") {
      return payloadTooLargeResponse();
    }
    throw error;
  }

  let body: unknown;
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (error) {
    return withCors(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    );
  }

  if (!isRecord(body)) {
    return withCors(
      NextResponse.json({ error: "Invalid payload" }, { status: 400 }),
    );
  }

  const payloadValue = body;
  const invalidKey = ensureAllowlistedKeys(body);
  if (invalidKey) {
    return withCors(
      NextResponse.json(
        {
          error: "Invalid request",
          details: { [invalidKey]: ["Key is not allowlisted"] },
          allowlist: ALLOWLIST_DOCS,
        },
        { status: 400 },
      ),
    );
  }

  const version = resolveVersion(body);
  if (version !== 1) {
    return withCors(
      NextResponse.json(
        { error: "Unsupported schema version", supported: [1] },
        { status: 400 },
      ),
    );
  }

  const parsed = payloadSchema.safeParse(payloadValue);
  if (!parsed.success) {
    return withCors(
      NextResponse.json(
        {
          error: "Invalid request",
          details: parsed.error.flatten().fieldErrors,
          allowlist: ALLOWLIST_DOCS,
        },
        { status: 400 },
      ),
    );
  }

  const payload = parsed.data;
  if (
    payload.sessionId &&
    payload.session_id &&
    payload.sessionId !== payload.session_id
  ) {
    return withCors(
      NextResponse.json(
        {
          error: "Invalid request",
          details: {
            sessionId: ["sessionId and session_id must match"],
            session_id: ["sessionId and session_id must match"],
          },
          allowlist: ALLOWLIST_DOCS,
        },
        { status: 400 },
      ),
    );
  }
  if (authResult.websiteId !== payload.websiteId) {
    return withCors(
      NextResponse.json(
        { error: "API key does not match website id" },
        { status: 403 },
      ),
    );
  }

  const normalizedPayloadDomain = normalizeDomain(payload.domain);
  const normalizedSiteDomain = normalizeDomain(authResult.domain);
  if (!isDomainAllowed(normalizedPayloadDomain, normalizedSiteDomain)) {
    return withCors(
      NextResponse.json(
        { error: "Domain not allowed for this site" },
        { status: 403 },
      ),
    );
  }

  if (payload.type === "identify") {
    const identifyValidation = identifyMetadataSchema.safeParse(
      payload.metadata ?? {},
    );
    if (!identifyValidation.success) {
      return withCors(
        NextResponse.json(
          {
            error: "Invalid request",
            details: identifyValidation.error.flatten().fieldErrors,
            allowlist: ALLOWLIST_DOCS,
          },
          { status: 400 },
        ),
      );
    }
  }
  const userAgent = request.headers.get("user-agent");
  const { device, browser, os } = parseUserAgent(userAgent);
  const isBot = isBotUserAgent(userAgent);
  const ipAddress = getClientIp(request);
  const headerCountry = normalizeCountry(
    getHeaderValue(request.headers, [
      "x-vercel-ip-country",
      "cf-ipcountry",
      "x-country-code",
      "x-geo-country",
      "x-geo-country-code",
    ]),
  );
  const headerRegion = normalizeGeoValue(
    getHeaderValue(request.headers, [
      "x-vercel-ip-country-region",
      "x-vercel-ip-country-region-name",
      "cf-region",
      "x-geo-region",
      "x-geo-region-name",
    ]),
  );
  const headerCity = normalizeGeoValue(
    getHeaderValue(request.headers, [
      "x-vercel-ip-city",
      "cf-city",
      "x-geo-city",
    ]),
  );
  const headerLatitude = parseCoordinateHeader(
    getHeaderValue(request.headers, [
      "x-vercel-ip-latitude",
      "cf-iplatitude",
      "x-geo-latitude",
    ]),
    -90,
    90,
  );
  const headerLongitude = parseCoordinateHeader(
    getHeaderValue(request.headers, [
      "x-vercel-ip-longitude",
      "cf-iplongitude",
      "x-geo-longitude",
    ]),
    -180,
    180,
  );
  const geoFromHeaders = {
    country: headerCountry,
    region: headerRegion,
    city: headerCity,
    latitude: headerLatitude,
    longitude: headerLongitude,
  };
  const maxmindGeo =
    env.GEOIP_MMDB_PATH && ipAddress
      ? await resolveGeoFromMaxMind(ipAddress, env.GEOIP_MMDB_PATH)
      : null;
  const country = maxmindGeo?.country ?? geoFromHeaders.country ?? null;
  const region = maxmindGeo?.region ?? geoFromHeaders.region ?? null;
  const city = maxmindGeo?.city ?? geoFromHeaders.city ?? null;
  const latitude = maxmindGeo?.latitude ?? geoFromHeaders.latitude ?? null;
  const longitude = maxmindGeo?.longitude ?? geoFromHeaders.longitude ?? null;

  const timestampInfo = resolveEventTimestamp(payload);
  const normalized = {
    url: normalizeUrl(payload.path),
    path: normalizeUrl(payload.path),
    referrer: payload.referrer ? normalizeReferrer(payload.referrer) : "",
    domain: normalizedPayloadDomain,
    utm: normalizeTrackingValues(payload),
    device,
    browser,
    os,
    country,
    region,
    city,
    latitude,
    longitude,
    bot: isBot,
    clientTimestamp: timestampInfo.clientTimestamp,
    serverTimestamp: timestampInfo.serverDate.getTime(),
    clockSkewMs: timestampInfo.clockSkewMs,
    usedClientTimestamp: timestampInfo.usedClientTimestamp,
  };

  const createdAt = timestampInfo.serverDate;
  const eventDate = timestampInfo.eventDate;
  const rollupTimestamp = timestampInfo.usedClientTimestamp
    ? eventDate
    : createdAt;
  const metadata = sanitizeMetadataRecord(
    payload.metadata ?? null,
    MAX_METADATA_VALUE_LENGTH,
  );
  const eventId = payload.eventId ?? null;
  const timestamp = eventDate.getTime();
  const sessionId = payload.sessionId ?? payload.session_id ?? null;
  const sessionEventTimestamp = eventDate.getTime();

  const result = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(rawEvent)
      .values({
        id: randomUUID(),
        siteId: authResult.siteId,
        eventId,
        type: payload.type,
        name: payload.name ?? null,
        visitorId: payload.visitorId,
        sessionId,
        timestamp,
        country,
        region,
        city,
        latitude,
        longitude,
        metadata,
        normalized,
        createdAt,
      })
      .onConflictDoNothing({
        target: [rawEvent.siteId, rawEvent.eventId],
      })
      .returning({ id: rawEvent.id });

    if (eventId && inserted.length === 0) {
      return { ok: true as const, deduped: true as const };
    }

    if (isBot) {
      return { ok: true as const, bot: true as const };
    }

    const metrics = metricsForEvent({
      type: payload.type,
      metadata: metadata && typeof metadata === "object" ? metadata : null,
    });

    if (payload.type === "pageview") {
      const bucketDate = toBucketDate(rollupTimestamp);
      const inserted = await tx
        .insert(visitorDaily)
        .values({
          id: randomUUID(),
          siteId: authResult.siteId,
          date: bucketDate,
          visitorId: payload.visitorId,
        })
        .onConflictDoNothing({
          target: [visitorDaily.siteId, visitorDaily.date, visitorDaily.visitorId],
        })
        .returning({ id: visitorDaily.id });
      if (inserted.length > 0) {
        metrics.visitors = 1;
      }
    }

    const sessionMetrics =
      payload.type === "pageview" && sessionId
        ? await buildSessionMetrics({
            db: tx,
            siteId: authResult.siteId,
            sessionId,
            visitorId: payload.visitorId,
            eventTimestamp: sessionEventTimestamp,
          })
        : createEmptyMetrics();

    await upsertRollups({
      db: tx,
      siteId: authResult.siteId,
      timestamp: rollupTimestamp,
      metrics,
    });
    await upsertRollups({
      db: tx,
      siteId: authResult.siteId,
      timestamp: rollupTimestamp,
      metrics: sessionMetrics,
    });

    await upsertDimensionRollups({
      db: tx,
      siteId: authResult.siteId,
      timestamp: rollupTimestamp,
      metrics,
      dimensions: extractDimensionRollups({
        type: payload.type,
        name: payload.name ?? null,
        metadata: metadata && typeof metadata === "object" ? metadata : null,
        normalized,
      }),
    });

    return { ok: true as const };
  });

  return withCors(NextResponse.json(result));
};
