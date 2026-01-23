import { randomUUID } from "node:crypto";

import { db, rollupDaily, rollupDimensionDaily, rollupDimensionHourly, rollupHourly, sql } from "@my-better-t-app/db";

type DbLike = Pick<typeof db, "insert">;

export type RollupMetrics = {
  visitors: number;
  sessions: number;
  bouncedSessions: number;
  avgSessionDurationMs: number;
  pageviews: number;
  goals: number;
  revenue: number;
  revenueByType: {
    new: number;
    renewal: number;
    refund: number;
  };
};

export type RollupDimension =
  | "page"
  | "referrer_domain"
  | "utm_source"
  | "utm_campaign"
  | "country"
  | "region"
  | "city"
  | "device"
  | "browser"
  | "goal";

export type RollupDimensionEntry = {
  dimension: RollupDimension;
  value: string;
};

const normalizeMetric = (value: number) =>
  Number.isFinite(value) && value > 0 ? Math.trunc(value) : 0;

const normalizeDelta = (value: number) => (Number.isFinite(value) ? Math.trunc(value) : 0);

const normalizeMetrics = (metrics: RollupMetrics): RollupMetrics => ({
  visitors: normalizeMetric(metrics.visitors),
  sessions: normalizeDelta(metrics.sessions),
  bouncedSessions: normalizeDelta(metrics.bouncedSessions),
  avgSessionDurationMs: normalizeDelta(metrics.avgSessionDurationMs),
  pageviews: normalizeMetric(metrics.pageviews),
  goals: normalizeMetric(metrics.goals),
  revenue: normalizeMetric(metrics.revenue),
  revenueByType: {
    new: normalizeMetric(metrics.revenueByType.new),
    renewal: normalizeMetric(metrics.revenueByType.renewal),
    refund: normalizeMetric(metrics.revenueByType.refund),
  },
});

const hasMetrics = (metrics: RollupMetrics) =>
  metrics.visitors > 0 ||
  metrics.sessions !== 0 ||
  metrics.bouncedSessions !== 0 ||
  metrics.avgSessionDurationMs !== 0 ||
  metrics.pageviews > 0 ||
  metrics.goals > 0 ||
  metrics.revenue > 0 ||
  metrics.revenueByType.new > 0 ||
  metrics.revenueByType.renewal > 0 ||
  metrics.revenueByType.refund > 0;

const normalizeDimensionValue = (value: string, maxLength = 128) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const sanitized = trimmed.replace(/\s+/g, " ");
  return sanitized.length > maxLength ? sanitized.slice(0, maxLength) : sanitized;
};

const ensureDimensionValue = (value: string, fallback: string, lowercase = true) => {
  const normalized = normalizeDimensionValue(value);
  if (!normalized) {
    return fallback;
  }
  return lowercase ? normalized.toLowerCase() : normalized;
};

const normalizeReferrerDomain = (value?: string | null) => {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed, "https://placeholder.local");
    if (parsed.hostname) {
      return parsed.hostname.toLowerCase();
    }
  } catch (error) {
    return trimmed.toLowerCase();
  }
  return "";
};

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
}: {
  type: string;
  metadata?: Record<string, unknown> | null;
}): RollupMetrics => {
  const metrics: RollupMetrics = {
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
  };

  if (type === "pageview") {
    metrics.pageviews = 1;
  } else if (type === "goal") {
    metrics.goals = 1;
  } else if (type === "payment") {
    const amount = getRevenueAmount(metadata);
    const eventType = metadata?.event_type;
    const isEventType = eventType === "new" || eventType === "renewal" || eventType === "refund";
    if (amount !== null) {
      metrics.revenue = amount;
      if (isEventType) {
        metrics.revenueByType[eventType] = amount;
      }
    }
  }

  return metrics;
};

