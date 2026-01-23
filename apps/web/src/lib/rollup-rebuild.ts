import { randomUUID } from "node:crypto";

import { asc } from "drizzle-orm";
import {
  db,
  and,
  eq,
  rawEvent,
  rollupDaily,
  rollupDimensionDaily,
  rollupDimensionHourly,
  rollupHourly,
  sql,
} from "@my-better-t-app/db";
import { extractDimensionRollups, metricsForEvent, RollupMetrics } from "@/lib/rollups";

type SessionState = {
  pageviews: number;
  lastTimestamp: number;
};

type DimensionEntry = {
  siteId: string;
  date: string;
  hour?: number;
  dimension: string;
  dimensionValue: string;
  metrics: RollupMetrics;
};

export type RollupRebuildOptions = {
  siteId?: string | null;
  from: Date;
  to: Date;
  dryRun?: boolean;
};

export type RollupRebuildSummary = {
  ok: true;
  siteId: string | null;
  from: string;
  to: string;
  dryRun: boolean;
  eventsProcessed: number;
  botEventsSkipped: number;
  rollups: {
    daily: number;
    hourly: number;
    dimensionDaily: number;
    dimensionHourly: number;
  };
};

const createEmptyMetrics = (): RollupMetrics => ({
  visitors: 0,
  sessions: 0,
  bouncedSessions: 0,
  avgSessionDurationMs: 0,
  pageviews: 0,
  goals: 0,
  revenue: 0,
  revenueByType: {
    new: 0,
    renewal: 0,
    refund: 0,
  },
});

const hasMetrics = (metrics: RollupMetrics) =>
  metrics.visitors > 0 ||
  metrics.sessions > 0 ||
  metrics.bouncedSessions !== 0 ||
  metrics.avgSessionDurationMs > 0 ||
  metrics.pageviews > 0 ||
  metrics.goals > 0 ||
  metrics.revenue > 0 ||
  metrics.revenueByType.new > 0 ||
  metrics.revenueByType.renewal > 0 ||
  metrics.revenueByType.refund > 0;

const addMetrics = (target: RollupMetrics, delta: RollupMetrics) => {
  target.visitors += delta.visitors;
  target.sessions += delta.sessions;
  target.bouncedSessions += delta.bouncedSessions;
  target.avgSessionDurationMs += delta.avgSessionDurationMs;
  target.pageviews += delta.pageviews;
  target.goals += delta.goals;
  target.revenue += delta.revenue;
  target.revenueByType.new += delta.revenueByType.new;
  target.revenueByType.renewal += delta.revenueByType.renewal;
  target.revenueByType.refund += delta.revenueByType.refund;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toBucketDate = (timestamp: number) =>
  new Date(
    Date.UTC(
      new Date(timestamp).getUTCFullYear(),
      new Date(timestamp).getUTCMonth(),
      new Date(timestamp).getUTCDate(),
    ),
  )
    .toISOString()
    .slice(0, 10);

const startOfUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const insertInChunks = async <Row extends Record<string, unknown>>(
  table: typeof rollupDaily | typeof rollupHourly,
  rows: Row[],
  chunkSize = 500,
) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(table).values(rows.slice(i, i + chunkSize));
  }
};

const insertDimensionInChunks = async <Row extends Record<string, unknown>>(
  table: typeof rollupDimensionDaily | typeof rollupDimensionHourly,
  rows: Row[],
  chunkSize = 500,
) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(table).values(rows.slice(i, i + chunkSize));
  }
};

