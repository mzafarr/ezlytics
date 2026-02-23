"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/utils/trpc";

import { DashboardOverviewView } from "./_components/overview-view";
import { DashboardSitesList } from "./_components/sites-list-view";
import {
  DashboardEmptyState,
  DashboardFunnelsView,
  DashboardLoadingState,
  DashboardSettingsView,
} from "./_components/site-views";
import { type RollupTotals } from "./dashboard-helpers";
import {
  TEST_CHART_DATA,
  TEST_STATS_DATA,
  TEST_TOP_REFERRERS,
  TEST_TOP_SOURCES,
  TEST_TOP_PAGES,
  TEST_TOP_COUNTRIES,
  TEST_TOP_REGIONS,
  TEST_TOP_CITIES,
  TEST_TOP_DEVICES,
  TEST_TOP_BROWSERS,
  TEST_DIMENSION_VISITOR_TOTALS,
  TEST_DIMENSION_REVENUE_TOTALS,
  TEST_GEO_COUNTRY_TOTALS,
  TEST_GEO_COUNTRY_REVENUE_TOTALS,
  TEST_GEO_COUNTRY_GOAL_TOTALS,
  TEST_GEO_COUNTRY_SESSION_TOTALS,
} from "./test-data";
import {
  type DashboardChartGranularity,
  type DashboardDateRangeKey,
  resolveDashboardUtcDateRange,
} from "./overview-time-range";
import { useDashboardOverviewData } from "./use-dashboard-overview-data";

export type DashboardView = "overview" | "settings" | "funnels";

type TestDataButtonProps = {
  useTestData: boolean;
  onToggle: () => void;
};

function TestDataButton({ useTestData, onToggle }: TestDataButtonProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant={useTestData ? "default" : "outline"}
        size="sm"
        onClick={onToggle}
        className={
          useTestData ? "bg-amber-500 hover:bg-amber-600 text-black" : ""
        }
      >
        <FlaskConical className="h-4 w-4 mr-2" />
        {useTestData ? "Test Data ON" : "Test Data"}
      </Button>
    </div>
  );
}

type DashboardProps = {
  siteId?: string;
  view?: DashboardView;
};