export const metricsForSession = ({
  eventType,
  previousPageviews,
  previousMaxTimestamp,
  eventTimestamp,
}: {
  eventType: string;
  previousPageviews: number;
  previousMaxTimestamp: number | null;
  eventTimestamp: number;
}): RollupMetrics => {
  const metrics: RollupMetrics = {
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
  };

  if (eventType !== "pageview") {
    return metrics;
  }

  if (!Number.isFinite(previousPageviews) || previousPageviews < 0) {
    return metrics;
  }

  if (previousPageviews === 0) {
    metrics.sessions = 1;
    metrics.bouncedSessions = 1;
    return metrics;
  }

  metrics.bouncedSessions = previousPageviews === 1 ? -1 : 0;
  if (previousMaxTimestamp != null && eventTimestamp > previousMaxTimestamp) {
    metrics.avgSessionDurationMs = Math.round(eventTimestamp - previousMaxTimestamp);
  }

  return metrics;
};

const toBucketDate = (timestamp: Date) =>
  new Date(Date.UTC(timestamp.getUTCFullYear(), timestamp.getUTCMonth(), timestamp.getUTCDate()))
    .toISOString()
    .slice(0, 10);

const safeTimestamp = (value: Date) => (Number.isNaN(value.getTime()) ? new Date() : value);

