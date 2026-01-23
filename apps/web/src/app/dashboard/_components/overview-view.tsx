"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

import { BreakdownCard } from "@/components/dashboard/breakdown-card";
import { MainChart } from "@/components/dashboard/main-chart";
import { StatsRow } from "@/components/dashboard/stats-row";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  formatDimensionLabel,
  formatGeoLabel,
  getCountryLookupKey,
  MAP_HEIGHT,
  MAP_WIDTH,
  normalizeCountryName,
} from "../dashboard-helpers";
import type {
  ChartDatum,
  DashboardOverviewData,
} from "../use-dashboard-overview-data";

type StatsData = {
  visitorsCount: number;
  visitorsNowCount: number;
  totalRevenue: number;
  primaryConversionRate: number;
  revenuePerVisitor: number;
  bounceRate: number;
  avgSessionDurationMs: number;
  deltas?: DashboardOverviewData["metricDeltas"];
};

type BreakdownEntry = Array<[string, number]>;

type GeoDimensionTotals = Record<string, Record<string, number>>;
type GeoCountryTotals = Record<string, number>;

type DashboardOverviewViewProps = {
  statsData: StatsData;
  chartData: ChartDatum[];
  topReferrers: BreakdownEntry;
  topSources: BreakdownEntry;
  topPages: BreakdownEntry;
  visibleCountries: BreakdownEntry;
  visibleDevices: BreakdownEntry;
  visibleBrowsers: BreakdownEntry;
  visibleRegions: BreakdownEntry;
  visibleCities: BreakdownEntry;
  dimensionVisitorTotals: GeoDimensionTotals;
  dimensionRevenueTotals: GeoDimensionTotals;
  geoCountryTotals: GeoCountryTotals;
  geoCountryRevenueTotals: GeoCountryTotals;
  geoCountryGoalTotals: GeoCountryTotals;
  geoCountrySessionTotals: GeoCountryTotals;
  activeDeviceTab: "device" | "browser";
  onDeviceTabChange: (tab: "device" | "browser") => void;
  activeGeoTab: "map" | "country" | "region" | "city";
  onGeoTabChange: (tab: "map" | "country" | "region" | "city") => void;
  geoSortBy: "visitors" | "revenue";
  onGeoSortChange: (sort: "visitors" | "revenue") => void;
  showVisitorsSeries: boolean;
  showRevenueSeries: boolean;
  onToggleVisitors: () => void;
  onToggleRevenue: () => void;
};

