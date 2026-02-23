/**
 * Ingest metrics and session helpers.
 *
 * Functions for building session metrics and tracking visitor sessions.
 */

import { randomUUID } from "node:crypto";
import { analyticsSession, and, db, eq, sql } from "@my-better-t-app/db";
import {
  metricsForEvent,
  type RollupMetrics,
  type SessionDimensionContext,
} from "@/lib/rollups";
import { toBucketDate } from "@/app/api/v1/ingest/normalize";

export type DbLike = Pick<typeof db, "insert" | "update" | "execute">;

export const createEmptyMetrics = () => metricsForEvent({ type: "noop" });

export type SessionMetricsUpdate = {
  metrics: RollupMetrics;
  timestamp: Date;
};

export type SessionDimensionUpdate = {
  sessionsDelta: number;
  timestamp: Date;
  context: SessionDimensionContext;
};

export type SessionUpdateResult = {
  metricsUpdates: SessionMetricsUpdate[];
  dimensionUpdates: SessionDimensionUpdate[];
};

const asSessionContextValue = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const buildSessionDimensionContext = (
  normalized: Record<string, unknown>,
): SessionDimensionContext => ({
  country: asSessionContextValue(normalized.country),
  region: asSessionContextValue(normalized.region),
  city: asSessionContextValue(normalized.city),
  device: asSessionContextValue(normalized.device) ?? "unknown",
  browser: asSessionContextValue(normalized.browser) ?? "unknown",
});

const normalizeSessionDimensionContext = (
  value: unknown,
): SessionDimensionContext => {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return buildSessionDimensionContext(record);
};

const sessionContextKey = (context: SessionDimensionContext) =>
  JSON.stringify({
    country: context.country ?? null,
    region: context.region ?? null,
    city: context.city ?? null,
    device: context.device ?? "unknown",
    browser: context.browser ?? "unknown",
  });

