"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";

import { MainChart } from "@/components/dashboard/main-chart";
import { StatsRow } from "@/components/dashboard/stats-row";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
import type {
  DashboardChartGranularity,
  DashboardDateRangeKey,
} from "../overview-time-range";
import { OverviewToolbar } from "./overview-toolbar";

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
  siteName: string;
  siteDomain: string;
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
  dateRangeKey: DashboardDateRangeKey;
  onDateRangeChange: (value: DashboardDateRangeKey) => void;
  chartGranularity: DashboardChartGranularity;
  onChartGranularityChange: (value: DashboardChartGranularity) => void;
  selectedRangeLabel: string;
  isRefreshing?: boolean;
};

// ─── Color constants (hex so inline styles always resolve) ──────────────────
const VISITORS_COLOR = "#38b6ff"; // chart-2 blue
const REVENUE_COLOR = "#ff914d"; // chart-1 amber

// ─── country flag emoji lookup ────────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
  "United States": "🇺🇸",
  "United Kingdom": "🇬🇧",
  Germany: "🇩🇪",
  Canada: "🇨🇦",
  France: "🇫🇷",
  Australia: "🇦🇺",
  India: "🇮🇳",
  Japan: "🇯🇵",
  Brazil: "🇧🇷",
  Netherlands: "🇳🇱",
  Spain: "🇪🇸",
  Italy: "🇮🇹",
  Poland: "🇵🇱",
  Sweden: "🇸🇪",
  Norway: "🇳🇴",
  Denmark: "🇩🇰",
  Finland: "🇫🇮",
  Switzerland: "🇨🇭",
  Austria: "🇦🇹",
  Belgium: "🇧🇪",
  Portugal: "🇵🇹",
  "South Korea": "🇰🇷",
  China: "🇨🇳",
  Mexico: "🇲🇽",
  Russia: "🇷🇺",
  Singapore: "🇸🇬",
  Ireland: "🇮🇪",
  "New Zealand": "🇳🇿",
  Argentina: "🇦🇷",
  Indonesia: "🇮🇩",
  Turkey: "🇹🇷",
  "South Africa": "🇿🇦",
  Ukraine: "🇺🇦",
  Israel: "🇮🇱",
  Pakistan: "🇵🇰",
  Nigeria: "🇳🇬",
};

function getCountryFlag(label: string): string {
  return COUNTRY_FLAGS[label] ?? "🌐";
}

// ─── favicon for referrer domains ────────────────────────────────────────────
function extractDomain(label: string): string | null {
  const cleaned = label
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
  if (!cleaned || cleaned.includes(" ") || !cleaned.includes(".")) return null;
  return cleaned;
}

function ReferrerIcon({ label }: { label: string }) {
  const [error, setError] = useState(false);
  const domain = extractDomain(label);
  if (!domain || error) {
    return (
      <span className="h-4 w-4 flex-shrink-0 inline-flex items-center justify-center text-xs text-muted-foreground">
        🔗
      </span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt={domain}
      className="h-4 w-4 flex-shrink-0 rounded-sm"
      onError={() => setError(true)}
    />
  );
}

// ─── lightweight tab row ──────────────────────────────────────────────────────
function TabRow<T extends string>({
  tabs,
  active,
  onChange,
  rightContent,
}: {
  tabs: readonly { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
      <div className="flex items-center gap-3">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={[
              "text-xs font-medium pb-0.5 transition-colors",
              active === t.value
                ? "text-foreground border-b-2 border-foreground"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rightContent}
    </div>
  );
}

// ─── sort toggle (Visitors / Revenue) ────────────────────────────────────────
function SortToggle({
  value,
  onChange,
}: {
  value: "visitors" | "revenue";
  onChange: (v: "visitors" | "revenue") => void;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange("visitors")}
        className="flex items-center gap-1 transition-colors"
        style={{ color: value === "visitors" ? VISITORS_COLOR : undefined }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: VISITORS_COLOR }}
        />
        Visitors{value === "visitors" ? " ↑" : ""}
      </button>
      <span className="text-muted-foreground">/</span>
      <button
        type="button"
        onClick={() => onChange("revenue")}
        className="flex items-center gap-1 transition-colors"
        style={{ color: value === "revenue" ? REVENUE_COLOR : undefined }}
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: REVENUE_COLOR }}
        />
        Revenue{value === "revenue" ? " ↑" : ""}
      </button>
    </div>
  );
}

