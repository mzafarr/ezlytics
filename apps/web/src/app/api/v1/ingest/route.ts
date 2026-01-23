/**
 * Ingest API route handler.
 *
 * This module orchestrates the ingest flow by delegating to specialized modules:
 * - schema.ts: Validation schemas and constants
 * - normalize.ts: Input normalization helpers
 * - geo.ts: Geolocation resolution
 * - metrics.ts: Session and metrics tracking
 */

import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { buildApiKeyHeader, verifyApiKey } from "@my-better-t-app/api/api-key";
import { db, rawEvent, visitorDaily } from "@my-better-t-app/db";
import { env } from "@my-better-t-app/env/server";
import { sanitizeMetadataRecord } from "@/lib/metadata-sanitize";
import {
  extractDimensionRollups,
  metricsForEvent,
  upsertDimensionRollups,
  upsertRollups,
} from "@/lib/rollups";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

import {
  DEFAULT_MAX_PAYLOAD_BYTES,
  MAX_METADATA_VALUE_LENGTH,
  ALLOWLIST_DOCS,
  payloadSchema,
  identifyMetadataSchema,
} from "@/app/api/v1/ingest/schema";
import {
  normalizeDomain,
  isDomainAllowed,
  normalizeUrl,
  normalizeReferrer,
  normalizeTrackingValues,
  parseUserAgent,
  isBotUserAgent,
  toBucketDate,
  resolveEventTimestamp,
  isRecord,
  ensureAllowlistedKeys,
  resolveVersion,
  resolveIngestServerKey,
} from "@/app/api/v1/ingest/normalize";
import {
  resolveGeoFromMaxMind,
  resolveGeoFromHeaders,
} from "@/app/api/v1/ingest/geo";
import {
  buildSessionMetrics,
} from "@/app/api/v1/ingest/metrics";

const MAX_PAYLOAD_BYTES =
  env.INGEST_MAX_PAYLOAD_BYTES ?? DEFAULT_MAX_PAYLOAD_BYTES;

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

  const url = new URL(request.url);
  const headerAuth = request.headers.get("authorization");
  const queryKey = url.searchParams.get("api_key");
  const ingestServerKey = resolveIngestServerKey(
    request.headers,
    url.searchParams.get("server_key"),
  );
  const hasPrivilegedBotAccess = Boolean(
    env.INGEST_SERVER_KEY &&
    ingestServerKey &&
    ingestServerKey === env.INGEST_SERVER_KEY,
  );
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
  if (payload.bot !== undefined && !hasPrivilegedBotAccess) {
    return withCors(
      NextResponse.json(
        {
          error: "Invalid request",
          details: { bot: ["Bot flag requires a server key"] },
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
  const botOverride = hasPrivilegedBotAccess && payload.bot === true;
  const isBot = isBotUserAgent(userAgent) || botOverride;
  const ipAddress = getClientIp(request);

  const geoFromHeaders = resolveGeoFromHeaders(request.headers);
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

  // Reject timestamps outside acceptable window
  if (timestampInfo.rejection === "past") {
    return withCors(
      NextResponse.json(
        {
          error: "Invalid request",
          details: { ts: ["Client timestamp is more than 24h in the past"] },
          allowlist: ALLOWLIST_DOCS,
        },
        { status: 400 },
      ),
    );
  }
  if (timestampInfo.rejection === "future") {
    return withCors(
      NextResponse.json(
        {
          error: "Invalid request",
          details: {
            ts: ["Client timestamp is more than 5 minutes in the future"],
          },
          allowlist: ALLOWLIST_DOCS,
        },
        { status: 400 },
      ),
    );
  }

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
          target: [
            visitorDaily.siteId,
            visitorDaily.date,
            visitorDaily.visitorId,
          ],
        })
        .returning({ id: visitorDaily.id });
      if (inserted.length > 0) {
        metrics.visitors = 1;
      }
    }

    const sessionUpdates =
      payload.type === "pageview" && sessionId
        ? await buildSessionMetrics({
            db: tx,
            siteId: authResult.siteId,
            sessionId,
            visitorId: payload.visitorId,
            eventTimestamp: sessionEventTimestamp,
          })
        : [];

    await upsertRollups({
      db: tx,
      siteId: authResult.siteId,
      timestamp: rollupTimestamp,
      metrics,
    });
    for (const update of sessionUpdates) {
      await upsertRollups({
        db: tx,
        siteId: authResult.siteId,
        timestamp: update.timestamp,
        metrics: update.metrics,
      });
    }

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