export const runRollupRebuild = async ({
  siteId = null,
  from,
  to,
  dryRun = false,
}: RollupRebuildOptions): Promise<RollupRebuildSummary> => {
  const fromDate = startOfUtcDay(from);
  const toDate = startOfUtcDay(to);
  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
    throw new Error("Invalid date range");
  }
  if (toDate.getTime() <= fromDate.getTime()) {
    throw new Error("Range must include at least one UTC day");
  }

  const fromDateStr = fromDate.toISOString().slice(0, 10);
  const toDateStr = toDate.toISOString().slice(0, 10);
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();

  const whereClause = siteId
    ? and(
        sql`${rawEvent.timestamp} >= ${fromMs}`,
        sql`${rawEvent.timestamp} < ${toMs}`,
        eq(rawEvent.siteId, siteId),
      )
    : and(
        sql`${rawEvent.timestamp} >= ${fromMs}`,
        sql`${rawEvent.timestamp} < ${toMs}`,
      );

  const rows = await db
    .select({
      siteId: rawEvent.siteId,
      timestamp: rawEvent.timestamp,
      createdAt: rawEvent.createdAt,
      type: rawEvent.type,
      name: rawEvent.name,
      visitorId: rawEvent.visitorId,
      sessionId: rawEvent.sessionId,
      metadata: rawEvent.metadata,
      normalized: rawEvent.normalized,
    })
    .from(rawEvent)
    .where(whereClause)
    .orderBy(asc(rawEvent.createdAt), asc(rawEvent.id));

  const dailyMap = new Map<string, RollupMetrics>();
  const hourlyMap = new Map<string, RollupMetrics>();
  const dimensionDailyMap = new Map<string, DimensionEntry>();
  const dimensionHourlyMap = new Map<string, DimensionEntry>();
  const visitorSet = new Set<string>();
  const sessionMap = new Map<string, SessionState>();

  let eventsProcessed = 0;
  let botEventsSkipped = 0;

  for (const row of rows) {
    eventsProcessed += 1;
    const timestamp = Number(row.timestamp);
    if (!Number.isFinite(timestamp)) {
      continue;
    }

    const normalizedRecord = isRecord(row.normalized) ? row.normalized : null;
    if (normalizedRecord?.bot === true) {
      botEventsSkipped += 1;
      continue;
    }

    const metadataRecord = isRecord(row.metadata) ? row.metadata : null;
    const rollupDate = toBucketDate(timestamp);
    const rollupHour = new Date(timestamp).getUTCHours();
    const dailyKey = `${row.siteId}|${rollupDate}`;
    const hourlyKey = `${row.siteId}|${rollupDate}|${rollupHour}`;

    const eventMetrics = metricsForEvent({
      type: row.type,
      metadata: metadataRecord,
    });

    if (hasMetrics(eventMetrics)) {
      const dailyMetrics = dailyMap.get(dailyKey) ?? createEmptyMetrics();
      addMetrics(dailyMetrics, eventMetrics);
      dailyMap.set(dailyKey, dailyMetrics);

      const hourlyMetrics = hourlyMap.get(hourlyKey) ?? createEmptyMetrics();
      addMetrics(hourlyMetrics, eventMetrics);
      hourlyMap.set(hourlyKey, hourlyMetrics);
    }

    if (row.type === "pageview") {
      const visitorKey = `${row.siteId}|${rollupDate}|${row.visitorId}`;
      if (!visitorSet.has(visitorKey)) {
        visitorSet.add(visitorKey);
        const visitorMetrics = createEmptyMetrics();
        visitorMetrics.visitors = 1;
        const dailyMetrics = dailyMap.get(dailyKey) ?? createEmptyMetrics();
        addMetrics(dailyMetrics, visitorMetrics);
        dailyMap.set(dailyKey, dailyMetrics);
        const hourlyMetrics = hourlyMap.get(hourlyKey) ?? createEmptyMetrics();
        addMetrics(hourlyMetrics, visitorMetrics);
        hourlyMap.set(hourlyKey, hourlyMetrics);
      }

      if (row.sessionId) {
        const sessionKey = `${row.siteId}|${row.sessionId}|${row.visitorId}`;
        const existing = sessionMap.get(sessionKey);
        const sessionMetrics = createEmptyMetrics();
        if (!existing) {
          sessionMap.set(sessionKey, {
            pageviews: 1,
            lastTimestamp: timestamp,
          });
          sessionMetrics.sessions = 1;
          sessionMetrics.bouncedSessions = 1;
        } else {
          if (existing.pageviews === 1) {
            sessionMetrics.bouncedSessions = -1;
          }
          const nextLastTimestamp = Math.max(existing.lastTimestamp, timestamp);
          const durationDelta = Math.max(0, nextLastTimestamp - existing.lastTimestamp);
          if (durationDelta > 0) {
            sessionMetrics.avgSessionDurationMs = durationDelta;
          }
          existing.pageviews += 1;
          existing.lastTimestamp = nextLastTimestamp;
        }
        if (hasMetrics(sessionMetrics)) {
          const dailyMetrics = dailyMap.get(dailyKey) ?? createEmptyMetrics();
          addMetrics(dailyMetrics, sessionMetrics);
          dailyMap.set(dailyKey, dailyMetrics);
          const hourlyMetrics = hourlyMap.get(hourlyKey) ?? createEmptyMetrics();
          addMetrics(hourlyMetrics, sessionMetrics);
          hourlyMap.set(hourlyKey, hourlyMetrics);
        }
      }
    }

    const dimensionEntries = extractDimensionRollups({
      type: row.type,
      name: row.name ?? null,
      metadata: metadataRecord,
      normalized: normalizedRecord,
    });
    if (dimensionEntries.length > 0 && hasMetrics(eventMetrics)) {
      for (const entry of dimensionEntries) {
        const dailyDimensionKey = `${row.siteId}|${rollupDate}|${entry.dimension}|${entry.value}`;
        const existingDaily = dimensionDailyMap.get(dailyDimensionKey);
        if (!existingDaily) {
          dimensionDailyMap.set(dailyDimensionKey, {
            siteId: row.siteId,
            date: rollupDate,
            dimension: entry.dimension,
            dimensionValue: entry.value,
            metrics: { ...eventMetrics, revenueByType: { ...eventMetrics.revenueByType } },
          });
        } else {
          addMetrics(existingDaily.metrics, eventMetrics);
        }

        const hourlyDimensionKey = `${row.siteId}|${rollupDate}|${rollupHour}|${entry.dimension}|${entry.value}`;
        const existingHourly = dimensionHourlyMap.get(hourlyDimensionKey);
        if (!existingHourly) {
          dimensionHourlyMap.set(hourlyDimensionKey, {
            siteId: row.siteId,
            date: rollupDate,
            hour: rollupHour,
            dimension: entry.dimension,
            dimensionValue: entry.value,
            metrics: { ...eventMetrics, revenueByType: { ...eventMetrics.revenueByType } },
          });
        } else {
          addMetrics(existingHourly.metrics, eventMetrics);
        }
      }
    }
  }

  if (!dryRun) {
    const deleteFilters = siteId
      ? and(
          sql`${rollupDaily.date} >= ${fromDateStr}`,
          sql`${rollupDaily.date} < ${toDateStr}`,
          eq(rollupDaily.siteId, siteId),
        )
      : and(
          sql`${rollupDaily.date} >= ${fromDateStr}`,
          sql`${rollupDaily.date} < ${toDateStr}`,
        );

    await db.delete(rollupDaily).where(deleteFilters);
    await db.delete(rollupHourly).where(deleteFilters);
    await db.delete(rollupDimensionDaily).where(deleteFilters);
    await db.delete(rollupDimensionHourly).where(deleteFilters);

    const dailyRows = Array.from(dailyMap.entries()).map(([key, metrics]) => {
      const [bucketSiteId, date] = key.split("|");
      return {
        id: randomUUID(),
        siteId: bucketSiteId,
        date,
        ...metrics,
      };
    });

    const hourlyRows = Array.from(hourlyMap.entries()).map(([key, metrics]) => {
      const [bucketSiteId, date, hour] = key.split("|");
      return {
        id: randomUUID(),
        siteId: bucketSiteId,
        date,
        hour: Number(hour),
        ...metrics,
      };
    });

    const dimensionDailyRows = Array.from(dimensionDailyMap.values()).map((entry) => ({
      id: randomUUID(),
      siteId: entry.siteId,
      date: entry.date,
      dimension: entry.dimension,
      dimensionValue: entry.dimensionValue,
      visitors: entry.metrics.visitors,
      sessions: entry.metrics.sessions,
      pageviews: entry.metrics.pageviews,
      goals: entry.metrics.goals,
      revenue: entry.metrics.revenue,
      revenueByType: entry.metrics.revenueByType,
    }));

    const dimensionHourlyRows = Array.from(dimensionHourlyMap.values()).map((entry) => ({
      id: randomUUID(),
      siteId: entry.siteId,
      date: entry.date,
      hour: entry.hour ?? 0,
      dimension: entry.dimension,
      dimensionValue: entry.dimensionValue,
      visitors: entry.metrics.visitors,
      sessions: entry.metrics.sessions,
      pageviews: entry.metrics.pageviews,
      goals: entry.metrics.goals,
      revenue: entry.metrics.revenue,
      revenueByType: entry.metrics.revenueByType,
    }));

    if (dailyRows.length > 0) {
      await insertInChunks(rollupDaily, dailyRows);
    }
    if (hourlyRows.length > 0) {
      await insertInChunks(rollupHourly, hourlyRows);
    }
    if (dimensionDailyRows.length > 0) {
      await insertDimensionInChunks(rollupDimensionDaily, dimensionDailyRows);
    }
    if (dimensionHourlyRows.length > 0) {
      await insertDimensionInChunks(rollupDimensionHourly, dimensionHourlyRows);
    }
  }

  return {
    ok: true,
    siteId,
    from: fromDateStr,
    to: toDateStr,
    dryRun,
    eventsProcessed,
    botEventsSkipped,
    rollups: {
      daily: dailyMap.size,
      hourly: hourlyMap.size,
      dimensionDaily: dimensionDailyMap.size,
      dimensionHourly: dimensionHourlyMap.size,
    },
  };
};