const GEO_TABS = [
  { value: "map", label: "Map" },
  { value: "country", label: "Country" },
  { value: "region", label: "Region" },
  { value: "city", label: "City" },
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyDetailFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function DashboardOverviewView({
  statsData,
  chartData,
  topReferrers,
  topSources,
  topPages,
  visibleCountries,
  visibleRegions,
  visibleCities,
  visibleDevices,
  visibleBrowsers,
  dimensionVisitorTotals,
  dimensionRevenueTotals,
  geoCountryTotals,
  geoCountryRevenueTotals,
  geoCountryGoalTotals,
  geoCountrySessionTotals,
  activeDeviceTab,
  onDeviceTabChange,
  activeGeoTab,
  onGeoTabChange,
  geoSortBy,
  onGeoSortChange,
  showVisitorsSeries,
  showRevenueSeries,
  onToggleVisitors,
  onToggleRevenue,
}: DashboardOverviewViewProps) {
  const hasUtmSources = topSources.some(
    ([label]) => label.trim().toLowerCase() !== "not set",
  );
  const channelEntries =
    topSources.length > 0 && hasUtmSources ? topSources : topReferrers;
  const channelTotal = channelEntries.reduce((sum, [, count]) => sum + count, 0);
  const channelItems = channelEntries.map(([label, count]) => ({
    label: formatDimensionLabel(label),
    value: count.toLocaleString(),
    count,
    percentage: channelTotal === 0 ? 0 : (count / channelTotal) * 100,
  }));

  const activeDeviceEntries =
    activeDeviceTab === "device" ? visibleDevices : visibleBrowsers;
  const activeDeviceTotal = activeDeviceEntries.reduce(
    (sum, [, count]) => sum + count,
    0,
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredGeo, setHoveredGeo] = useState<{
    key: string;
    label: string;
    visitors: number;
    revenue: number;
    conversionRate: number;
    revenuePerVisitor: number;
    x: number;
    y: number;
  } | null>(null);

  const listDimension = activeGeoTab === "map" ? "country" : activeGeoTab;
  const geoListEntries = useMemo(() => {
    const visitorTotals = dimensionVisitorTotals[listDimension] ?? {};
    const revenueTotals = dimensionRevenueTotals[listDimension] ?? {};
    const labels = new Set([
      ...Object.keys(visitorTotals),
      ...Object.keys(revenueTotals),
    ]);
    let entries = Array.from(labels).map((label) => ({
      label,
      visitors: visitorTotals[label] ?? 0,
      revenue: revenueTotals[label] ?? 0,
    }));

    if (entries.length === 0) {
      const fallback =
        listDimension === "country"
          ? visibleCountries
          : listDimension === "region"
            ? visibleRegions
            : visibleCities;
      entries = fallback.map(([label, count]) => ({
        label,
        visitors: count,
        revenue: 0,
      }));
    }
    const filtered = entries.filter((entry) => {
      const normalized = entry.label.trim().toLowerCase();
      return normalized.length > 0 && normalized !== "unknown";
    });
    const sorted = filtered.sort((left, right) => {
      const leftValue = geoSortBy === "revenue" ? left.revenue : left.visitors;
      const rightValue = geoSortBy === "revenue" ? right.revenue : right.visitors;
      return rightValue - leftValue;
    });
    return sorted.slice(0, 6);
  }, [
    dimensionVisitorTotals,
    dimensionRevenueTotals,
    geoSortBy,
    listDimension,
    visibleCities,
    visibleCountries,
    visibleRegions,
  ]);

  const geoTotals =
    geoSortBy === "revenue" ? geoCountryRevenueTotals : geoCountryTotals;
  const geoMaxValue = useMemo(() => {
    const values = Object.values(geoTotals);
    return values.length === 0 ? 0 : Math.max(...values);
  }, [geoTotals]);

  const hasGeoListData = geoListEntries.length > 0;
  const hasGeoMapData =
    Object.keys(geoCountryTotals).length > 0 ||
    Object.keys(geoCountryRevenueTotals).length > 0;
  const hasGeoData = activeGeoTab === "map" ? hasGeoMapData : hasGeoListData;

  const geoSortLabel = geoSortBy === "revenue" ? "Revenue" : "Visitors";
  const geoDescription =
    activeGeoTab === "map"
      ? `Top countries based on ${geoSortLabel.toLowerCase()}.`
      : `Ranked by ${geoSortLabel.toLowerCase()}.`;
  const geoEmptyMessage =
    activeGeoTab === "map"
      ? "No geo data yet. Collect more visits to see the map."
      : "No geo data yet.";

  const getGeoFill = (value: number) => {
    if (!value || geoMaxValue === 0) {
      return { fill: "hsl(var(--muted))", opacity: 0.35 };
    }
    const intensity = value / geoMaxValue;
    const opacity = 0.2 + intensity * 0.7;
    return { fill: "hsl(var(--primary))", opacity };
  };

  const getGeoLabel = (rawName: string) => {
    const normalized = normalizeCountryName(rawName);
    return normalized || rawName || "Unknown";
  };

  const getGeoKey = (rawName: string) =>
    getCountryLookupKey(getGeoLabel(rawName));

  const getTooltipPosition = (event: MouseEvent) => {
    const bounds = mapContainerRef.current?.getBoundingClientRect();
    if (!bounds) {
      return { x: 0, y: 0 };
    }
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const handleGeoEnter = (
    geoName: string,
    event: MouseEvent<SVGPathElement>,
  ) => {
    const label = getGeoLabel(geoName);
    const key = getGeoKey(geoName);
    const visitors = geoCountryTotals[key] ?? 0;
    const revenue = geoCountryRevenueTotals[key] ?? 0;
    const goals = geoCountryGoalTotals[key] ?? 0;
    const sessions = geoCountrySessionTotals[key] ?? 0;
    const conversionRate =
      sessions === 0 ? 0 : (goals / sessions) * 100;
    const revenuePerVisitor =
      visitors === 0 ? 0 : revenue / visitors;
    const position = getTooltipPosition(event);
    setHoveredGeo({
      key,
      label,
      visitors,
      revenue,
      conversionRate,
      revenuePerVisitor,
      ...position,
    });
  };

  const handleGeoMove = (event: MouseEvent<SVGPathElement>) => {
    setHoveredGeo((current) => {
      if (!current) {
        return current;
      }
      const position = getTooltipPosition(event);
      return { ...current, ...position };
    });
  };

  const tooltipStyle = useMemo(() => {
    if (!hoveredGeo) {
      return null;
    }
    const bounds = mapContainerRef.current?.getBoundingClientRect();
    const width = bounds?.width ?? 0;
    const height = bounds?.height ?? 0;
    const padding = 12;
    const tooltipWidth = 220;
    const tooltipHeight = 120;
    const maxLeft = width
      ? Math.max(padding, width - tooltipWidth - padding)
      : hoveredGeo.x + padding;
    const maxTop = height
      ? Math.max(padding, height - tooltipHeight - padding)
      : hoveredGeo.y + padding;
    const left = width
      ? Math.min(hoveredGeo.x + padding, maxLeft)
      : hoveredGeo.x + padding;
    const top = height
      ? Math.min(hoveredGeo.y + padding, maxTop)
      : hoveredGeo.y + padding;
    return { left, top };
  }, [hoveredGeo]);

  return (
    <div className="flex flex-col gap-6">
      <StatsRow
        dashboardData={statsData as any}
        controls={{
          showVisitors: showVisitorsSeries,
          showRevenue: showRevenueSeries,
          onToggleVisitors,
          onToggleRevenue,
        }}
      />
      <MainChart
        data={chartData}
        showVisitors={showVisitorsSeries}
        showRevenue={showRevenueSeries}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <BreakdownCard
          title="Channels"
          items={channelItems}
          metricLabel="Pageviews"
          className="h-full"
        />
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Geo distribution</CardTitle>
                <CardDescription>{geoDescription}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sort by</span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={geoSortBy === "visitors" ? "default" : "outline"}
                    onClick={() => onGeoSortChange("visitors")}
                  >
                    Visitors
                  </Button>
                  <Button
                    size="sm"
                    variant={geoSortBy === "revenue" ? "default" : "outline"}
                    onClick={() => onGeoSortChange("revenue")}
                  >
                    Revenue
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {GEO_TABS.map((tab) => (
                <Button
                  key={tab.value}
                  size="sm"
                  variant={activeGeoTab === tab.value ? "default" : "outline"}
                  onClick={() => onGeoTabChange(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasGeoData ? (
              <p className="text-sm text-muted-foreground">
                {geoEmptyMessage}
              </p>
            ) : activeGeoTab === "map" ? (
              <>
                <div
                  ref={mapContainerRef}
                  className="relative h-64 w-full overflow-hidden rounded-md border bg-muted/20"
                  onMouseLeave={() => setHoveredGeo(null)}
                >
                  <ComposableMap
                    width={MAP_WIDTH}
                    height={MAP_HEIGHT}
                    className="h-full w-full"
                  >
                    <Geographies geography="/world-countries-110m.json">
                      {({ geographies }: { geographies: Array<{ rsmKey: string; properties?: { name?: string | null } | null }> }) =>
                        geographies.map((geo) => {
                          const geoName = String(geo.properties?.name ?? "");
                          const lookupKey = getGeoKey(geoName);
                          const value = geoTotals[lookupKey] ?? 0;
                          const { fill, opacity } = getGeoFill(value);
                          const isActive = hoveredGeo?.key === lookupKey;
                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={fill}
                              opacity={
                                isActive ? Math.min(1, opacity + 0.15) : opacity
                              }
                              stroke="hsl(var(--border))"
                              strokeWidth={isActive ? 1 : 0.5}
                              onMouseEnter={(event: MouseEvent<SVGPathElement>) =>
                                handleGeoEnter(geoName, event)
                              }
                              onMouseMove={handleGeoMove}
                              onMouseLeave={() => setHoveredGeo(null)}
                              style={{
                                default: { outline: "none" },
                                hover: { outline: "none" },
                                pressed: { outline: "none" },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>
                  </ComposableMap>
                  {hoveredGeo && tooltipStyle ? (
                    <div
                      className="pointer-events-none absolute z-10 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
                      style={tooltipStyle}
                    >
                      <div className="text-sm font-semibold text-foreground">
                        {hoveredGeo.label}
                      </div>
                      <div className="mt-2 space-y-1 text-muted-foreground">
                        <div className="flex items-center justify-between gap-4">
                          <span>Visitors</span>
                          <span className="font-mono text-foreground">
                            {hoveredGeo.visitors.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Revenue</span>
                          <span className="font-mono text-foreground">
                            {currencyFormatter.format(hoveredGeo.revenue)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Rev / visitor</span>
                          <span className="font-mono text-foreground">
                            {currencyDetailFormatter.format(
                              hoveredGeo.revenuePerVisitor,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span>Conversion</span>
                          <span className="font-mono text-foreground">
                            {hoveredGeo.conversionRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-2 text-sm">
                  {geoListEntries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No country totals yet.
                    </div>
                  ) : (
                    geoListEntries.map((entry) => {
                      const value =
                        geoSortBy === "revenue"
                          ? currencyFormatter.format(entry.revenue)
                          : entry.visitors.toLocaleString();
                      return (
                        <div
                          key={entry.label}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="text-muted-foreground truncate">
                            {formatGeoLabel(entry.label)}
                          </span>
                          <span className="font-mono text-foreground">
                            {value}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-2 text-sm">
                {geoListEntries.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No geo totals yet.
                  </div>
                ) : (
                  geoListEntries.map((entry) => {
                    const value =
                      geoSortBy === "revenue"
                        ? currencyFormatter.format(entry.revenue)
                        : entry.visitors.toLocaleString();
                    const label =
                      listDimension === "country"
                        ? formatGeoLabel(entry.label)
                        : formatDimensionLabel(entry.label);
                    return (
                      <div
                        key={entry.label}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-muted-foreground truncate">
                          {label}
                        </span>
                        <span className="font-mono text-foreground">
                          {value}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top pages</CardTitle>
            <CardDescription>Ranked by pageviews.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No page data yet.</p>
            ) : (
              topPages.map(([label, count]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-muted-foreground truncate">
                    {label}
                  </span>
                  <span className="font-mono text-foreground">
                    {count.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Devices & browsers</CardTitle>
              <CardDescription>Ranked by pageviews.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={activeDeviceTab === "device" ? "default" : "outline"}
                onClick={() => onDeviceTabChange("device")}
              >
                Devices
              </Button>
              <Button
                size="sm"
                variant={activeDeviceTab === "browser" ? "default" : "outline"}
                onClick={() => onDeviceTabChange("browser")}
              >
                Browsers
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {activeDeviceEntries.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No data available
              </div>
            ) : (
              activeDeviceEntries.map(([label, count]) => {
                const percentage =
                  activeDeviceTotal === 0
                    ? 0
                    : (count / activeDeviceTotal) * 100;
                return (
                  <div
                    key={label}
                    className="relative group min-h-[32px] flex items-center"
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-primary/10 rounded-r-md transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative z-10 flex items-center justify-between w-full px-2 py-1.5">
                      <span className="text-sm text-foreground truncate font-medium">
                        {formatDimensionLabel(label)}
                      </span>
                      <span className="text-sm text-muted-foreground font-mono">
                        {count.toLocaleString()}
                      </span>
                    </div>
                    <div className="absolute inset-0 hover:bg-muted/40 transition-colors rounded-sm pointer-events-none" />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
