import { randomUUID } from "node:crypto";

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
import {
  extractDimensionRollups,
  extractSessionDimensionRollups,
  metricsForEvent,
  type RollupMetrics,
  type SessionDimensionContext,
} from "@/lib/rollups";

type SessionState = {
  pageviews: number;
  firstTimestamp: number;
  lastTimestamp: number;
  firstContext: SessionDimensionContext;
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
  includeDiff?: boolean;
};

type RollupDiffSample = {
  table: "daily" | "hourly" | "dimensionDaily" | "dimensionHourly";
  key: string;
  field: string;
  expected: number;
  actual: number;
};

type RollupDiffTableSummary = {
  expected: number;
  actual: number;
  mismatches: number;
};

type RollupDiffSummary = {
  checked: boolean;
  mismatches: number;
  tables: {
    daily: RollupDiffTableSummary;
    hourly: RollupDiffTableSummary;
    dimensionDaily: RollupDiffTableSummary;
    dimensionHourly: RollupDiffTableSummary;
  };
  samples: RollupDiffSample[];
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
  diff?: RollupDiffSummary;
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

const normalizeRevenueByType = (value: unknown) => {
  const record = isRecord(value) ? value : {};
  return {
    new: Number(record.new ?? 0) || 0,
    renewal: Number(record.renewal ?? 0) || 0,
    refund: Number(record.refund ?? 0) || 0,
  };
};

const keyFor = {
  daily: (row: { siteId: string; date: string }) => `${row.siteId}|${row.date}`,
  hourly: (row: { siteId: string; date: string; hour: number }) =>
    `${row.siteId}|${row.date}|${row.hour}`,
  dimensionDaily: (row: {
    siteId: string;
    date: string;
    dimension: string;
    dimensionValue: string;
  }) => `${row.siteId}|${row.date}|${row.dimension}|${row.dimensionValue}`,
  dimensionHourly: (row: {
    siteId: string;
    date: string;
    hour: number;
    dimension: string;
    dimensionValue: string;
  }) =>
    `${row.siteId}|${row.date}|${row.hour}|${row.dimension}|${row.dimensionValue}`,
};

const compareMetricMaps = ({
  table,
  expected,
  actual,
  fields,
}: {
  table: RollupDiffSample["table"];
  expected: Map<string, Record<string, number>>;
  actual: Map<string, Record<string, number>>;
  fields: string[];
}) => {
  const samples: RollupDiffSample[] = [];
  let mismatches = 0;
  const keys = new Set([...expected.keys(), ...actual.keys()]);
  for (const key of keys) {
    const expectedMetrics = expected.get(key) ?? {};
    const actualMetrics = actual.get(key) ?? {};
    for (const field of fields) {
      const expectedValue = Number(expectedMetrics[field] ?? 0);
      const actualValue = Number(actualMetrics[field] ?? 0);
      if (expectedValue !== actualValue) {
        mismatches += 1;
        if (samples.length < 20) {
          samples.push({
            table,
            key,
            field,
            expected: expectedValue,
            actual: actualValue,
          });
        }
      }
    }
  }
  return {
    summary: {
      expected: expected.size,
      actual: actual.size,
      mismatches,
    },
    samples,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asSessionContextValue = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const buildSessionDimensionContext = (
  normalized: Record<string, unknown> | null,
): SessionDimensionContext => ({
  country: asSessionContextValue(normalized?.country),
  region: asSessionContextValue(normalized?.region),
  city: asSessionContextValue(normalized?.city),
  device: asSessionContextValue(normalized?.device) ?? "unknown",
  browser: asSessionContextValue(normalized?.browser) ?? "unknown",
});

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

const insertInChunks = async (
  table: typeof rollupDaily | typeof rollupHourly,
  rows: Array<typeof rollupDaily.$inferInsert | typeof rollupHourly.$inferInsert>,
  chunkSize = 500,
) => {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await db.insert(table).values(rows.slice(i, i + chunkSize));
  }
};

const insertDimensionInChunks = async (
  table: typeof rollupDimensionDaily | typeof rollupDimensionHourly,
  rows: Array<
    typeof rollupDimensionDaily.$inferInsert | typeof rollupDimensionHourly.$inferInsert
  >,
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
  includeDiff = false,
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
    .orderBy(rawEvent.createdAt, rawEvent.id);

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
    const eventTimestamp = Number(row.timestamp);
    if (!Number.isFinite(eventTimestamp)) {
      continue;
    }

    const normalizedRecord = isRecord(row.normalized) ? row.normalized : null;
    const createdAtTimestamp = row.createdAt?.getTime();
    const rollupTimestamp =
      normalizedRecord?.usedClientTimestamp === true && Number.isFinite(eventTimestamp)
        ? eventTimestamp
        : Number.isFinite(createdAtTimestamp)
          ? createdAtTimestamp
          : eventTimestamp;
    if (normalizedRecord?.bot === true) {
      botEventsSkipped += 1;
      continue;
    }

    const metadataRecord = isRecord(row.metadata) ? row.metadata : null;
    const rollupDate = toBucketDate(rollupTimestamp);
    const rollupHour = new Date(rollupTimestamp).getUTCHours();
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
          const sessionStartDateKey = toBucketDate(eventTimestamp);
          const sessionStartHour = new Date(eventTimestamp).getUTCHours();
          const sessionDailyKey = `${row.siteId}|${sessionStartDateKey}`;
          const sessionHourlyKey = `${row.siteId}|${sessionStartDateKey}|${sessionStartHour}`;
          sessionMap.set(sessionKey, {
            pageviews: 1,
            firstTimestamp: eventTimestamp,
            lastTimestamp: eventTimestamp,
            firstContext: buildSessionDimensionContext(normalizedRecord),
          });
          sessionMetrics.sessions = 1;
          sessionMetrics.bouncedSessions = 1;
          if (hasMetrics(sessionMetrics)) {
            const dailyMetrics = dailyMap.get(sessionDailyKey) ?? createEmptyMetrics();
            addMetrics(dailyMetrics, sessionMetrics);
            dailyMap.set(sessionDailyKey, dailyMetrics);
            const hourlyMetrics = hourlyMap.get(sessionHourlyKey) ?? createEmptyMetrics();
            addMetrics(hourlyMetrics, sessionMetrics);
            hourlyMap.set(sessionHourlyKey, hourlyMetrics);
          }
        } else {
          const previousStartDateKey = toBucketDate(existing.firstTimestamp);
          const previousStartHour = new Date(existing.firstTimestamp).getUTCHours();
          const previousDailyKey = `${row.siteId}|${previousStartDateKey}`;
          const previousHourlyKey = `${row.siteId}|${previousStartDateKey}|${previousStartHour}`;
          const nextFirstTimestamp = Math.min(existing.firstTimestamp, eventTimestamp);
          const nextLastTimestamp = Math.max(existing.lastTimestamp, eventTimestamp);
          const previousDuration = Math.max(
            0,
            existing.lastTimestamp - existing.firstTimestamp,
          );
          const nextDuration = Math.max(0, nextLastTimestamp - nextFirstTimestamp);
          const nextStartDateKey = toBucketDate(nextFirstTimestamp);
          const nextStartHour = new Date(nextFirstTimestamp).getUTCHours();
          const nextDailyKey = `${row.siteId}|${nextStartDateKey}`;
          const nextHourlyKey = `${row.siteId}|${nextStartDateKey}|${nextStartHour}`;
          if (existing.pageviews === 1) {
            sessionMetrics.bouncedSessions = -1;
          }
          const durationDelta = nextDuration - previousDuration;
          if (durationDelta !== 0) {
            sessionMetrics.avgSessionDurationMs = durationDelta;
          }
          const previousPageviews = existing.pageviews;
          existing.pageviews += 1;
          if (eventTimestamp < existing.firstTimestamp) {
            existing.firstContext = buildSessionDimensionContext(normalizedRecord);
          }
          existing.firstTimestamp = nextFirstTimestamp;
          existing.lastTimestamp = nextLastTimestamp;
          if (previousStartDateKey !== nextStartDateKey || previousStartHour !== nextStartHour) {
            const removeMetrics = createEmptyMetrics();
            removeMetrics.sessions = -1;
            if (previousPageviews === 1) {
              removeMetrics.bouncedSessions = -1;
            }
            if (previousDuration !== 0) {
              removeMetrics.avgSessionDurationMs = -previousDuration;
            }
            const removeDaily = dailyMap.get(previousDailyKey) ?? createEmptyMetrics();
            addMetrics(removeDaily, removeMetrics);
            dailyMap.set(previousDailyKey, removeDaily);
            const removeHourly = hourlyMap.get(previousHourlyKey) ?? createEmptyMetrics();
            addMetrics(removeHourly, removeMetrics);
            hourlyMap.set(previousHourlyKey, removeHourly);

            const addMetricsDelta = createEmptyMetrics();
            addMetricsDelta.sessions = 1;
            if (nextDuration !== 0) {
              addMetricsDelta.avgSessionDurationMs = nextDuration;
            }
            const addDaily = dailyMap.get(nextDailyKey) ?? createEmptyMetrics();
            addMetrics(addDaily, addMetricsDelta);
            dailyMap.set(nextDailyKey, addDaily);
            const addHourly = hourlyMap.get(nextHourlyKey) ?? createEmptyMetrics();
            addMetrics(addHourly, addMetricsDelta);
            hourlyMap.set(nextHourlyKey, addHourly);
          } else if (hasMetrics(sessionMetrics)) {
            const dailyMetrics = dailyMap.get(nextDailyKey) ?? createEmptyMetrics();
            addMetrics(dailyMetrics, sessionMetrics);
            dailyMap.set(nextDailyKey, dailyMetrics);
            const hourlyMetrics = hourlyMap.get(nextHourlyKey) ?? createEmptyMetrics();
            addMetrics(hourlyMetrics, sessionMetrics);
            hourlyMap.set(nextHourlyKey, hourlyMetrics);
          }
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

  // Session dimension rollups use first-pageview context.
  for (const [sessionKey, state] of sessionMap.entries()) {
    const [sessionSiteId] = sessionKey.split("|");
    const sessionDate = toBucketDate(state.firstTimestamp);
    const sessionHour = new Date(state.firstTimestamp).getUTCHours();
    const sessionMetrics = createEmptyMetrics();
    sessionMetrics.sessions = 1;
    const dimensionEntries = extractSessionDimensionRollups(state.firstContext);

    for (const entry of dimensionEntries) {
      const dailyDimensionKey = `${sessionSiteId}|${sessionDate}|${entry.dimension}|${entry.value}`;
      const existingDaily = dimensionDailyMap.get(dailyDimensionKey);
      if (!existingDaily) {
        dimensionDailyMap.set(dailyDimensionKey, {
          siteId: sessionSiteId,
          date: sessionDate,
          dimension: entry.dimension,
          dimensionValue: entry.value,
          metrics: {
            ...sessionMetrics,
            revenueByType: { ...sessionMetrics.revenueByType },
          },
        });
      } else {
        addMetrics(existingDaily.metrics, sessionMetrics);
      }

      const hourlyDimensionKey = `${sessionSiteId}|${sessionDate}|${sessionHour}|${entry.dimension}|${entry.value}`;
      const existingHourly = dimensionHourlyMap.get(hourlyDimensionKey);
      if (!existingHourly) {
        dimensionHourlyMap.set(hourlyDimensionKey, {
          siteId: sessionSiteId,
          date: sessionDate,
          hour: sessionHour,
          dimension: entry.dimension,
          dimensionValue: entry.value,
          metrics: {
            ...sessionMetrics,
            revenueByType: { ...sessionMetrics.revenueByType },
          },
        });
      } else {
        addMetrics(existingHourly.metrics, sessionMetrics);
      }
    }
  }

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

  if (!dryRun) {
    const deleteDailyFilters = siteId
      ? and(
          sql`${rollupDaily.date} >= ${fromDateStr}`,
          sql`${rollupDaily.date} < ${toDateStr}`,
          eq(rollupDaily.siteId, siteId),
        )
      : and(
          sql`${rollupDaily.date} >= ${fromDateStr}`,
          sql`${rollupDaily.date} < ${toDateStr}`,
        );
    const deleteHourlyFilters = siteId
      ? and(
          sql`${rollupHourly.date} >= ${fromDateStr}`,
          sql`${rollupHourly.date} < ${toDateStr}`,
          eq(rollupHourly.siteId, siteId),
        )
      : and(
          sql`${rollupHourly.date} >= ${fromDateStr}`,
          sql`${rollupHourly.date} < ${toDateStr}`,
        );
    const deleteDimensionDailyFilters = siteId
      ? and(
          sql`${rollupDimensionDaily.date} >= ${fromDateStr}`,
          sql`${rollupDimensionDaily.date} < ${toDateStr}`,
          eq(rollupDimensionDaily.siteId, siteId),
        )
      : and(
          sql`${rollupDimensionDaily.date} >= ${fromDateStr}`,
          sql`${rollupDimensionDaily.date} < ${toDateStr}`,
        );
    const deleteDimensionHourlyFilters = siteId
      ? and(
          sql`${rollupDimensionHourly.date} >= ${fromDateStr}`,
          sql`${rollupDimensionHourly.date} < ${toDateStr}`,
          eq(rollupDimensionHourly.siteId, siteId),
        )
      : and(
          sql`${rollupDimensionHourly.date} >= ${fromDateStr}`,
          sql`${rollupDimensionHourly.date} < ${toDateStr}`,
        );

    await db.delete(rollupDaily).where(deleteDailyFilters);
    await db.delete(rollupHourly).where(deleteHourlyFilters);
    await db.delete(rollupDimensionDaily).where(deleteDimensionDailyFilters);
    await db.delete(rollupDimensionHourly).where(deleteDimensionHourlyFilters);

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

  let diff: RollupDiffSummary | undefined;
  if (includeDiff || dryRun) {
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
    const deleteHourlyFilters = siteId
      ? and(
          sql`${rollupHourly.date} >= ${fromDateStr}`,
          sql`${rollupHourly.date} < ${toDateStr}`,
          eq(rollupHourly.siteId, siteId),
        )
      : and(
          sql`${rollupHourly.date} >= ${fromDateStr}`,
          sql`${rollupHourly.date} < ${toDateStr}`,
        );
    const deleteDimensionDailyFilters = siteId
      ? and(
          sql`${rollupDimensionDaily.date} >= ${fromDateStr}`,
          sql`${rollupDimensionDaily.date} < ${toDateStr}`,
          eq(rollupDimensionDaily.siteId, siteId),
        )
      : and(
          sql`${rollupDimensionDaily.date} >= ${fromDateStr}`,
          sql`${rollupDimensionDaily.date} < ${toDateStr}`,
        );
    const deleteDimensionHourlyFilters = siteId
      ? and(
          sql`${rollupDimensionHourly.date} >= ${fromDateStr}`,
          sql`${rollupDimensionHourly.date} < ${toDateStr}`,
          eq(rollupDimensionHourly.siteId, siteId),
        )
      : and(
          sql`${rollupDimensionHourly.date} >= ${fromDateStr}`,
          sql`${rollupDimensionHourly.date} < ${toDateStr}`,
        );

    const [actualDaily, actualHourly, actualDimensionDaily, actualDimensionHourly] =
      await Promise.all([
        db.select().from(rollupDaily).where(deleteFilters),
        db.select().from(rollupHourly).where(deleteHourlyFilters),
        db.select().from(rollupDimensionDaily).where(deleteDimensionDailyFilters),
        db.select().from(rollupDimensionHourly).where(deleteDimensionHourlyFilters),
      ]);

    const expectedDailyMap = new Map(
      dailyRows.map((row) => [
        keyFor.daily(row),
        {
          visitors: row.visitors,
          sessions: row.sessions,
          bouncedSessions: row.bouncedSessions,
          avgSessionDurationMs: row.avgSessionDurationMs,
          pageviews: row.pageviews,
          goals: row.goals,
          revenue: row.revenue,
          revenueNew: normalizeRevenueByType(row.revenueByType).new,
          revenueRenewal: normalizeRevenueByType(row.revenueByType).renewal,
          revenueRefund: normalizeRevenueByType(row.revenueByType).refund,
        },
      ]),
    );
    const actualDailyMap = new Map(
      actualDaily.map((row) => [
        keyFor.daily(row),
        {
          visitors: row.visitors,
          sessions: row.sessions,
          bouncedSessions: row.bouncedSessions,
          avgSessionDurationMs: row.avgSessionDurationMs,
          pageviews: row.pageviews,
          goals: row.goals,
          revenue: row.revenue,
          revenueNew: normalizeRevenueByType(row.revenueByType).new,
          revenueRenewal: normalizeRevenueByType(row.revenueByType).renewal,
          revenueRefund: normalizeRevenueByType(row.revenueByType).refund,
        },
      ]),
    );
    const expectedHourlyMap = new Map(
      hourlyRows.map((row) => [
        keyFor.hourly(row),
        {
          visitors: row.visitors,
          sessions: row.sessions,
          bouncedSessions: row.bouncedSessions,
          avgSessionDurationMs: row.avgSessionDurationMs,
          pageviews: row.pageviews,
          goals: row.goals,
          revenue: row.revenue,
          revenueNew: normalizeRevenueByType(row.revenueByType).new,
          revenueRenewal: normalizeRevenueByType(row.revenueByType).renewal,
          revenueRefund: normalizeRevenueByType(row.revenueByType).refund,
        },
      ]),
    );
    const actualHourlyMap = new Map(
      actualHourly.map((row) => [
        keyFor.hourly(row),
        {
          visitors: row.visitors,
          sessions: row.sessions,
          bouncedSessions: row.bouncedSessions,
          avgSessionDurationMs: row.avgSessionDurationMs,
          pageviews: row.pageviews,
          goals: row.goals,
          revenue: row.revenue,
          revenueNew: normalizeRevenueByType(row.revenueByType).new,
          revenueRenewal: normalizeRevenueByType(row.revenueByType).renewal,
          revenueRefund: normalizeRevenueByType(row.revenueByType).refund,
        },
      ]),
    );
    const expectedDimensionDailyMap = new Map(
      dimensionDailyRows.map((row) => [
        keyFor.dimensionDaily(row),
        {
          visitors: row.visitors,
          sessions: row.sessions,
          pageviews: row.pageviews,
          goals: row.goals,
          revenue: row.revenue,
          revenueNew: normalizeRevenueByType(row.revenueByType).new,
          revenueRenewal: normalizeRevenueByType(row.revenueByType).renewal,
          revenueRefund: normalizeRevenueByType(row.revenueByType).refund,
        },
      ]),
    );
    const actualDimensionDailyMap = new Map(
      actualDimensionDaily.map((row) => [
        keyFor.dimensionDaily(row),
        {
          visitors: row.visitors,
          sessions: row.sessions,
          pageviews: row.pageviews,
          goals: row.goals,
          revenue: row.revenue,
          revenueNew: normalizeRevenueByType(row.revenueByType).new,
          revenueRenewal: normalizeRevenueByType(row.revenueByType).renewal,
          revenueRefund: normalizeRevenueByType(row.revenueByType).refund,
        },
      ]),
    );
    const expectedDimensionHourlyMap = new Map(
      dimensionHourlyRows.map((row) => [
        keyFor.dimensionHourly(row),
        {
          visitors: row.visitors,
          sessions: row.sessions,
          pageviews: row.pageviews,
          goals: row.goals,
          revenue: row.revenue,
          revenueNew: normalizeRevenueByType(row.revenueByType).new,
          revenueRenewal: normalizeRevenueByType(row.revenueByType).renewal,
          revenueRefund: normalizeRevenueByType(row.revenueByType).refund,
        },
      ]),
    );
    const actualDimensionHourlyMap = new Map(
      actualDimensionHourly.map((row) => [
        keyFor.dimensionHourly(row),
        {
          visitors: row.visitors,
          sessions: row.sessions,
          pageviews: row.pageviews,
          goals: row.goals,
          revenue: row.revenue,
          revenueNew: normalizeRevenueByType(row.revenueByType).new,
          revenueRenewal: normalizeRevenueByType(row.revenueByType).renewal,
          revenueRefund: normalizeRevenueByType(row.revenueByType).refund,
        },
      ]),
    );

    const dailyDiff = compareMetricMaps({
      table: "daily",
      expected: expectedDailyMap,
      actual: actualDailyMap,
      fields: [
        "visitors",
        "sessions",
        "bouncedSessions",
        "avgSessionDurationMs",
        "pageviews",
        "goals",
        "revenue",
        "revenueNew",
        "revenueRenewal",
        "revenueRefund",
      ],
    });
    const hourlyDiff = compareMetricMaps({
      table: "hourly",
      expected: expectedHourlyMap,
      actual: actualHourlyMap,
      fields: [
        "visitors",
        "sessions",
        "bouncedSessions",
        "avgSessionDurationMs",
        "pageviews",
        "goals",
        "revenue",
        "revenueNew",
        "revenueRenewal",
        "revenueRefund",
      ],
    });
    const dimensionDailyDiff = compareMetricMaps({
      table: "dimensionDaily",
      expected: expectedDimensionDailyMap,
      actual: actualDimensionDailyMap,
      fields: [
        "visitors",
        "sessions",
        "pageviews",
        "goals",
        "revenue",
        "revenueNew",
        "revenueRenewal",
        "revenueRefund",
      ],
    });
    const dimensionHourlyDiff = compareMetricMaps({
      table: "dimensionHourly",
      expected: expectedDimensionHourlyMap,
      actual: actualDimensionHourlyMap,
      fields: [
        "visitors",
        "sessions",
        "pageviews",
        "goals",
        "revenue",
        "revenueNew",
        "revenueRenewal",
        "revenueRefund",
      ],
    });

    const samples = [
      ...dailyDiff.samples,
      ...hourlyDiff.samples,
      ...dimensionDailyDiff.samples,
      ...dimensionHourlyDiff.samples,
    ].slice(0, 20);
    diff = {
      checked: true,
      mismatches:
        dailyDiff.summary.mismatches +
        hourlyDiff.summary.mismatches +
        dimensionDailyDiff.summary.mismatches +
        dimensionHourlyDiff.summary.mismatches,
      tables: {
        daily: dailyDiff.summary,
        hourly: hourlyDiff.summary,
        dimensionDaily: dimensionDailyDiff.summary,
        dimensionHourly: dimensionHourlyDiff.summary,
      },
      samples,
    };
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
    diff,
  };
};
