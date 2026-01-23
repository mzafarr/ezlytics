/**
 * Ingest metrics and session helpers.
 *
 * Functions for building session metrics and tracking visitor sessions.
 */

import { randomUUID } from "node:crypto";
import { analyticsSession, and, db, eq, sql } from "@my-better-t-app/db";
import { metricsForEvent, type RollupMetrics } from "@/lib/rollups";
import { toBucketDate } from "@/app/api/v1/ingest/normalize";

export type DbLike = Pick<typeof db, "insert" | "update" | "execute">;

export const createEmptyMetrics = () => metricsForEvent({ type: "noop" });

export type SessionMetricsUpdate = {
  metrics: RollupMetrics;
  timestamp: Date;
};

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
}: {
  db?: DbLike;
  siteId: string;
  sessionId: string;
  visitorId: string;
  eventTimestamp: number;
}): Promise<SessionMetricsUpdate[]> => {
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
    return [{ metrics, timestamp: new Date(eventTimestamp) }];
  }

  const existing = await dbLike.execute(
    sql`select pageviews, first_timestamp, last_timestamp from analytics_session where site_id = ${siteId} and session_id = ${sessionId} and visitor_id = ${visitorId} for update`,
  );
  const row = existing.rows[0] as
    | { pageviews: number; first_timestamp: number; last_timestamp: number }
    | undefined;
  if (!row) {
    return [];
  }

  const previousPageviews = Number(row.pageviews ?? 0);
  if (!Number.isFinite(previousPageviews) || previousPageviews < 0) {
    return [];
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

  await dbLike
    .update(analyticsSession)
    .set({
      pageviews: nextPageviews,
      firstTimestamp: nextFirstTimestamp,
      lastTimestamp: nextLastTimestamp,
    })
    .where(
      and(
        eq(analyticsSession.siteId, siteId),
        eq(analyticsSession.sessionId, sessionId),
        eq(analyticsSession.visitorId, visitorId),
      ),
    );

  const updates: SessionMetricsUpdate[] = [];
  if (bucketChanged) {
    const removeMetrics = createEmptyMetrics();
    removeMetrics.sessions = -1;
    if (previousPageviews === 1) {
      removeMetrics.bouncedSessions = -1;
    }
    if (previousDuration !== 0) {
      removeMetrics.avgSessionDurationMs = -previousDuration;
    }
    updates.push({
      metrics: removeMetrics,
      timestamp: new Date(safePreviousFirst),
    });

    const addMetrics = createEmptyMetrics();
    addMetrics.sessions = 1;
    if (nextPageviews === 1) {
      addMetrics.bouncedSessions = 1;
    }
    if (nextDuration !== 0) {
      addMetrics.avgSessionDurationMs = nextDuration;
    }
    updates.push({
      metrics: addMetrics,
      timestamp: new Date(nextFirstTimestamp),
    });
    return updates;
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
    updates.push({ metrics, timestamp: new Date(nextFirstTimestamp) });
  }
  return updates;
};