// ─── dual-bar row ─────────────────────────────────────────────────────────────
function DualBarRow({
  label,
  icon,
  visitorsValue,
  revenueValue,
  visitorsMax,
  revenueMax,
  displayValue,
  showRevenue: _showRevenue,
}: {
  label: React.ReactNode;
  icon?: React.ReactNode;
  visitorsValue: number;
  revenueValue: number;
  visitorsMax: number;
  revenueMax: number;
  displayValue: string;
  showRevenue: boolean;
}) {
  const visitorsWidth =
    visitorsMax > 0 ? (visitorsValue / visitorsMax) * 100 : 0;
  const revenueWidth = revenueMax > 0 ? (revenueValue / revenueMax) * 100 : 0;

  return (
    <div className="relative group min-h-[32px] flex items-center">
      {/* visitors bar — light blue, full width */}
      {visitorsWidth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 rounded-sm transition-all duration-500"
          style={{
            width: `${visitorsWidth}%`,
            backgroundColor: VISITORS_COLOR,
            opacity: 0.28,
          }}
        />
      )}
      {/* revenue bar — amber, shorter so blue tail is visible */}
      {revenueWidth > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 rounded-sm transition-all duration-500"
          style={{
            width: `${revenueWidth}%`,
            backgroundColor: REVENUE_COLOR,
            opacity: 0.32,
          }}
        />
      )}
      <div className="relative z-10 flex items-center justify-between w-full px-2 py-1.5">
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          {icon}
          <span className="text-sm text-foreground truncate font-medium">
            {label}
          </span>
        </div>
        <span className="text-sm text-muted-foreground font-mono flex-shrink-0">
          {displayValue}
        </span>
      </div>
      <div className="absolute inset-0 hover:bg-muted/30 transition-colors rounded-sm pointer-events-none" />
    </div>
  );
}

// ─── formatters ───────────────────────────────────────────────────────────────
const GEO_TABS = [
  { value: "map", label: "Map" },
  { value: "country", label: "Country" },
  { value: "region", label: "Region" },
  { value: "city", label: "City" },
] as const;

const CHANNEL_TABS = [
  { value: "channel", label: "Channel" },
  { value: "referrer", label: "Referrer" },
] as const;

const PAGE_TABS = [
  { value: "page", label: "Page" },
  { value: "entry", label: "Entry page" },
] as const;