export const upsertRollups = async ({
  db: dbLike = db,
  siteId,
  timestamp,
  metrics,
}: {
  db?: DbLike;
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

  await dbLike
    .insert(rollupHourly)
    .values({
      id: randomUUID(),
      siteId,
      date: bucketDate,
      hour,
      visitors: normalized.visitors,
      sessions: normalized.sessions,
      bouncedSessions: normalized.bouncedSessions,
      avgSessionDurationMs: normalized.avgSessionDurationMs,
      pageviews: normalized.pageviews,
      goals: normalized.goals,
      revenue: normalized.revenue,
      revenueByType: normalized.revenueByType,
    })
    .onConflictDoUpdate({
      target: [rollupHourly.siteId, rollupHourly.date, rollupHourly.hour],
      set: {
        visitors: sql`${rollupHourly.visitors} + ${normalized.visitors}`,
        sessions: sql`${rollupHourly.sessions} + ${normalized.sessions}`,
        bouncedSessions: sql`${rollupHourly.bouncedSessions} + ${normalized.bouncedSessions}`,
        avgSessionDurationMs: sql`${rollupHourly.avgSessionDurationMs} + ${normalized.avgSessionDurationMs}`,
        pageviews: sql`${rollupHourly.pageviews} + ${normalized.pageviews}`,
        goals: sql`${rollupHourly.goals} + ${normalized.goals}`,
        revenue: sql`${rollupHourly.revenue} + ${normalized.revenue}`,
        revenueByType: sql`jsonb_set(
          jsonb_set(
            jsonb_set(${rollupHourly.revenueByType}, '{new}', to_jsonb((${rollupHourly.revenueByType}->>'new')::int + ${normalized.revenueByType.new}), true),
            '{renewal}', to_jsonb((${rollupHourly.revenueByType}->>'renewal')::int + ${normalized.revenueByType.renewal}), true
          ),
          '{refund}', to_jsonb((${rollupHourly.revenueByType}->>'refund')::int + ${normalized.revenueByType.refund}), true
        )`,
      },
    });

  await dbLike
    .insert(rollupDaily)
    .values({
      id: randomUUID(),
      siteId,
      date: bucketDate,
      visitors: normalized.visitors,
      sessions: normalized.sessions,
      bouncedSessions: normalized.bouncedSessions,
      avgSessionDurationMs: normalized.avgSessionDurationMs,
      pageviews: normalized.pageviews,
      goals: normalized.goals,
      revenue: normalized.revenue,
      revenueByType: normalized.revenueByType,
    })
    .onConflictDoUpdate({
      target: [rollupDaily.siteId, rollupDaily.date],
      set: {
        visitors: sql`${rollupDaily.visitors} + ${normalized.visitors}`,
        sessions: sql`${rollupDaily.sessions} + ${normalized.sessions}`,
        bouncedSessions: sql`${rollupDaily.bouncedSessions} + ${normalized.bouncedSessions}`,
        avgSessionDurationMs: sql`${rollupDaily.avgSessionDurationMs} + ${normalized.avgSessionDurationMs}`,
        pageviews: sql`${rollupDaily.pageviews} + ${normalized.pageviews}`,
        goals: sql`${rollupDaily.goals} + ${normalized.goals}`,
        revenue: sql`${rollupDaily.revenue} + ${normalized.revenue}`,
        revenueByType: sql`jsonb_set(
          jsonb_set(
            jsonb_set(${rollupDaily.revenueByType}, '{new}', to_jsonb((${rollupDaily.revenueByType}->>'new')::int + ${normalized.revenueByType.new}), true),
            '{renewal}', to_jsonb((${rollupDaily.revenueByType}->>'renewal')::int + ${normalized.revenueByType.renewal}), true
          ),
          '{refund}', to_jsonb((${rollupDaily.revenueByType}->>'refund')::int + ${normalized.revenueByType.refund}), true
        )`,
      },
    });
};

export const extractDimensionRollups = ({
  type,
  name,
  metadata,
  normalized,
}: {
  type: string;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
  normalized?: Record<string, unknown> | null;
}): RollupDimensionEntry[] => {
  const entries: RollupDimensionEntry[] = [];
  const normalizedRecord = normalized ?? {};
  const hasNormalizedContext = Object.keys(normalizedRecord).length > 0;
  const pathValue = typeof normalizedRecord.path === "string" ? normalizedRecord.path : "";
  const referrerValue = typeof normalizedRecord.referrer === "string" ? normalizedRecord.referrer : "";
  const deviceValue = typeof normalizedRecord.device === "string" ? normalizedRecord.device : "";
  const browserValue = typeof normalizedRecord.browser === "string" ? normalizedRecord.browser : "";
  const countryValue = typeof normalizedRecord.country === "string" ? normalizedRecord.country : "";
  const regionValue = typeof normalizedRecord.region === "string" ? normalizedRecord.region : "";
  const cityValue = typeof normalizedRecord.city === "string" ? normalizedRecord.city : "";
  const utmRecord =
    normalizedRecord.utm && typeof normalizedRecord.utm === "object" ? (normalizedRecord.utm as Record<string, unknown>) : {};

  if (hasNormalizedContext) {
    entries.push({ dimension: "page", value: ensureDimensionValue(pathValue || "/", "/", false) });
    entries.push({
      dimension: "referrer_domain",
      value: ensureDimensionValue(normalizeReferrerDomain(referrerValue), "direct"),
    });
    entries.push({
      dimension: "utm_source",
      value: ensureDimensionValue(
        typeof utmRecord.utm_source === "string" ? utmRecord.utm_source : "",
        "not set",
      ),
    });
    entries.push({
      dimension: "utm_campaign",
      value: ensureDimensionValue(
        typeof utmRecord.utm_campaign === "string" ? utmRecord.utm_campaign : "",
        "not set",
      ),
    });
    if (countryValue) {
      entries.push({
        dimension: "country",
        value: ensureDimensionValue(countryValue, "unknown", false),
      });
    }
    if (regionValue) {
      entries.push({
        dimension: "region",
        value: ensureDimensionValue(regionValue, "unknown", false),
      });
    }
    if (cityValue) {
      entries.push({
        dimension: "city",
        value: ensureDimensionValue(cityValue, "unknown", false),
      });
    }
    entries.push({
      dimension: "device",
      value: ensureDimensionValue(deviceValue, "unknown"),
    });
    entries.push({
      dimension: "browser",
      value: ensureDimensionValue(browserValue, "unknown"),
    });
  }

  if (type === "goal") {
    const goalName = typeof name === "string" ? name : "";
    const normalizedGoal = ensureDimensionValue(goalName, "unknown");
    if (normalizedGoal) {
      entries.push({ dimension: "goal", value: normalizedGoal });
    }
  }

  return entries;
};

export const upsertDimensionRollups = async ({
  db: dbLike = db,
  siteId,
  timestamp,
  metrics,
  dimensions,
}: {
  db?: DbLike;
  siteId: string;
  timestamp: Date;
  metrics: RollupMetrics;
  dimensions: RollupDimensionEntry[];
}) => {
  const normalized = normalizeMetrics(metrics);
  if (!hasMetrics(normalized) || dimensions.length === 0) {
    return;
  }

  const resolvedTimestamp = safeTimestamp(timestamp);
  const bucketDate = toBucketDate(resolvedTimestamp);
  const hour = resolvedTimestamp.getUTCHours();

  for (const entry of dimensions) {
    const dimensionValue = normalizeDimensionValue(entry.value);
    if (!dimensionValue) {
      continue;
    }

    await dbLike
      .insert(rollupDimensionHourly)
      .values({
        id: randomUUID(),
        siteId,
        date: bucketDate,
        hour,
        dimension: entry.dimension,
        dimensionValue,
        visitors: normalized.visitors,
        sessions: normalized.sessions,
        pageviews: normalized.pageviews,
        goals: normalized.goals,
        revenue: normalized.revenue,
        revenueByType: normalized.revenueByType,
      })
      .onConflictDoUpdate({
        target: [
          rollupDimensionHourly.siteId,
          rollupDimensionHourly.date,
          rollupDimensionHourly.hour,
          rollupDimensionHourly.dimension,
          rollupDimensionHourly.dimensionValue,
        ],
        set: {
          visitors: sql`${rollupDimensionHourly.visitors} + ${normalized.visitors}`,
          sessions: sql`${rollupDimensionHourly.sessions} + ${normalized.sessions}`,
          pageviews: sql`${rollupDimensionHourly.pageviews} + ${normalized.pageviews}`,
          goals: sql`${rollupDimensionHourly.goals} + ${normalized.goals}`,
          revenue: sql`${rollupDimensionHourly.revenue} + ${normalized.revenue}`,
          revenueByType: sql`jsonb_set(
            jsonb_set(
              jsonb_set(${rollupDimensionHourly.revenueByType}, '{new}', to_jsonb((${rollupDimensionHourly.revenueByType}->>'new')::int + ${normalized.revenueByType.new}), true),
              '{renewal}', to_jsonb((${rollupDimensionHourly.revenueByType}->>'renewal')::int + ${normalized.revenueByType.renewal}), true
            ),
            '{refund}', to_jsonb((${rollupDimensionHourly.revenueByType}->>'refund')::int + ${normalized.revenueByType.refund}), true
          )`,
        },
      });

    await dbLike
      .insert(rollupDimensionDaily)
      .values({
        id: randomUUID(),
        siteId,
        date: bucketDate,
        dimension: entry.dimension,
        dimensionValue,
        visitors: normalized.visitors,
        sessions: normalized.sessions,
        pageviews: normalized.pageviews,
        goals: normalized.goals,
        revenue: normalized.revenue,
        revenueByType: normalized.revenueByType,
      })
      .onConflictDoUpdate({
        target: [
          rollupDimensionDaily.siteId,
          rollupDimensionDaily.date,
          rollupDimensionDaily.dimension,
          rollupDimensionDaily.dimensionValue,
        ],
        set: {
          visitors: sql`${rollupDimensionDaily.visitors} + ${normalized.visitors}`,
          sessions: sql`${rollupDimensionDaily.sessions} + ${normalized.sessions}`,
          pageviews: sql`${rollupDimensionDaily.pageviews} + ${normalized.pageviews}`,
          goals: sql`${rollupDimensionDaily.goals} + ${normalized.goals}`,
          revenue: sql`${rollupDimensionDaily.revenue} + ${normalized.revenue}`,
          revenueByType: sql`jsonb_set(
            jsonb_set(
              jsonb_set(${rollupDimensionDaily.revenueByType}, '{new}', to_jsonb((${rollupDimensionDaily.revenueByType}->>'new')::int + ${normalized.revenueByType.new}), true),
              '{renewal}', to_jsonb((${rollupDimensionDaily.revenueByType}->>'renewal')::int + ${normalized.revenueByType.renewal}), true
            ),
            '{refund}', to_jsonb((${rollupDimensionDaily.revenueByType}->>'refund')::int + ${normalized.revenueByType.refund}), true
          )`,
        },
      });
  }
};
