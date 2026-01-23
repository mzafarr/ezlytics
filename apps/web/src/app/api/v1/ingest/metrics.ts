/**
 * Ingest metrics and session helpers.
 *
 * Functions for building session metrics and tracking visitor sessions.
 */

import { randomUUID } from "node:crypto";
import { analyticsSession, and, db, eq, sql } from "@my-better-t-app/db";
import { metricsForEvent } from "@/lib/rollups";

export type DbLike = Pick<typeof db, "insert" | "update" | "execute">;

export const createEmptyMetrics = () => metricsForEvent({ type: "noop" });

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
