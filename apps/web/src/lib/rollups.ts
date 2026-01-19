import { randomUUID } from "node:crypto";

import { db, rollupDaily, rollupHourly, sql } from "@my-better-t-app/db";

export type RollupMetrics = {
  visitors: number;
  sessions: number;
  pageviews: number;
  goals: number;
  revenue: number;
};

const normalizeMetric = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;

const normalizeMetrics = (metrics: RollupMetrics): RollupMetrics => ({
  visitors: normalizeMetric(metrics.visitors),
  sessions: normalizeMetric(metrics.sessions),
  pageviews: normalizeMetric(metrics.pageviews),
  goals: normalizeMetric(metrics.goals),
  revenue: normalizeMetric(metrics.revenue),
});

const hasMetrics = (metrics: RollupMetrics) =>
  Object.values(metrics).some((value) => value > 0);

export const getRevenueAmount = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) {
    return null;
  }
  const amount = metadata.amount;
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return Math.round(amount);
  }
  if (typeof amount === "string") {
    const parsed = Number.parseInt(amount, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export const metricsForEvent = ({
  type,
  metadata,
  sessionId,
}: {
  type: string;
  metadata?: Record<string, unknown> | null;
  sessionId?: string | null;
}): RollupMetrics => {
  const metrics: RollupMetrics = {
    visitors: 0,
    sessions: 0,
    pageviews: 0,
    goals: 0,
    revenue: 0,
  };

  if (type === "pageview") {
    metrics.pageviews = 1;
    metrics.visitors = 1;
    metrics.sessions = sessionId ? 1 : 0;
  } else if (type === "goal") {
    metrics.goals = 1;
  } else if (type === "payment") {
    const amount = getRevenueAmount(metadata);
    if (amount !== null) {
      metrics.revenue = amount;
    }
  }

  return metrics;
};

const toBucketDate = (timestamp: Date) =>
  new Date(Date.UTC(timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate()))
    .toISOString()
    .slice(0, 10);

const safeTimestamp = (value: Date) => (Number.isNaN(value.getTime()) ? new Date() : value);

export const upsertRollups = async ({
  siteId,
  timestamp,
  metrics,
}: {
  siteId: string;
  timestamp: Date;
  metrics: RollupMetrics;
}) => {
  const normalized = normalizeMetrics(metrics);
  if (!hasMetrics(normalized)) {
    return;
  }

  const resolvedTimestamp = safeTimestamp(timestamp);
  const bucketDate = toBucketDate(resolvedTimestamp);
  const hour = resolvedTimestamp.getUTCHours();

  await db
    .insert(rollupHourly)
    .values({
      id: randomUUID(),
      siteId,
      date: bucketDate,
      hour,
      ...normalized,
    })
    .onConflictDoUpdate({
      target: [rollupHourly.siteId, rollupHourly.date, rollupHourly.hour],
      set: {
        visitors: sql`${rollupHourly.visitors} + ${normalized.visitors}`,
        sessions: sql`${rollupHourly.sessions} + ${normalized.sessions}`,
        pageviews: sql`${rollupHourly.pageviews} + ${normalized.pageviews}`,
        goals: sql`${rollupHourly.goals} + ${normalized.goals}`,
        revenue: sql`${rollupHourly.revenue} + ${normalized.revenue}`,
      },
    });

  await db
    .insert(rollupDaily)
    .values({
      id: randomUUID(),
      siteId,
      date: bucketDate,
      ...normalized,
    })
    .onConflictDoUpdate({
      target: [rollupDaily.siteId, rollupDaily.date],
      set: {
        visitors: sql`${rollupDaily.visitors} + ${normalized.visitors}`,
        sessions: sql`${rollupDaily.sessions} + ${normalized.sessions}`,
        pageviews: sql`${rollupDaily.pageviews} + ${normalized.pageviews}`,
        goals: sql`${rollupDaily.goals} + ${normalized.goals}`,
        revenue: sql`${rollupDaily.revenue} + ${normalized.revenue}`,
      },
    });
};
