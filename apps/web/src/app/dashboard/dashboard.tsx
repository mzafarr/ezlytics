"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { queryClient, trpc } from "@/utils/trpc";

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
import { useDashboardOverviewData } from "./use-dashboard-overview-data";

export type DashboardView = "overview" | "settings" | "funnels";

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
  const siteIds = useMemo(() => sites.map((site) => site.id), [sites]);

  const rollupQueries = useQuery({
    queryKey: ["dashboard-rollups", siteIds],
    queryFn: async () => {
      if (siteIds.length === 0) {
        return {};
      }
      const results = await Promise.all(
        siteIds.map((siteId) =>
          queryClient
            .fetchQuery(trpc.analytics.rollups.queryOptions({ siteId }))
            .then((rollup) => ({
              siteId,
              rollup,
            })),
        ),
      );
      return results.reduce<Record<string, RollupTotals>>(
        (accumulator, entry) => {
          const totals = entry.rollup.daily.reduce(
            (summary, day) => ({
              visitors: summary.visitors + day.visitors,
            }),
            { visitors: 0 },
          );
          accumulator[entry.siteId] = totals;
          return accumulator;
        },
        {},
      );
    },
    enabled: siteIds.length > 0,
  });

  const activeRollupQuery = useQuery({
    ...trpc.analytics.rollups.queryOptions({ siteId: siteId ?? "" }),
    enabled: Boolean(siteId),
  });
  const visitorsNowQuery = useQuery({
    ...trpc.analytics.visitorsNow.queryOptions({ siteId: siteId ?? "" }),
    enabled: Boolean(siteId),
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

  const overviewData = useDashboardOverviewData(activeRollupQuery.data);

  const isLoading =
    sitesQuery.isLoading ||
    rollupQueries.isLoading ||
    activeRollupQuery.isLoading ||
    visitorsNowQuery.isLoading;
  const activeSite = siteId ? sites.find((site) => site.id === siteId) : null;
  const activeSiteTotals = siteId ? rollupQueries.data?.[siteId] : null;
  const hasEvents = (activeSiteTotals?.visitors ?? 0) > 0;
  const showEmptyState = Boolean(
    siteId && activeSite && !isLoading && !hasEvents,
  );

  // Test Data Button component
  const TestDataButton = () => (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant={useTestData ? "default" : "outline"}
        size="sm"
        onClick={() => setUseTestData((prev) => !prev)}
        className={
          useTestData ? "bg-amber-500 hover:bg-amber-600 text-black" : ""
        }
      >
        <FlaskConical className="h-4 w-4 mr-2" />
        {useTestData ? "Test Data ON" : "Test Data"}
      </Button>
    </div>
  );

  // When test mode is enabled, show test data immediately without any API calls
  if (useTestData && siteId) {
    return (
      <>
        <TestDataButton />
        <DashboardOverviewView
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
        />
      </>
    );
  }

  if (siteId) {
    if (isLoading || !activeSite) {
      return (
        <>
          <TestDataButton />
          <DashboardLoadingState />
        </>
      );
    }

    if (view === "settings") {
      return (
        <>
          <TestDataButton />
          <DashboardSettingsView site={activeSite} />
        </>
      );
    }

    if (view === "funnels") {
      return (
        <>
          <TestDataButton />
          <DashboardFunnelsView site={activeSite} />
        </>
      );
    }

    if (showEmptyState) {
      return (
        <>
          <TestDataButton />
          <DashboardEmptyState site={activeSite} siteId={siteId} />
        </>
      );
    }

    const statsData = {
      visitorsCount: overviewData.visitorsTotal,
      visitorsNowCount: visitorsNowQuery.data?.count ?? 0,
      totalRevenue: overviewData.revenueTotals.total,
      primaryConversionRate: overviewData.conversionRate,
      revenuePerVisitor: overviewData.revenuePerVisitor,
      bounceRate: overviewData.bounceRate,
      avgSessionDurationMs: overviewData.avgSessionDurationMs,
      deltas: overviewData.metricDeltas ?? undefined,
    };

    return (
      <>
        <TestDataButton />
        <DashboardOverviewView
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
        />
      </>
    );
  }

  return (
    <DashboardSitesList
      sites={sites}
      rollupTotals={rollupQueries.data}
      isLoading={isLoading}
    />
  );
}