export default function Dashboard({
  siteId,
  view = "overview",
}: DashboardProps) {
  const sitesQuery = useQuery(trpc.sites.list.queryOptions());
  const sites = sitesQuery.data ?? [];
  const siteSummaryQuery = useQuery({
    ...trpc.sites.summary.queryOptions(),
    enabled: sitesQuery.isSuccess,
  });

  const [activeDeviceTab, setActiveDeviceTab] = useState<"device" | "browser">(
    "device",
  );
  const [activeGeoTab, setActiveGeoTab] = useState<
    "map" | "country" | "region" | "city"
  >("map");
  const [geoSortBy, setGeoSortBy] = useState<"visitors" | "revenue">(
    "visitors",
  );
  const [showVisitorsSeries, setShowVisitorsSeries] = useState(true);
  const [showRevenueSeries, setShowRevenueSeries] = useState(true);
  const [useTestData, setUseTestData] = useState(false);
  const [dateRangeKey, setDateRangeKey] =
    useState<DashboardDateRangeKey>("last30Days");
  const [chartGranularity, setChartGranularity] =
    useState<DashboardChartGranularity>("daily");

  const selectedRange = resolveDashboardUtcDateRange(dateRangeKey);

  const activeRollupCoreQuery = useQuery({
    ...trpc.analytics.rollups.queryOptions({
      siteId: siteId ?? "",
      startDate: selectedRange.startDate,
      endDate: selectedRange.endDate,
      includeDaily: true,
      includeDimensions: false,
      includeGeoPoints: false,
      includeRangeVisitors: false,
    }),
    enabled: Boolean(siteId),
    placeholderData: (previousData) => previousData,
  });
  const activeRollupDimensionsQuery = useQuery({
    ...trpc.analytics.rollups.queryOptions({
      siteId: siteId ?? "",
      startDate: selectedRange.startDate,
      endDate: selectedRange.endDate,
      includeDaily: false,
      includeDimensions: true,
      includeGeoPoints: false,
      includeRangeVisitors: false,
      dimensionLimit: 12,
    }),
    enabled: Boolean(siteId),
    placeholderData: (previousData) => previousData,
  });
  const activeRollupGeoQuery = useQuery({
    ...trpc.analytics.rollups.queryOptions({
      siteId: siteId ?? "",
      startDate: selectedRange.startDate,
      endDate: selectedRange.endDate,
      includeDaily: false,
      includeDimensions: false,
      includeGeoPoints: true,
      includeRangeVisitors: false,
      geoPointLimit: 300,
    }),
    enabled: Boolean(siteId),
    placeholderData: (previousData) => previousData,
  });
  const kpiSnapshotInput =
    dateRangeKey === "last24Hours"
      ? {
          siteId: siteId ?? "",
          rangePreset: "last24Hours" as const,
        }
      : {
          siteId: siteId ?? "",
          startDate: selectedRange.startDate,
          endDate: selectedRange.endDate,
        };
  const kpiSnapshotQuery = useQuery({
    ...trpc.analytics.kpiSnapshot.queryOptions(kpiSnapshotInput),
    enabled: Boolean(siteId),
    placeholderData: (previousData) => previousData,
    refetchInterval: siteId ? 10_000 : false,
  });

  const activeRollupData = useMemo(
    () => ({
      daily: activeRollupCoreQuery.data?.daily ?? [],
      dimensions: activeRollupDimensionsQuery.data?.dimensions ?? [],
      geoPoints: activeRollupGeoQuery.data?.geoPoints ?? [],
      rangeVisitors: kpiSnapshotQuery.data?.visitors ?? 0,
    }),
    [
      activeRollupCoreQuery.data?.daily,
      activeRollupDimensionsQuery.data?.dimensions,
      activeRollupGeoQuery.data?.geoPoints,
      kpiSnapshotQuery.data?.visitors,
    ],
  );

  const overviewData = useDashboardOverviewData(activeRollupData, {
    range: {
      startDate: selectedRange.startDate,
      endDate: selectedRange.endDate,
    },
    granularity: chartGranularity,
  });

  const isLoading =
    sitesQuery.isLoading ||
    siteSummaryQuery.isLoading ||
    (activeRollupCoreQuery.isLoading && !activeRollupCoreQuery.data) ||
    (kpiSnapshotQuery.isLoading && !kpiSnapshotQuery.data);
  const isRefreshing =
    activeRollupCoreQuery.isFetching ||
    activeRollupDimensionsQuery.isFetching ||
    activeRollupGeoQuery.isFetching ||
    kpiSnapshotQuery.isFetching;
  const activeSite = siteId ? sites.find((site) => site.id === siteId) : null;
  const activeSiteTotals = siteId ? siteSummaryQuery.data?.[siteId] : null;
  const hasEvents =
    (kpiSnapshotQuery.data?.visitors ?? activeSiteTotals?.visitors ?? 0) > 0;
  const showEmptyState = Boolean(
    siteId && activeSite && !isLoading && !hasEvents,
  );

  const handleToggleTestData = () => setUseTestData((prev) => !prev);

  // When test mode is enabled, show test data immediately without any API calls
  if (useTestData && siteId) {
    return (
      <>
        <TestDataButton useTestData={useTestData} onToggle={handleToggleTestData} />
        <DashboardOverviewView
          siteName={activeSite?.name ?? ""}
          siteDomain={activeSite?.domain ?? ""}
          statsData={TEST_STATS_DATA}
          chartData={TEST_CHART_DATA}
          topReferrers={TEST_TOP_REFERRERS}
          topSources={TEST_TOP_SOURCES}
          topPages={TEST_TOP_PAGES}
          visibleCountries={TEST_TOP_COUNTRIES}
          visibleRegions={TEST_TOP_REGIONS}
          visibleCities={TEST_TOP_CITIES}
          visibleDevices={TEST_TOP_DEVICES}
          visibleBrowsers={TEST_TOP_BROWSERS}
          dimensionVisitorTotals={TEST_DIMENSION_VISITOR_TOTALS}
          dimensionRevenueTotals={TEST_DIMENSION_REVENUE_TOTALS}
          geoCountryTotals={TEST_GEO_COUNTRY_TOTALS}
          geoCountryRevenueTotals={TEST_GEO_COUNTRY_REVENUE_TOTALS}
          geoCountryGoalTotals={TEST_GEO_COUNTRY_GOAL_TOTALS}
          geoCountrySessionTotals={TEST_GEO_COUNTRY_SESSION_TOTALS}
          activeDeviceTab={activeDeviceTab}
          onDeviceTabChange={(tab) => setActiveDeviceTab(tab)}
          activeGeoTab={activeGeoTab}
          onGeoTabChange={(tab) => setActiveGeoTab(tab)}
          geoSortBy={geoSortBy}
          onGeoSortChange={(sort) => setGeoSortBy(sort)}
          showVisitorsSeries={showVisitorsSeries}
          showRevenueSeries={showRevenueSeries}
          onToggleVisitors={() => setShowVisitorsSeries((current) => !current)}
          onToggleRevenue={() => setShowRevenueSeries((current) => !current)}
          dateRangeKey={dateRangeKey}
          onDateRangeChange={setDateRangeKey}
          chartGranularity={chartGranularity}
          onChartGranularityChange={setChartGranularity}
          selectedRangeLabel={selectedRange.label}
          isRefreshing={isRefreshing}
        />
      </>
    );
  }

  if (siteId) {
    if (isLoading || !activeSite) {
      return (
        <>
          <TestDataButton useTestData={useTestData} onToggle={handleToggleTestData} />
          <DashboardLoadingState />
        </>
      );
    }

    if (view === "settings") {
      return (
        <>
          <TestDataButton useTestData={useTestData} onToggle={handleToggleTestData} />
          <DashboardSettingsView site={activeSite} />
        </>
      );
    }

    if (view === "funnels") {
      return (
        <>
          <TestDataButton useTestData={useTestData} onToggle={handleToggleTestData} />
          <DashboardFunnelsView site={activeSite} />
        </>
      );
    }

    if (showEmptyState) {
      return (
        <>
          <TestDataButton useTestData={useTestData} onToggle={handleToggleTestData} />
          <DashboardEmptyState site={activeSite} siteId={siteId} />
        </>
      );
    }

    const statsData = {
      visitorsCount: kpiSnapshotQuery.data?.visitors ?? overviewData.visitorsTotal,
      visitorsNowCount: kpiSnapshotQuery.data?.visitorsNow ?? 0,
      totalRevenue: overviewData.revenueTotals.total,
      primaryConversionRate: overviewData.conversionRate,
      revenuePerVisitor: overviewData.revenuePerVisitor,
      bounceRate: overviewData.bounceRate,
      avgSessionDurationMs: overviewData.avgSessionDurationMs,
      deltas: overviewData.metricDeltas ?? undefined,
    };

    return (
      <>
        <TestDataButton useTestData={useTestData} onToggle={handleToggleTestData} />
        <DashboardOverviewView
          siteName={activeSite.name}
          siteDomain={activeSite.domain}
          statsData={statsData}
          chartData={overviewData.chartData}
          topReferrers={overviewData.topReferrers}
          topSources={overviewData.topSources}
          topPages={overviewData.topPages}
          visibleCountries={overviewData.visibleCountries}
          visibleRegions={overviewData.visibleRegions}
          visibleCities={overviewData.visibleCities}
          visibleDevices={overviewData.visibleDevices}
          visibleBrowsers={overviewData.visibleBrowsers}
          dimensionVisitorTotals={overviewData.dimensionVisitorTotals}
          dimensionRevenueTotals={overviewData.dimensionRevenueTotals}
          geoCountryTotals={overviewData.geoCountryTotals}
          geoCountryRevenueTotals={overviewData.geoCountryRevenueTotals}
          geoCountryGoalTotals={overviewData.geoCountryGoalTotals}
          geoCountrySessionTotals={overviewData.geoCountrySessionTotals}
          activeDeviceTab={activeDeviceTab}
          onDeviceTabChange={(tab) => setActiveDeviceTab(tab)}
          activeGeoTab={activeGeoTab}
          onGeoTabChange={(tab) => setActiveGeoTab(tab)}
          geoSortBy={geoSortBy}
          onGeoSortChange={(sort) => setGeoSortBy(sort)}
          showVisitorsSeries={showVisitorsSeries}
          showRevenueSeries={showRevenueSeries}
          onToggleVisitors={() => setShowVisitorsSeries((current) => !current)}
          onToggleRevenue={() => setShowRevenueSeries((current) => !current)}
          dateRangeKey={dateRangeKey}
          onDateRangeChange={setDateRangeKey}
          chartGranularity={chartGranularity}
          onChartGranularityChange={setChartGranularity}
          selectedRangeLabel={selectedRange.label}
          isRefreshing={isRefreshing}
        />
      </>
    );
  }

  return (
    <DashboardSitesList
      sites={sites}
      rollupTotals={siteSummaryQuery.data as Record<string, RollupTotals> | undefined}
      isLoading={isLoading}
    />
  );
}
