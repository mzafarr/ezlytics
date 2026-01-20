"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { trpc } from "@/utils/trpc";
import { analyticsSamples } from "@/app/dashboard/analytics-samples";
import {
  type Filters,
  filterLabels,
  notSetLabel,
  directReferrerLabel,
  type AnalyticsSample,
  type VisitorSummary,
  type GoalSummary,
} from "../schema";
import {
  parseExclusionList,
  createWildcardMatcher,
  matchesAny,
  isDirectFilter,
  isNotSetFilter,
  buildDimensionCounts,
} from "../utils";

const rollupDimensions = [
  "page",
  "referrer_domain",
  "utm_source",
  "utm_campaign",
  "country",
  "region",
  "city",
  "device",
  "browser",
  "goal",
] as const;

interface UseDashboardDataProps {
  filters: Filters;
  exclusions: {
    pathPatterns: string;
    countries: string;
    hostnames: string;
    excludeSelf: boolean;
  };
  currentVisitorId?: string;
  primaryGoalName?: string;
}

export function useDashboardData({
  filters,
  exclusions,
  currentVisitorId,
  primaryGoalName = "",
}: UseDashboardDataProps) {
  const sites = useQuery(trpc.sites.list.queryOptions());
  const latestSite = sites.data?.[0];

  const rollupInput = latestSite?.id
    ? {
        siteId: latestSite.id,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      }
    : null;

  const rollupQuery = useQuery({
    ...trpc.analytics.rollups.queryOptions(rollupInput ?? { siteId: "" }),
    enabled: Boolean(rollupInput),
  });

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as Array<[keyof Filters, string]>)
      .map(([key, value]) => ({
        key,
        label: filterLabels[key],
        value: value.trim(),
      }))
      .filter(({ value }) => value.length > 0);
  }, [filters]);

  const hasNonDateFilters = activeFilters.some(
    ({ key }) => key !== "startDate" && key !== "endDate",
  );

  const hasRollupData = Boolean(
    rollupQuery.data?.daily?.length || rollupQuery.data?.dimensions?.length,
  );

  const useRollups = hasRollupData && !hasNonDateFilters;

  const filteredEvents = useMemo(() => {
    const normalized = {
      referrer: filters.referrer.trim().toLowerCase(),
      source: filters.source.trim().toLowerCase(),
      medium: filters.medium.trim().toLowerCase(),
      campaign: filters.campaign.trim().toLowerCase(),
      content: filters.content.trim().toLowerCase(),
      term: filters.term.trim().toLowerCase(),
      country: filters.country.trim().toLowerCase(),
      device: filters.device.trim().toLowerCase(),
      browser: filters.browser.trim().toLowerCase(),
      os: filters.os.trim().toLowerCase(),
      pagePath: filters.pagePath.trim().toLowerCase(),
      goalName: filters.goalName.trim().toLowerCase(),
    };
    const pathMatchers = parseExclusionList(exclusions.pathPatterns).map(
      createWildcardMatcher,
    );
    const countryMatchers = parseExclusionList(exclusions.countries).map(
      createWildcardMatcher,
    );
    const hostnameMatchers = parseExclusionList(exclusions.hostnames).map(
      createWildcardMatcher,
    );
    const excludeSelf = exclusions.excludeSelf && currentVisitorId;
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    return analyticsSamples.filter((event) => {
      // (Filtering Logic same as before...)
      if (excludeSelf && event.visitorId === currentVisitorId) {
        return false;
      }
      if (pathMatchers.length > 0 && matchesAny(event.path, pathMatchers)) {
        return false;
      }
      if (
        countryMatchers.length > 0 &&
        matchesAny(event.country, countryMatchers)
      ) {
        return false;
      }
      if (
        hostnameMatchers.length > 0 &&
        matchesAny(event.hostname, hostnameMatchers)
      ) {
        return false;
      }
      const eventDate = new Date(event.date);
      if (startDate && eventDate < startDate) {
        return false;
      }
      if (endDate && eventDate > endDate) {
        return false;
      }
      if (
        normalized.referrer &&
        !event.referrer.toLowerCase().includes(normalized.referrer)
      ) {
        if (isDirectFilter(normalized.referrer)) {
          if (event.referrer.trim()) {
            return false;
          }
        } else if (
          !event.referrer.toLowerCase().includes(normalized.referrer)
        ) {
          return false;
        }
      }
      if (normalized.source) {
        if (isNotSetFilter(normalized.source)) {
          if (event.source.trim()) {
            return false;
          }
        } else if (!event.source.toLowerCase().includes(normalized.source)) {
          return false;
        }
      }
      if (
        normalized.medium &&
        !event.medium.toLowerCase().includes(normalized.medium)
      ) {
        if (isNotSetFilter(normalized.medium)) {
          if (event.medium.trim()) {
            return false;
          }
        } else if (!event.medium.toLowerCase().includes(normalized.medium)) {
          return false;
        }
      }
      if (normalized.campaign) {
        if (isNotSetFilter(normalized.campaign)) {
          if (event.campaign.trim()) {
            return false;
          }
        } else if (
          !event.campaign.toLowerCase().includes(normalized.campaign)
        ) {
          return false;
        }
      }
      if (normalized.content) {
        if (isNotSetFilter(normalized.content)) {
          if (event.content.trim()) {
            return false;
          }
        } else if (!event.content.toLowerCase().includes(normalized.content)) {
          return false;
        }
      }
      if (normalized.term) {
        if (isNotSetFilter(normalized.term)) {
          if (event.term.trim()) {
            return false;
          }
        } else if (!event.term.toLowerCase().includes(normalized.term)) {
          return false;
        }
      }
      if (
        normalized.country &&
        !event.country.toLowerCase().includes(normalized.country)
      ) {
        return false;
      }
      if (
        normalized.device &&
        !event.device.toLowerCase().includes(normalized.device)
      ) {
        return false;
      }
      if (
        normalized.browser &&
        !event.browser.toLowerCase().includes(normalized.browser)
      ) {
        return false;
      }
      if (normalized.os && !event.os.toLowerCase().includes(normalized.os)) {
        return false;
      }
      if (
        normalized.pagePath &&
        !event.path.toLowerCase().includes(normalized.pagePath)
      ) {
        return false;
      }
      if (
        normalized.goalName &&
        !event.goal.toLowerCase().includes(normalized.goalName)
      ) {
        return false;
      }
      return true;
    });
  }, [filters, exclusions, currentVisitorId]);

  const rollupSummary = useMemo(() => {
    const totals = {
      visitors: 0,
      sessions: 0,
      pageviews: 0,
      goals: 0,
      revenue: 0,
    };
    const series = {
      pageviews: {} as Record<string, number>,
      visitors: {} as Record<string, number>,
      sessions: {} as Record<string, number>,
      goals: {} as Record<string, number>,
      revenue: {} as Record<string, number>,
    };
    const dimensions = rollupDimensions.reduce(
      (accumulator, dimension) => {
        accumulator[dimension] = {
          pageviews: {} as Record<string, number>,
          goals: {} as Record<string, number>,
          revenue: {} as Record<string, number>,
        };
        return accumulator;
      },
      {} as Record<
        (typeof rollupDimensions)[number],
        {
          pageviews: Record<string, number>;
          goals: Record<string, number>;
          revenue: Record<string, number>;
        }
      >,
    );
    const dimensionFallbacks: Record<
      (typeof rollupDimensions)[number],
      string
    > = {
      page: "/",
      referrer_domain: directReferrerLabel,
      utm_source: notSetLabel,
      utm_campaign: notSetLabel,
      country: "unknown",
      region: "unknown",
      city: "unknown",
      device: "unknown",
      browser: "unknown",
      goal: "unknown",
    };
    const toDateKey = (value: Date | string) =>
      typeof value === "string" ? value : value.toISOString().slice(0, 10);

    for (const entry of rollupQuery.data?.daily ?? []) {
      const dateKey = toDateKey(entry.date);
      totals.visitors += entry.visitors;
      totals.sessions += entry.sessions;
      totals.pageviews += entry.pageviews;
      totals.goals += entry.goals;
      totals.revenue += entry.revenue;
      series.pageviews[dateKey] =
        (series.pageviews[dateKey] ?? 0) + entry.pageviews;
      series.visitors[dateKey] =
        (series.visitors[dateKey] ?? 0) + entry.visitors;
      series.sessions[dateKey] =
        (series.sessions[dateKey] ?? 0) + entry.sessions;
      series.goals[dateKey] = (series.goals[dateKey] ?? 0) + entry.goals;
      series.revenue[dateKey] = (series.revenue[dateKey] ?? 0) + entry.revenue;
    }

    for (const entry of rollupQuery.data?.dimensions ?? []) {
      if (
        !rollupDimensions.includes(
          entry.dimension as (typeof rollupDimensions)[number],
        )
      ) {
        continue;
      }
      const dimension = entry.dimension as (typeof rollupDimensions)[number];
      const label =
        entry.dimensionValue.trim() || dimensionFallbacks[dimension];
      const bucket = dimensions[dimension];
      bucket.pageviews[label] =
        (bucket.pageviews[label] ?? 0) + entry.pageviews;
      bucket.goals[label] = (bucket.goals[label] ?? 0) + entry.goals;
      bucket.revenue[label] = (bucket.revenue[label] ?? 0) + entry.revenue;
    }

    return { totals, series, dimensions };
  }, [rollupQuery.data]);

  const pageviews = filteredEvents.filter(
    (event) => event.eventType === "pageview",
  );
  const goals = filteredEvents.filter((event) => event.eventType === "goal");

  const visitorsById = useMemo(() => {
    return filteredEvents.reduce<Record<string, VisitorSummary>>(
      (accumulator, event) => {
        const eventDate = new Date(event.date);
        const eventTimestamp = eventDate.getTime();
        const existing = accumulator[event.visitorId];
        if (!existing) {
          accumulator[event.visitorId] = {
            visitorId: event.visitorId,
            visitCount: 1,
            firstSeen: event.date,
            firstSeenAt: eventTimestamp,
            lastSeen: event.date,
            lastSeenAt: eventTimestamp,
            lastPath: event.path,
            lastReferrer: event.referrer,
            source: event.source,
            campaign: event.campaign,
            country: event.country,
            device: event.device,
            browser: event.browser,
            os: event.os,
            pageviews: event.eventType === "pageview" ? 1 : 0,
            goals: event.eventType === "goal" ? 1 : 0,
            revenue: event.revenue,
          };
          return accumulator;
        }
        if (eventTimestamp < existing.firstSeenAt) {
          existing.firstSeenAt = eventTimestamp;
          existing.firstSeen = event.date;
        }
        if (eventTimestamp > existing.lastSeenAt) {
          existing.lastSeenAt = eventTimestamp;
          existing.lastSeen = event.date;
          existing.lastPath = event.path;
          existing.lastReferrer = event.referrer;
          existing.source = event.source;
          existing.campaign = event.campaign;
          existing.country = event.country;
          existing.device = event.device;
          existing.browser = event.browser;
          existing.os = event.os;
        }
        if (event.eventType === "pageview") {
          existing.pageviews += 1;
        }
        if (event.eventType === "goal") {
          existing.goals += 1;
        }
        if (event.revenue) {
          existing.revenue += event.revenue;
        }
        existing.visitCount += 1;
        return accumulator;
      },
      {},
    );
  }, [filteredEvents]);

  const visitorsList = useMemo(
    () =>
      Object.values(visitorsById).sort((a, b) => b.lastSeenAt - a.lastSeenAt),
    [visitorsById],
  );

  // Aggregations
  const sessionKeys = pageviews.reduce((accumulator, event) => {
    accumulator.add(`${event.visitorId}-${event.date}`);
    return accumulator;
  }, new Set<string>());
  const sessionCount = sessionKeys.size;
  const totalRevenue = useRollups
    ? rollupSummary.totals.revenue
    : filteredEvents.reduce((sum, event) => sum + event.revenue, 0);
  const visitorsCount = useRollups
    ? rollupSummary.totals.visitors
    : visitorsList.length;
  const sessionTotal = useRollups
    ? rollupSummary.totals.sessions
    : sessionCount;
  const pageviewTotal = useRollups
    ? rollupSummary.totals.pageviews
    : pageviews.length;
  const revenuePerVisitor =
    visitorsCount === 0 ? 0 : totalRevenue / visitorsCount;

  const goalConversions = goals.filter((event) => event.goal);
  const conversionCount = goalConversions.length;
  const conversionRate =
    sessionCount === 0 ? 0 : (conversionCount / sessionCount) * 100;

  const goalSummaryByName = goalConversions.reduce<
    Record<
      string,
      {
        total: number;
        visitors: Set<string>;
        sources: Record<string, number>;
        pages: Record<string, number>;
      }
    >
  >((accumulator, event) => {
    const goalName = event.goal.trim();
    if (!goalName) {
      return accumulator;
    }
    const existing = accumulator[goalName] ?? {
      total: 0,
      visitors: new Set<string>(),
      sources: {},
      pages: {},
    };
    existing.total += 1;
    existing.visitors.add(event.visitorId);
    const sourceLabel = event.source.trim() || notSetLabel;
    existing.sources[sourceLabel] = (existing.sources[sourceLabel] ?? 0) + 1;
    const pageLabel = event.path.trim() || "/";
    existing.pages[pageLabel] = (existing.pages[pageLabel] ?? 0) + 1;
    accumulator[goalName] = existing;
    return accumulator;
  }, {});

  const rollupGoalSummaries: GoalSummary[] = Object.entries(
    rollupSummary.dimensions.goal.goals,
  )
    .map(([name, total]) => ({
      name,
      total,
      unique: total,
      conversionRate:
        rollupSummary.totals.sessions === 0
          ? 0
          : (total / rollupSummary.totals.sessions) * 100,
      sources: {},
      pages: {},
    }))
    .sort((a, b) => b.total - a.total);

  const goalSummaries: GoalSummary[] = useRollups
    ? rollupGoalSummaries
    : Object.entries(goalSummaryByName)
        .map(([name, summary]) => ({
          name,
          total: summary.total,
          unique: summary.visitors.size,
          conversionRate:
            sessionCount === 0 ? 0 : (summary.total / sessionCount) * 100,
          sources: summary.sources,
          pages: summary.pages,
        }))
        .sort((a, b) => b.total - a.total);

  const primaryGoal =
    goalSummaries.find((goal) => goal.name === primaryGoalName) ?? null;
  const primaryGoalLabel =
    primaryGoal?.name || primaryGoalName.trim() || "All goals";
  const primaryConversionCount = primaryGoal
    ? primaryGoal.total
    : primaryGoalName
      ? 0
      : useRollups
        ? rollupSummary.totals.goals
        : conversionCount;
  const baseConversionRate = useRollups
    ? rollupSummary.totals.sessions === 0
      ? 0
      : (rollupSummary.totals.goals / rollupSummary.totals.sessions) * 100
    : conversionRate;
  const primaryConversionRate = primaryGoal
    ? primaryGoal.conversionRate
    : primaryGoalName
      ? 0
      : baseConversionRate;

  // Series Data
  const pageviewsByDate = pageviews.reduce<Record<string, number>>(
    (accumulator, event) => {
      accumulator[event.date] = (accumulator[event.date] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  const visitorSetsByDate = pageviews.reduce<Record<string, Set<string>>>(
    (accumulator, event) => {
      const existing = accumulator[event.date] ?? new Set<string>();
      existing.add(event.visitorId);
      accumulator[event.date] = existing;
      return accumulator;
    },
    {},
  );
  const visitorsByDate = Object.entries(visitorSetsByDate).reduce<
    Record<string, number>
  >((accumulator, [date, set]) => {
    accumulator[date] = set.size;
    return accumulator;
  }, {});

  const visitorsByDateDisplay = useRollups
    ? rollupSummary.series.visitors
    : visitorsByDate;
  const pageviewsByDateDisplay = useRollups
    ? rollupSummary.series.pageviews
    : pageviewsByDate;

  const revenueByDate = useRollups
    ? rollupSummary.series.revenue
    : filteredEvents.reduce<Record<string, number>>((accumulator, event) => {
        if (!event.revenue) {
          return accumulator;
        }
        accumulator[event.date] =
          (accumulator[event.date] ?? 0) + event.revenue;
        return accumulator;
      }, {});

  const referrerCounts = useRollups
    ? rollupSummary.dimensions.referrer_domain.pageviews
    : buildDimensionCounts(pageviews, "referrer", directReferrerLabel);
  const sourceCounts = useRollups
    ? rollupSummary.dimensions.utm_source.pageviews
    : buildDimensionCounts(pageviews, "source", notSetLabel);
  const mediumCounts = buildDimensionCounts(pageviews, "medium", notSetLabel);
  const campaignCounts = useRollups
    ? rollupSummary.dimensions.utm_campaign.pageviews
    : buildDimensionCounts(pageviews, "campaign", notSetLabel);
  const contentCounts = buildDimensionCounts(pageviews, "content", notSetLabel);
  const termCounts = buildDimensionCounts(pageviews, "term", notSetLabel);

  return {
    useRollups,
    rollupSummary,
    filteredEvents,
    pageviews,
    goals,
    visitorsList,
    visitorsById,
    rollupQuery,
    sites,
    latestSite,
    // Aggregates
    visitorsCount,
    sessionTotal,
    pageviewTotal,
    totalRevenue,
    revenuePerVisitor,
    goalSummaries,
    primaryGoal,
    primaryGoalLabel,
    primaryConversionCount,
    primaryConversionRate,
    // Series
    visitorsByDateDisplay,
    pageviewsByDateDisplay,
    revenueByDate,
    chartSeries: {
      pageviews: pageviewsByDateDisplay,
      visitors: visitorsByDateDisplay,
      revenue: revenueByDate,
    },
    // Breakdowns
    referrerCounts,
    sourceCounts,
    mediumCounts,
    campaignCounts,
    contentCounts,
    termCounts,
    pageviewsByPathDisplay: contentCounts, // Mapping content/path to display
  };
}
