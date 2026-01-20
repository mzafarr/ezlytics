import { randomUUID } from "node:crypto";

import { db, rollupDaily, rollupDimensionDaily, rollupDimensionHourly, rollupHourly, sql } from "@my-better-t-app/db";

export type RollupMetrics = {
  visitors: number;
  sessions: number;
  pageviews: number;
  goals: number;
  revenue: number;
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

const normalizeMetrics = (metrics: RollupMetrics): RollupMetrics => ({
  visitors: normalizeMetric(metrics.visitors),
  sessions: normalizeMetric(metrics.sessions),
  pageviews: normalizeMetric(metrics.pageviews),
  goals: normalizeMetric(metrics.goals),
  revenue: normalizeMetric(metrics.revenue),
});

const hasMetrics = (metrics: RollupMetrics) =>
  Object.values(metrics).some((value) => value > 0);

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
    entries.push({
      dimension: "country",
      value: ensureDimensionValue(countryValue, "unknown", false),
    });
    entries.push({
      dimension: "region",
      value: ensureDimensionValue(regionValue, "unknown", false),
    });
    entries.push({
      dimension: "city",
      value: ensureDimensionValue(cityValue, "unknown", false),
    });
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
  siteId,
  timestamp,
  metrics,
  dimensions,
}: {
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

    await db
      .insert(rollupDimensionHourly)
      .values({
        id: randomUUID(),
        siteId,
        date: bucketDate,
        hour,
        dimension: entry.dimension,
        dimensionValue,
        ...normalized,
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
        },
      });

    await db
      .insert(rollupDimensionDaily)
      .values({
        id: randomUUID(),
        siteId,
        date: bucketDate,
        dimension: entry.dimension,
        dimensionValue,
        ...normalized,
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
        },
      });
  }
};