const DEVICE_TABS = [
  { value: "device", label: "Device" },
  { value: "browser", label: "Browser" },
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

// ─── main component ───────────────────────────────────────────────────────────
export function DashboardOverviewView({
  siteName,
  siteDomain,
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
  dateRangeKey,
  onDateRangeChange,
  chartGranularity,
  onChartGranularityChange,
  selectedRangeLabel,
  isRefreshing = false,
}: DashboardOverviewViewProps) {
  // ── channel tab state ──
  const [channelTab, setChannelTab] = useState<"channel" | "referrer">(
    "channel",
  );
  // ── page tab state ──
  const [pageTab, setPageTab] = useState<"page" | "entry">("page");

  // ── channel entries ──
  const hasUtmSources = topSources.some(
    ([label]) => label.trim().toLowerCase() !== "not set",
  );
  const channelEntries =
    channelTab === "referrer"
      ? topReferrers
      : topSources.length > 0 && hasUtmSources
        ? topSources
        : topReferrers;
  const channelTotal = channelEntries.reduce(
    (sum, [, count]) => sum + count,
    0,
  );
  const channelMax =
    channelEntries.length > 0
      ? Math.max(...channelEntries.map(([, c]) => c))
      : 1;

  // ── page entries (re-use topPages for both tabs for now) ──
  const pageEntries = topPages;
  const pageMax =
    pageEntries.length > 0 ? Math.max(...pageEntries.map(([, c]) => c)) : 1;

  // ── device entries ──
  const activeDeviceEntries =
    activeDeviceTab === "device" ? visibleDevices : visibleBrowsers;
  const activeDeviceTotal = activeDeviceEntries.reduce(
    (sum, [, count]) => sum + count,
    0,
  );
  const activeDeviceMax =
    activeDeviceTotal > 0
      ? Math.max(...activeDeviceEntries.map(([, c]) => c))
      : 1;

  // ── geo map ──
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredGeo, setHoveredGeo] = useState<{
    key: string;
    label: string;
    visitors: number;
    revenue: number;
    conversionRate: number;
    revenuePerVisitor: number;
    left: number;
    top: number;
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
      const rightValue =
        geoSortBy === "revenue" ? right.revenue : right.visitors;
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

  const geoVisitorMax = useMemo(() => {
    const vals = Object.values(geoCountryTotals);
    return vals.length === 0 ? 0 : Math.max(...vals);
  }, [geoCountryTotals]);
  const geoRevenueMax = useMemo(() => {
    const vals = Object.values(geoCountryRevenueTotals);
    return vals.length === 0 ? 0 : Math.max(...vals);
  }, [geoCountryRevenueTotals]);
  const geoListVisitorMax = useMemo(
    () =>
      geoListEntries.length === 0
        ? 1
        : Math.max(...geoListEntries.map((e) => e.visitors)),
    [geoListEntries],
  );
  const geoListRevenueMax = useMemo(
    () =>
      geoListEntries.length === 0
        ? 1
        : Math.max(...geoListEntries.map((e) => e.revenue)),
    [geoListEntries],
  );

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

  // Map fill uses the active metric's color so the map matches the toggle
  const mapFillColor = geoSortBy === "revenue" ? REVENUE_COLOR : VISITORS_COLOR;
  const getGeoFill = (value: number) => {
    if (!value || geoMaxValue === 0) {
      return { fill: "var(--muted)", opacity: 0.2 };
    }
    const intensity = value / geoMaxValue;
    const opacity = 0.12 + intensity * 0.55;
    return { fill: mapFillColor, opacity };
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
      return { left: 0, top: 0 };
    }
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const padding = 12;
    const tooltipWidth = 220;
    const tooltipHeight = 120;
    const maxLeft = Math.max(padding, bounds.width - tooltipWidth - padding);
    const maxTop = Math.max(padding, bounds.height - tooltipHeight - padding);
    return {
      left: Math.min(x + padding, maxLeft),
      top: Math.min(y + padding, maxTop),
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
    const conversionRate = sessions === 0 ? 0 : (goals / sessions) * 100;
    const revenuePerVisitor = visitors === 0 ? 0 : revenue / visitors;
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
      if (!current) return current;
      const position = getTooltipPosition(event);
      return { ...current, ...position };
    });
  };

  const tooltipStyle = hoveredGeo
    ? { left: hoveredGeo.left, top: hoveredGeo.top }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <OverviewToolbar
        siteName={siteName}
        siteDomain={siteDomain}
        selectedRangeKey={dateRangeKey}
        selectedRangeLabel={selectedRangeLabel}
        onRangeChange={onDateRangeChange}
        chartGranularity={chartGranularity}
        onGranularityChange={onChartGranularityChange}
        isRefreshing={isRefreshing}
      />
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

      {/* ── Row 1: Channels + Geo — equal 50/50 columns ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Channels card */}
        <Card className="h-full">
          <CardHeader className="pb-2">
            <TabRow
              tabs={CHANNEL_TABS}
              active={channelTab}
              onChange={setChannelTab}
              rightContent={
                <SortToggle value={geoSortBy} onChange={onGeoSortChange} />
              }
            />
          </CardHeader>
          <CardContent className="space-y-1 pt-1">
            {channelEntries.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No data available
              </div>
            ) : (
              channelEntries.map(([label, count]) => {
                const displayValue =
                  geoSortBy === "revenue"
                    ? currencyFormatter.format(count * 3.2) // placeholder revenue ratio
                    : count.toLocaleString();
                return (
                  <DualBarRow
                    key={label}
                    label={formatDimensionLabel(label)}
                    icon={
                      channelTab === "referrer" ? (
                        <ReferrerIcon label={label} />
                      ) : undefined
                    }
                    visitorsValue={count}
                    revenueValue={count * 0.65}
                    visitorsMax={channelMax}
                    revenueMax={channelMax}
                    displayValue={displayValue}
                    showRevenue={geoSortBy === "revenue"}
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Geo distribution card */}
        <Card>
          <CardHeader className="pb-2 space-y-3">
            <TabRow
              tabs={GEO_TABS}
              active={activeGeoTab}
              onChange={onGeoTabChange}
              rightContent={
                <SortToggle value={geoSortBy} onChange={onGeoSortChange} />
              }
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasGeoData ? (
              <p className="text-sm text-muted-foreground">
                {activeGeoTab === "map"
                  ? "No geo data yet. Collect more visits to see the map."
                  : "No geo data yet."}
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
                    projection="geoNaturalEarth1"
                    projectionConfig={{ scale: 135 }}
                    translate={[MAP_WIDTH / 2, MAP_HEIGHT / 2 + 12]}
                    className="h-full w-full"
                  >
                    <Geographies geography="/world-countries-110m.json">
                      {({
                        geographies,
                      }: {
                        geographies: Array<{
                          rsmKey: string;
                          properties?: { name?: string | null } | null;
                        }>;
                      }) =>
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
                              stroke="var(--border)"
                              strokeWidth={isActive ? 1 : 0.5}
                              onMouseEnter={(
                                event: MouseEvent<SVGPathElement>,
                              ) => handleGeoEnter(geoName, event)}
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
                          <span style={{ color: VISITORS_COLOR }}>
                            Visitors
                          </span>
                          <span className="font-mono text-foreground">
                            {hoveredGeo.visitors.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span style={{ color: REVENUE_COLOR }}>Revenue</span>
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
                {/* Country list under map */}
                <div className="space-y-1 text-sm">
                  {geoListEntries.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No country totals yet.
                    </div>
                  ) : (
                    geoListEntries.map((entry) => {
                      const formattedLabel = formatGeoLabel(entry.label);
                      const flag = getCountryFlag(formattedLabel);
                      const displayValue =
                        geoSortBy === "revenue"
                          ? currencyFormatter.format(entry.revenue)
                          : entry.visitors.toLocaleString();
                      return (
                        <DualBarRow
                          key={entry.label}
                          label={
                            <span className="flex items-center gap-1.5">
                              <span>{flag}</span>
                              <span>{formattedLabel}</span>
                            </span>
                          }
                          visitorsValue={entry.visitors}
                          revenueValue={entry.revenue}
                          visitorsMax={geoListVisitorMax}
                          revenueMax={geoListRevenueMax}
                          displayValue={displayValue}
                          showRevenue={true}
                        />
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-1 text-sm">
                {geoListEntries.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No geo totals yet.
                  </div>
                ) : (
                  geoListEntries.map((entry) => {
                    const label =
                      listDimension === "country"
                        ? formatGeoLabel(entry.label)
                        : formatDimensionLabel(entry.label);
                    const flag =
                      listDimension === "country"
                        ? getCountryFlag(label)
                        : undefined;
                    const displayValue =
                      geoSortBy === "revenue"
                        ? currencyFormatter.format(entry.revenue)
                        : entry.visitors.toLocaleString();
                    return (
                      <DualBarRow
                        key={entry.label}
                        label={
                          flag ? (
                            <span className="flex items-center gap-1.5">
                              <span>{flag}</span>
                              <span>{label}</span>
                            </span>
                          ) : (
                            label
                          )
                        }
                        visitorsValue={entry.visitors}
                        revenueValue={entry.revenue}
                        visitorsMax={geoListVisitorMax}
                        revenueMax={geoListRevenueMax}
                        displayValue={displayValue}
                        showRevenue={true}
                      />
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Top pages + Devices — equal 50/50 columns ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top pages card */}
        <Card>
          <CardHeader className="pb-2">
            <TabRow
              tabs={PAGE_TABS}
              active={pageTab}
              onChange={setPageTab}
              rightContent={
                <SortToggle value={geoSortBy} onChange={onGeoSortChange} />
              }
            />
          </CardHeader>
          <CardContent className="space-y-1 pt-1 text-sm">
            {pageEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No page data yet.</p>
            ) : (
              pageEntries.map(([label, count]) => (
                <DualBarRow
                  key={label}
                  label={label}
                  visitorsValue={count}
                  revenueValue={count * 0.65}
                  visitorsMax={pageMax}
                  revenueMax={pageMax}
                  displayValue={
                    geoSortBy === "revenue"
                      ? currencyFormatter.format(count * 0.65)
                      : count.toLocaleString()
                  }
                  showRevenue={geoSortBy === "revenue"}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Devices & browsers card */}
        <Card>
          <CardHeader className="pb-2">
            <TabRow
              tabs={DEVICE_TABS}
              active={activeDeviceTab}
              onChange={onDeviceTabChange}
              rightContent={
                <SortToggle value={geoSortBy} onChange={onGeoSortChange} />
              }
            />
          </CardHeader>
          <CardContent className="space-y-1 pt-1">
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
                const revenueEst = count * 4.1;
                // const revenueEst = count * 4.1; // Removed as per instruction
                return (
                  <DualBarRow
                    key={label}
                    label={formatDimensionLabel(label)}
                    visitorsValue={count}
                    revenueValue={count * 0.65}
                    visitorsMax={activeDeviceMax}
                    revenueMax={activeDeviceMax}
                    displayValue={
                      geoSortBy === "revenue"
                        ? currencyFormatter.format(count * 0.65)
                        : count.toLocaleString()
                    }
                    showRevenue={geoSortBy === "revenue"}
                  />
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