const toBucketKey = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${toBucketDate(date)}|${date.getUTCHours()}`;
};

export const buildSessionMetrics = async ({
  db: dbLike = db,
  siteId,
  sessionId,
  visitorId,
  eventTimestamp,
  sessionContext,
}: {
  db?: DbLike;
  siteId: string;
  sessionId: string;
  visitorId: string;
  eventTimestamp: number;
  sessionContext: SessionDimensionContext;
}): Promise<SessionUpdateResult> => {
  const inserted = await dbLike
    .insert(analyticsSession)
    .values({
      id: randomUUID(),
      siteId,
      sessionId,
      visitorId,
      firstTimestamp: eventTimestamp,
      lastTimestamp: eventTimestamp,
      firstNormalized: sessionContext,
      pageviews: 1,
    })
    .onConflictDoNothing({
      target: [
        analyticsSession.siteId,
        analyticsSession.sessionId,
        analyticsSession.visitorId,
      ],
    })
    .returning({ id: analyticsSession.id });

  if (inserted.length > 0) {
    const metrics = createEmptyMetrics();
    metrics.sessions = 1;
    metrics.bouncedSessions = 1;
    return {
      metricsUpdates: [{ metrics, timestamp: new Date(eventTimestamp) }],
      dimensionUpdates: [
        {
          sessionsDelta: 1,
          timestamp: new Date(eventTimestamp),
          context: sessionContext,
        },
      ],
    };
  }

  const existing = await dbLike.execute(
    sql`select pageviews, first_timestamp, last_timestamp, first_normalized from analytics_session where site_id = ${siteId} and session_id = ${sessionId} and visitor_id = ${visitorId} for update`,
  );
  const row = existing.rows[0] as
    | {
        pageviews: number;
        first_timestamp: number;
        last_timestamp: number;
        first_normalized: unknown;
      }
    | undefined;
  if (!row) {
    return { metricsUpdates: [], dimensionUpdates: [] };
  }

  const previousPageviews = Number(row.pageviews ?? 0);
  if (!Number.isFinite(previousPageviews) || previousPageviews < 0) {
    return { metricsUpdates: [], dimensionUpdates: [] };
  }
  const previousFirstTimestamp = Number(row.first_timestamp ?? eventTimestamp);
  const previousLastTimestamp = Number(row.last_timestamp ?? eventTimestamp);
  const safePreviousFirst = Number.isFinite(previousFirstTimestamp)
    ? previousFirstTimestamp
    : eventTimestamp;
  const safePreviousLast = Number.isFinite(previousLastTimestamp)
    ? previousLastTimestamp
    : eventTimestamp;
  const nextFirstTimestamp = Math.min(safePreviousFirst, eventTimestamp);
  const nextLastTimestamp = Math.max(safePreviousLast, eventTimestamp);
  const nextPageviews = previousPageviews + 1;
  const previousDuration = Math.max(0, safePreviousLast - safePreviousFirst);
  const nextDuration = Math.max(0, nextLastTimestamp - nextFirstTimestamp);
  const previousBucketKey = toBucketKey(safePreviousFirst);
  const nextBucketKey = toBucketKey(nextFirstTimestamp);
  const bucketChanged = previousBucketKey !== nextBucketKey;
  const previousContext = normalizeSessionDimensionContext(row.first_normalized);
  const eventIsNewFirst = eventTimestamp < safePreviousFirst;
  const nextContext = eventIsNewFirst ? sessionContext : previousContext;
  const contextChanged = sessionContextKey(previousContext) !== sessionContextKey(nextContext);

  await dbLike
    .update(analyticsSession)
    .set({
      pageviews: nextPageviews,
      firstTimestamp: nextFirstTimestamp,
      lastTimestamp: nextLastTimestamp,
      firstNormalized: nextContext,
    })
    .where(
      and(
        eq(analyticsSession.siteId, siteId),
        eq(analyticsSession.sessionId, sessionId),
        eq(analyticsSession.visitorId, visitorId),
      ),
    );

  const metricsUpdates: SessionMetricsUpdate[] = [];
  const dimensionUpdates: SessionDimensionUpdate[] = [];
  if (bucketChanged) {
    const removeMetrics = createEmptyMetrics();
    removeMetrics.sessions = -1;
    if (previousPageviews === 1) {
      removeMetrics.bouncedSessions = -1;
    }
    if (previousDuration !== 0) {
      removeMetrics.avgSessionDurationMs = -previousDuration;
    }
    metricsUpdates.push({
      metrics: removeMetrics,
      timestamp: new Date(safePreviousFirst),
    });
    dimensionUpdates.push({
      sessionsDelta: -1,
      timestamp: new Date(safePreviousFirst),
      context: previousContext,
    });

    const addMetrics = createEmptyMetrics();
    addMetrics.sessions = 1;
    if (nextPageviews === 1) {
      addMetrics.bouncedSessions = 1;
    }
    if (nextDuration !== 0) {
      addMetrics.avgSessionDurationMs = nextDuration;
    }
    metricsUpdates.push({
      metrics: addMetrics,
      timestamp: new Date(nextFirstTimestamp),
    });
    dimensionUpdates.push({
      sessionsDelta: 1,
      timestamp: new Date(nextFirstTimestamp),
      context: nextContext,
    });
    return { metricsUpdates, dimensionUpdates };
  }

  if (contextChanged) {
    const timestamp = new Date(nextFirstTimestamp);
    dimensionUpdates.push({
      sessionsDelta: -1,
      timestamp,
      context: previousContext,
    });
    dimensionUpdates.push({
      sessionsDelta: 1,
      timestamp,
      context: nextContext,
    });
  }

  const metrics = createEmptyMetrics();
  if (previousPageviews === 1) {
    metrics.bouncedSessions = -1;
  }
  const durationDelta = nextDuration - previousDuration;
  if (durationDelta !== 0) {
    metrics.avgSessionDurationMs = durationDelta;
  }
  if (metrics.bouncedSessions !== 0 || metrics.avgSessionDurationMs !== 0) {
    metricsUpdates.push({ metrics, timestamp: new Date(nextFirstTimestamp) });
  }
  return { metricsUpdates, dimensionUpdates };
};
