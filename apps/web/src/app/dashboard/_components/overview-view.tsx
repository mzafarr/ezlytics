"use client";

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
  MAP_HEIGHT,
  MAP_LAT_LINES,
  MAP_LNG_LINES,
  MAP_WIDTH,
} from "../dashboard-helpers";
import type {
  ChartDatum,
  DashboardOverviewData,
  GeoDot,
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

type DashboardOverviewViewProps = {
  statsData: StatsData;
  chartData: ChartDatum[];
  topReferrers: BreakdownEntry;
  topSources: BreakdownEntry;
  topPages: BreakdownEntry;
  visibleCountries: BreakdownEntry;
  visibleDevices: BreakdownEntry;
  visibleBrowsers: BreakdownEntry;
  geoDots: GeoDot[];
  activeDeviceTab: "device" | "browser";
  onDeviceTabChange: (tab: "device" | "browser") => void;
  showVisitorsSeries: boolean;
  showRevenueSeries: boolean;
  onToggleVisitors: () => void;
  onToggleRevenue: () => void;
};

export function DashboardOverviewView({
  statsData,
  chartData,
  topReferrers,
  topSources,
  topPages,
  visibleCountries,
  visibleDevices,
  visibleBrowsers,
  geoDots,
  activeDeviceTab,
  onDeviceTabChange,
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

  const hasGeoData = geoDots.length > 0 || visibleCountries.length > 0;

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
          <CardHeader>
            <CardTitle>Geo distribution</CardTitle>
            <CardDescription>
              Top countries based on recent traffic.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasGeoData ? (
              <p className="text-sm text-muted-foreground">
                No geo data yet. Collect more visits to see the map.
              </p>
            ) : (
              <>
                <div className="relative h-64 w-full overflow-hidden rounded-md border bg-muted/20">
                  <svg
                    viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                    className="h-full w-full"
                  >
                    <rect
                      x="0"
                      y="0"
                      width={MAP_WIDTH}
                      height={MAP_HEIGHT}
                      rx="24"
                      fill="hsl(var(--muted))"
                      opacity="0.2"
                    />
                    {MAP_LAT_LINES.map((lat) => {
                      const y = ((90 - lat) / 180) * MAP_HEIGHT;
                      return (
                        <line
                          key={`lat-${lat}`}
                          x1="0"
                          y1={y}
                          x2={MAP_WIDTH}
                          y2={y}
                          stroke="hsl(var(--border))"
                          strokeWidth="1"
                          opacity="0.5"
                        />
                      );
                    })}
                    {MAP_LNG_LINES.map((lng) => {
                      const x = ((lng + 180) / 360) * MAP_WIDTH;
                      return (
                        <line
                          key={`lng-${lng}`}
                          x1={x}
                          y1="0"
                          x2={x}
                          y2={MAP_HEIGHT}
                          stroke="hsl(var(--border))"
                          strokeWidth="1"
                          opacity="0.5"
                        />
                      );
                    })}
                    {geoDots.map((dot, index) => (
                      <g key={`${dot.lat}-${dot.lng}-${index}`}>
                        <circle
                          cx={dot.x}
                          cy={dot.y}
                          r={dot.size + 2}
                          fill="hsl(var(--primary))"
                          opacity="0.2"
                        />
                        <circle
                          cx={dot.x}
                          cy={dot.y}
                          r={dot.size}
                          fill="hsl(var(--primary))"
                          opacity="0.7"
                        />
                        <title>{`${dot.count.toLocaleString()} visit${dot.count === 1 ? "" : "s"}`}</title>
                      </g>
                    ))}
                  </svg>
                </div>
                <div className="space-y-2 text-sm">
                  {visibleCountries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No country totals yet.
                    </div>
                  ) : (
                    visibleCountries.map(([label, count]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between"
                      >
                        <span className="text-muted-foreground">
                          {formatGeoLabel(label)}
                        </span>
                        <span className="font-medium">
                          {count.toLocaleString()}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
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
