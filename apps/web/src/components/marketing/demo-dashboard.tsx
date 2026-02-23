"use client";

import { useState } from "react";
import { DashboardOverviewView } from "@/app/dashboard/_components/overview-view";
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
} from "@/app/dashboard/test-data";
import {
  type DashboardChartGranularity,
  type DashboardDateRangeKey,
  resolveDashboardUtcDateRange,
} from "@/app/dashboard/overview-time-range";

export function DemoDashboard() {
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
  const [dateRangeKey, setDateRangeKey] =
    useState<DashboardDateRangeKey>("last30Days");
  const [chartGranularity, setChartGranularity] =
    useState<DashboardChartGranularity>("daily");

  const selectedRange = resolveDashboardUtcDateRange(dateRangeKey);

  return (
    <div className="p-6">
      <DashboardOverviewView
        siteName="Acme Corp"
        siteDomain="acmecorp.com"
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
        onDeviceTabChange={setActiveDeviceTab}
        activeGeoTab={activeGeoTab}
        onGeoTabChange={setActiveGeoTab}
        geoSortBy={geoSortBy}
        onGeoSortChange={setGeoSortBy}
        showVisitorsSeries={showVisitorsSeries}
        showRevenueSeries={showRevenueSeries}
        onToggleVisitors={() => setShowVisitorsSeries((v) => !v)}
        onToggleRevenue={() => setShowRevenueSeries((v) => !v)}
        dateRangeKey={dateRangeKey}
        onDateRangeChange={setDateRangeKey}
        chartGranularity={chartGranularity}
        onChartGranularityChange={setChartGranularity}
        selectedRangeLabel={selectedRange.label}
        isRefreshing={false}
      />
    </div>
  );
}
