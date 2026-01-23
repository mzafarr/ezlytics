"use client";

import { useMemo } from "react";
import {
  clampNumber,
  filterUnknownEntries,
  formatDateKey,
  getCountryLookupKey,
  normalizeCountryName,
  parseDateKey,
  projectGeoPoint,
  toNumber,
  type DailyEntry,
} from "./dashboard-helpers";

export type RollupRevenueByType = {
  new?: number;
  renewal?: number;
  refund?: number;
};

export type RollupDailyEntry = {
  date: string | number | Date;
  visitors?: number;
  sessions?: number;
  goals?: number;
  revenue?: number;
  bouncedSessions?: number;
  avgSessionDurationMs?: number;
  revenueByType?: unknown;
};

export type RollupDimensionEntry = {
  dimension: string;
  dimensionValue: string;
  visitors?: number;
  sessions?: number;
  goals?: number;
  pageviews?: number;
  revenue?: number;
};

export type RollupGeoPoint = {
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type RollupData = {
  daily?: RollupDailyEntry[];
  dimensions?: RollupDimensionEntry[];
  geoPoints?: RollupGeoPoint[];
};

export type ChartDatum = {
  date: string;
  dateLabel: string;
  visitors: number;
  revenue: number;
  revenueNew: number;
  revenueRenewal: number;
  revenueRefund: number;
  revenuePerVisitor: number;
  conversionRate: number;
};

export type GeoDot = {
  lat: number;
  lng: number;
  count: number;
  x: number;
  y: number;
  size: number;
};

export type DashboardOverviewData = {
  dailyEntries: DailyEntry[];
  revenueTotals: {
    total: number;
    new: number;
    renewal: number;
    refund: number;
  };
  sessionTotals: { sessions: number; bounced: number; durationMs: number };
  visitorsTotal: number;
  goalsTotal: number;
  conversionRate: number;
  revenuePerVisitor: number;
  bounceRate: number;
  avgSessionDurationMs: number;
  chartData: ChartDatum[];
  metricDeltas: {
    visitors: number;
    revenue: number;
    conversionRate: number;
    revenuePerVisitor: number;
    bounceRate: number;
    avgSessionDurationMs: number;
  } | null;
  dimensionTotals: Record<string, Record<string, number>>;
  dimensionVisitorTotals: Record<string, Record<string, number>>;
  dimensionSessionTotals: Record<string, Record<string, number>>;
  dimensionGoalTotals: Record<string, Record<string, number>>;
  dimensionRevenueTotals: Record<string, Record<string, number>>;
  topCountries: Array<[string, number]>;
  topRegions: Array<[string, number]>;
  topCities: Array<[string, number]>;
  topReferrers: Array<[string, number]>;
  topSources: Array<[string, number]>;
  topPages: Array<[string, number]>;
  topDevices: Array<[string, number]>;
  topBrowsers: Array<[string, number]>;
  visibleCountries: Array<[string, number]>;
  visibleRegions: Array<[string, number]>;
  visibleCities: Array<[string, number]>;
  visibleDevices: Array<[string, number]>;
  visibleBrowsers: Array<[string, number]>;
  geoDots: GeoDot[];
  geoCountryTotals: Record<string, number>;
  geoCountryRevenueTotals: Record<string, number>;
  geoCountryGoalTotals: Record<string, number>;
  geoCountrySessionTotals: Record<string, number>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const normalizeRevenueByType = (
  value: unknown,
): RollupRevenueByType | null => {
  if (!isRecord(value)) {
    return null;
  }
  return {
    new: toNumber(value.new),
    renewal: toNumber(value.renewal),
    refund: toNumber(value.refund),
  };
};

const getTopEntries = (
  entries: Record<string, number> | undefined,
  limit: number,
) =>
  Object.entries(entries ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);

export function useDashboardOverviewData(
  rollup?: RollupData | null,
): DashboardOverviewData {
  const dailyEntries = useMemo<DailyEntry[]>(() => {
    return (rollup?.daily ?? [])
      .map((entry) => ({
        date: String(entry.date),
        visitors: toNumber(entry.visitors),
        sessions: toNumber(entry.sessions),
        goals: toNumber(entry.goals),
        revenue: toNumber(entry.revenue),
        bounced: toNumber(entry.bouncedSessions),
        durationMs: toNumber(entry.avgSessionDurationMs),
        revenueByType: normalizeRevenueByType(entry.revenueByType),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [rollup?.daily]);

  const revenueTotals = useMemo(() => {
    const totals = { total: 0, new: 0, renewal: 0, refund: 0 };
    for (const entry of dailyEntries) {
      totals.total += entry.revenue;
      totals.new += toNumber(entry.revenueByType?.new);
      totals.renewal += toNumber(entry.revenueByType?.renewal);
      totals.refund += toNumber(entry.revenueByType?.refund);
    }
    return totals;
  }, [dailyEntries]);

  const sessionTotals = useMemo(() => {
    const totals = { sessions: 0, bounced: 0, durationMs: 0 };
    for (const entry of dailyEntries) {
      totals.sessions += entry.sessions;
      totals.bounced += entry.bounced;
      totals.durationMs += entry.durationMs;
    }
    return totals;
  }, [dailyEntries]);

  const visitorsTotal = useMemo(
    () => dailyEntries.reduce((sum, entry) => sum + entry.visitors, 0),
    [dailyEntries],
  );

  const goalsTotal = useMemo(
    () => dailyEntries.reduce((sum, entry) => sum + entry.goals, 0),
    [dailyEntries],
  );

  const conversionRate =
    sessionTotals.sessions === 0
      ? 0
      : (goalsTotal / sessionTotals.sessions) * 100;

  const revenuePerVisitor =
    visitorsTotal === 0 ? 0 : revenueTotals.total / visitorsTotal;

  const bounceRate =
    sessionTotals.sessions === 0
      ? 0
      : (sessionTotals.bounced / sessionTotals.sessions) * 100;

  const avgSessionDurationMs =
    sessionTotals.sessions === 0
      ? 0
      : Math.round(sessionTotals.durationMs / sessionTotals.sessions);

  const chartData = useMemo<ChartDatum[]>(() => {
    if (dailyEntries.length === 0) {
      return [];
    }
    const entryMap = new Map(dailyEntries.map((entry) => [entry.date, entry]));
    const parsedDates = dailyEntries
      .map((entry) => parseDateKey(entry.date))
      .filter((value): value is Date => Boolean(value));
    if (parsedDates.length === 0) {
      return [];
    }
    const latest = parsedDates.reduce((max, value) =>
      value > max ? value : max,
    );
    const earliest = parsedDates.reduce((min, value) =>
      value < min ? value : min,
    );
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.round(
      (latest.getTime() - earliest.getTime()) / dayMs,
    );
    const dayCount = Math.max(30, diffDays + 1);
    const start = new Date(
      Date.UTC(
        latest.getUTCFullYear(),
        latest.getUTCMonth(),
        latest.getUTCDate(),
      ),
    );
    start.setUTCDate(start.getUTCDate() - (dayCount - 1));

    const data: ChartDatum[] = [];
    for (let index = 0; index < dayCount; index += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const dateKey = formatDateKey(date);
      const entry = entryMap.get(dateKey);
      const visitors = entry?.visitors ?? 0;
      const revenue = entry?.revenue ?? 0;
      const sessions = entry?.sessions ?? 0;
      const goals = entry?.goals ?? 0;
      const revenuePerVisitorForDay = visitors === 0 ? 0 : revenue / visitors;
      const conversionRateForDay =
        sessions === 0 ? 0 : (goals / sessions) * 100;
      // If we have revenueByType breakdown, use it; otherwise use full revenue as "new"
      const hasBreakdown =
        entry?.revenueByType &&
        (entry.revenueByType.new ||
          entry.revenueByType.refund ||
          entry.revenueByType.renewal);
      const revenueRefund = toNumber(entry?.revenueByType?.refund);
      const revenueNew = hasBreakdown
        ? toNumber(entry?.revenueByType?.new)
        : revenue - revenueRefund; // Full revenue minus any refunds

      data.push({
        date: dateKey,
        dateLabel: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        visitors,
        revenue,
        revenueNew,
        revenueRenewal: toNumber(entry?.revenueByType?.renewal),
        revenueRefund,
        revenuePerVisitor: revenuePerVisitorForDay,
        conversionRate: conversionRateForDay,
      });
    }
    return data;
  }, [dailyEntries]);

  const metricDeltas = useMemo(() => {
    if (dailyEntries.length < 2) {
      return null;
    }
    const periodLength =
      dailyEntries.length >= 14 ? 7 : Math.floor(dailyEntries.length / 2);
    if (periodLength === 0) {
      return null;
    }
    const current = dailyEntries.slice(-periodLength);
    const previous = dailyEntries.slice(-periodLength * 2, -periodLength);
    if (previous.length === 0) {
      return null;
    }
    const summarize = (entries: DailyEntry[]) => {
      const totals = {
        visitors: 0,
        revenue: 0,
        sessions: 0,
        goals: 0,
        bounced: 0,
        durationMs: 0,
      };
      for (const entry of entries) {
        totals.visitors += entry.visitors;
        totals.revenue += entry.revenue;
        totals.sessions += entry.sessions;
        totals.goals += entry.goals;
        totals.bounced += entry.bounced;
        totals.durationMs += entry.durationMs;
      }
      return {
        visitors: totals.visitors,
        revenue: totals.revenue,
        conversionRate:
          totals.sessions === 0 ? 0 : (totals.goals / totals.sessions) * 100,
        revenuePerVisitor:
          totals.visitors === 0 ? 0 : totals.revenue / totals.visitors,
        bounceRate:
          totals.sessions === 0 ? 0 : (totals.bounced / totals.sessions) * 100,
        avgSessionDurationMs:
          totals.sessions === 0
            ? 0
            : Math.round(totals.durationMs / totals.sessions),
      };
    };
    const currentSummary = summarize(current);
    const previousSummary = summarize(previous);
    const delta = (currentValue: number, previousValue: number) => {
      if (!Number.isFinite(previousValue) || previousValue === 0) {
        return currentValue === 0 ? 0 : 100;
      }
      return ((currentValue - previousValue) / previousValue) * 100;
    };
    return {
      visitors: delta(currentSummary.visitors, previousSummary.visitors),
      revenue: delta(currentSummary.revenue, previousSummary.revenue),
      conversionRate: delta(
        currentSummary.conversionRate,
        previousSummary.conversionRate,
      ),
      revenuePerVisitor: delta(
        currentSummary.revenuePerVisitor,
        previousSummary.revenuePerVisitor,
      ),
      bounceRate: delta(currentSummary.bounceRate, previousSummary.bounceRate),
      avgSessionDurationMs: delta(
        currentSummary.avgSessionDurationMs,
        previousSummary.avgSessionDurationMs,
      ),
    };
  }, [dailyEntries]);

  const dimensionTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    const dimensions = rollup?.dimensions ?? [];
    for (const entry of dimensions) {
      const dimension = entry.dimension;
      const label = entry.dimensionValue.trim() || "unknown";
      const count = entry.pageviews ?? 0;
      if (!totals[dimension]) {
        totals[dimension] = {};
      }
      totals[dimension][label] = (totals[dimension][label] ?? 0) + count;
    }
    return totals;
  }, [rollup?.dimensions]);

  const dimensionRevenueTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    const dimensions = rollup?.dimensions ?? [];
    for (const entry of dimensions) {
      const dimension = entry.dimension;
      const label = entry.dimensionValue.trim() || "unknown";
      const revenue = entry.revenue ?? 0;
      if (!totals[dimension]) {
        totals[dimension] = {};
      }
      totals[dimension][label] = (totals[dimension][label] ?? 0) + revenue;
    }
    return totals;
  }, [rollup?.dimensions]);

  const dimensionVisitorTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    const dimensions = rollup?.dimensions ?? [];
    for (const entry of dimensions) {
      const dimension = entry.dimension;
      const label = entry.dimensionValue.trim() || "unknown";
      const visitorCount = toNumber(entry.visitors);
      const count =
        visitorCount > 0 ? visitorCount : toNumber(entry.pageviews ?? 0);
      if (!totals[dimension]) {
        totals[dimension] = {};
      }
      totals[dimension][label] = (totals[dimension][label] ?? 0) + count;
    }
    return totals;
  }, [rollup?.dimensions]);

  const dimensionGoalTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    const dimensions = rollup?.dimensions ?? [];
    for (const entry of dimensions) {
      const dimension = entry.dimension;
      const label = entry.dimensionValue.trim() || "unknown";
      const count = entry.goals ?? 0;
      if (!totals[dimension]) {
        totals[dimension] = {};
      }
      totals[dimension][label] = (totals[dimension][label] ?? 0) + count;
    }
    return totals;
  }, [rollup?.dimensions]);

  const dimensionSessionTotals = useMemo(() => {
    const totals: Record<string, Record<string, number>> = {};
    const dimensions = rollup?.dimensions ?? [];
    for (const entry of dimensions) {
      const dimension = entry.dimension;
      const label = entry.dimensionValue.trim() || "unknown";
      const count = entry.sessions ?? 0;
      if (!totals[dimension]) {
        totals[dimension] = {};
      }
      totals[dimension][label] = (totals[dimension][label] ?? 0) + count;
    }
    return totals;
  }, [rollup?.dimensions]);

  const topEntries = useMemo(
    () => ({
      topCountries: getTopEntries(dimensionVisitorTotals.country, 5),
      topRegions: getTopEntries(dimensionVisitorTotals.region, 5),
      topCities: getTopEntries(dimensionVisitorTotals.city, 5),
      topReferrers: getTopEntries(dimensionTotals.referrer_domain, 6),
      topSources: getTopEntries(dimensionTotals.utm_source, 6),
      topPages: getTopEntries(dimensionTotals.page, 8),
      topDevices: getTopEntries(dimensionTotals.device, 6),
      topBrowsers: getTopEntries(dimensionTotals.browser, 6),
    }),
    [dimensionTotals, dimensionVisitorTotals],
  );

  const visibleCountries = useMemo(
    () => filterUnknownEntries(topEntries.topCountries),
    [topEntries.topCountries],
  );
  const visibleRegions = useMemo(
    () => filterUnknownEntries(topEntries.topRegions),
    [topEntries.topRegions],
  );
  const visibleCities = useMemo(
    () => filterUnknownEntries(topEntries.topCities),
    [topEntries.topCities],
  );
  const visibleDevices = useMemo(
    () => filterUnknownEntries(topEntries.topDevices),
    [topEntries.topDevices],
  );
  const visibleBrowsers = useMemo(
    () => filterUnknownEntries(topEntries.topBrowsers),
    [topEntries.topBrowsers],
  );

  const geoPoints = useMemo(() => {
    const points = rollup?.geoPoints ?? [];
    const buckets = new Map<
      string,
      { lat: number; lng: number; count: number }
    >();
    for (const point of points) {
      if (
        typeof point.latitude !== "number" ||
        typeof point.longitude !== "number"
      ) {
        continue;
      }
      if (
        !Number.isFinite(point.latitude) ||
        !Number.isFinite(point.longitude)
      ) {
        continue;
      }
      const roundedLat = Math.round(point.latitude);
      const roundedLng = Math.round(point.longitude);
      const key = `${roundedLat}:${roundedLng}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      buckets.set(key, { lat: roundedLat, lng: roundedLng, count: 1 });
    }
    return Array.from(buckets.values());
  }, [rollup?.geoPoints]);

  const geoCountryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const entries = dimensionVisitorTotals.country ?? {};
    for (const [label, count] of Object.entries(entries)) {
      const normalized = normalizeCountryName(label);
      if (!normalized) {
        continue;
      }
      const key = getCountryLookupKey(normalized);
      if (!key) {
        continue;
      }
      totals[key] = (totals[key] ?? 0) + count;
    }
    return totals;
  }, [dimensionVisitorTotals.country]);

  const geoCountryRevenueTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const entries = dimensionRevenueTotals.country ?? {};
    for (const [label, count] of Object.entries(entries)) {
      const normalized = normalizeCountryName(label);
      if (!normalized) {
        continue;
      }
      const key = getCountryLookupKey(normalized);
      if (!key) {
        continue;
      }
      totals[key] = (totals[key] ?? 0) + count;
    }
    return totals;
  }, [dimensionRevenueTotals.country]);

  const geoCountryGoalTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const entries = dimensionGoalTotals.country ?? {};
    for (const [label, count] of Object.entries(entries)) {
      const normalized = normalizeCountryName(label);
      if (!normalized) {
        continue;
      }
      const key = getCountryLookupKey(normalized);
      if (!key) {
        continue;
      }
      totals[key] = (totals[key] ?? 0) + count;
    }
    return totals;
  }, [dimensionGoalTotals.country]);

  const geoCountrySessionTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const entries = dimensionSessionTotals.country ?? {};
    for (const [label, count] of Object.entries(entries)) {
      const normalized = normalizeCountryName(label);
      if (!normalized) {
        continue;
      }
      const key = getCountryLookupKey(normalized);
      if (!key) {
        continue;
      }
      totals[key] = (totals[key] ?? 0) + count;
    }
    return totals;
  }, [dimensionSessionTotals.country]);

  const geoDots = useMemo(() => {
    const maxCount = geoPoints.reduce(
      (max, point) => Math.max(max, point.count),
      0,
    );
    return geoPoints.map((point) => {
      const lat = clampNumber(point.lat, -90, 90);
      const lng = clampNumber(point.lng, -180, 180);
      const { x, y } = projectGeoPoint(lat, lng);
      const size = maxCount ? Math.round(2 + (point.count / maxCount) * 6) : 2;
      return { ...point, x, y, size };
    });
  }, [geoPoints]);

  return {
    dailyEntries,
    revenueTotals,
    sessionTotals,
    visitorsTotal,
    goalsTotal,
    conversionRate,
    revenuePerVisitor,
    bounceRate,
    avgSessionDurationMs,
    chartData,
    metricDeltas,
    dimensionTotals,
    dimensionVisitorTotals,
    dimensionSessionTotals,
    dimensionGoalTotals,
    dimensionRevenueTotals,
    topCountries: topEntries.topCountries,
    topRegions: topEntries.topRegions,
    topCities: topEntries.topCities,
    topReferrers: topEntries.topReferrers,
    topSources: topEntries.topSources,
    topPages: topEntries.topPages,
    topDevices: topEntries.topDevices,
    topBrowsers: topEntries.topBrowsers,
    visibleCountries,
    visibleRegions,
    visibleCities,
    visibleDevices,
    visibleBrowsers,
    geoDots,
    geoCountryTotals,
    geoCountryRevenueTotals,
    geoCountryGoalTotals,
    geoCountrySessionTotals,
  };
}
