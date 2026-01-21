"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type Route } from "next";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { queryClient, trpc } from "@/utils/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RollupTotals = Record<string, number>;

const geoPinPositions: Record<string, { x: number; y: number }> = {
  US: { x: 160, y: 170 },
  CA: { x: 150, y: 120 },
  GB: { x: 365, y: 145 },
  DE: { x: 395, y: 165 },
  FR: { x: 380, y: 185 },
  BR: { x: 235, y: 285 },
  IN: { x: 560, y: 220 },
  JP: { x: 665, y: 165 },
  AU: { x: 640, y: 320 },
};

const worldMapPaths = [
  "M80 120Q110 80 170 90Q230 90 260 130Q280 150 260 190Q240 220 190 210Q150 205 120 190Q90 175 70 150Q65 135 80 120Z",
  "M200 230Q230 220 250 240Q270 260 260 300Q250 340 230 360Q210 370 200 340Q190 310 190 270Q190 245 200 230Z",
  "M340 120Q360 100 390 110Q420 120 430 140Q435 160 410 170Q380 180 350 170Q330 160 330 140Q330 125 340 120Z",
  "M360 190Q390 175 420 190Q450 205 450 235Q450 270 430 305Q415 325 390 320Q365 310 360 280Q350 240 360 190Z",
  "M450 120Q480 90 540 105Q600 95 660 130Q700 150 720 190Q730 230 690 250Q650 265 610 250Q575 235 560 220Q535 205 515 210Q485 215 470 200Q440 180 450 120Z",
  "M600 285Q620 270 650 275Q680 285 690 305Q700 330 680 345Q650 360 620 350Q595 340 590 315Q585 295 600 285Z",
];

const formatGeoLabel = (value: string) =>
  value.trim().length === 0 || value === "unknown"
    ? "Unknown"
    : value;

const formatVisitors = (count: number) =>
  `${count.toLocaleString()} visitor${count === 1 ? "" : "s"}`;

const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

const formatRefund = (value: number) =>
  value > 0 ? `-$${value.toLocaleString()}` : "$0";

const formatDuration = (durationMs: number) => {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "0s";
  }
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

const toNumber = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function Dashboard({ siteId }: { siteId?: string }) {
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
          queryClient.fetchQuery(trpc.analytics.rollups.queryOptions({ siteId })).then((rollup) => ({
            siteId,
            rollup,
          })),
        ),
      );
      return results.reduce<Record<string, RollupTotals>>((accumulator, entry) => {
        const totals = entry.rollup.daily.reduce(
          (summary, day) => ({
            visitors: summary.visitors + day.visitors,
          }),
          { visitors: 0 },
        );
        accumulator[entry.siteId] = totals;
        return accumulator;
      }, {});
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

  const [activeGeoTab, setActiveGeoTab] = useState<"region" | "city">("region");

  const geoCounts = useMemo(() => {
    const base = {
      country: {} as Record<string, number>,
      region: {} as Record<string, number>,
      city: {} as Record<string, number>,
    };
    const dimensions = activeRollupQuery.data?.dimensions ?? [];
    for (const entry of dimensions) {
      const dimension = entry.dimension;
      if (dimension !== "country" && dimension !== "region" && dimension !== "city") {
        continue;
      }
      const label = entry.dimensionValue.trim() || "unknown";
      const count = entry.pageviews ?? 0;
      if (dimension === "country") {
        base.country[label] = (base.country[label] ?? 0) + count;
      } else if (dimension === "region") {
        base.region[label] = (base.region[label] ?? 0) + count;
      } else {
        base.city[label] = (base.city[label] ?? 0) + count;
      }
    }
    return base;
  }, [activeRollupQuery.data?.dimensions]);

  const topCountries = useMemo(
    () =>
      Object.entries(geoCounts.country)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    [geoCounts.country],
  );
  const topRegions = useMemo(
    () =>
      Object.entries(geoCounts.region)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    [geoCounts.region],
  );
  const topCities = useMemo(
    () =>
      Object.entries(geoCounts.city)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    [geoCounts.city],
  );

  const revenueTotals = useMemo(() => {
    const totals = { total: 0, new: 0, renewal: 0, refund: 0 };
    for (const entry of activeRollupQuery.data?.daily ?? []) {
      totals.total += toNumber(entry.revenue);
      const byType = entry.revenueByType as
        | { new?: number; renewal?: number; refund?: number }
        | null
        | undefined;
      totals.new += toNumber(byType?.new);
      totals.renewal += toNumber(byType?.renewal);
      totals.refund += toNumber(byType?.refund);
    }
    return totals;
  }, [activeRollupQuery.data?.daily]);

  const revenueSeries = useMemo(() => {
    return (activeRollupQuery.data?.daily ?? [])
      .map((entry) => {
        const rawDate = String(entry.date);
        const dateValue = new Date(rawDate);
        const dateLabel = Number.isNaN(dateValue.getTime())
          ? rawDate
          : dateValue.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
        const byType = entry.revenueByType as
          | { new?: number; renewal?: number; refund?: number }
          | null
          | undefined;
        const total = toNumber(entry.revenue);
        const newValue = toNumber(byType?.new);
        const renewalValue = toNumber(byType?.renewal);
        const refundValue = toNumber(byType?.refund);
        const hasSplit = newValue + renewalValue + refundValue > 0;
        return {
          date: rawDate,
          dateLabel,
          new: hasSplit ? newValue : total,
          renewal: hasSplit ? renewalValue : 0,
          refund: hasSplit ? refundValue : 0,
        };
      })
      .sort((left, right) => left.date.localeCompare(right.date));
  }, [activeRollupQuery.data?.daily]);

  const hasRevenueData = revenueTotals.total > 0;
  const sessionTotals = useMemo(() => {
    const totals = { sessions: 0, bounced: 0, durationMs: 0 };
    for (const entry of activeRollupQuery.data?.daily ?? []) {
      totals.sessions += toNumber(entry.sessions);
      totals.bounced += toNumber(entry.bouncedSessions);
      totals.durationMs += toNumber(entry.avgSessionDurationMs);
    }
    return totals;
  }, [activeRollupQuery.data?.daily]);
  const bounceRate =
    sessionTotals.sessions === 0
      ? 0
      : (sessionTotals.bounced / sessionTotals.sessions) * 100;
  const avgSessionDurationMs =
    sessionTotals.sessions === 0
      ? 0
      : Math.round(sessionTotals.durationMs / sessionTotals.sessions);

  const isLoading =
    sitesQuery.isLoading ||
    rollupQueries.isLoading ||
    activeRollupQuery.isLoading ||
    visitorsNowQuery.isLoading;
  const activeSite = siteId ? sites.find((site) => site.id === siteId) : null;
  const activeSiteTotals = siteId ? rollupQueries.data?.[siteId] : null;
  const hasEvents = (activeSiteTotals?.visitors ?? 0) > 0;
  const showEmptyState = Boolean(siteId && activeSite && !isLoading && !hasEvents);

  if (siteId) {
    if (isLoading || !activeSite) {
      return (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Loading analytics...</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Fetching site details and rollups.
            </CardContent>
          </Card>
        </div>
      );
    }

    if (showEmptyState) {
      return (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Awaiting first event...</CardTitle>
              <CardDescription>
                {activeSite.name} · {activeSite.domain}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <ol className="list-decimal space-y-1 pl-4">
                <li>Install the tracking script from Settings.</li>
                <li>Visit your site to trigger a pageview.</li>
                <li>Refresh this dashboard after a minute.</li>
                <li>Contact support if events still do not appear.</li>
              </ol>
              <Link
                href={`/dashboard/${siteId}/settings` as Route}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Install script
              </Link>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {[
              "Visitors",
              "Revenue",
              "Top pages",
              "Goal conversions",
            ].map((title) => (
              <Card key={title}>
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  No data yet
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    const activeGeoEntries = activeGeoTab === "region" ? topRegions : topCities;
    const activeGeoTotal = activeGeoEntries.reduce((sum, [, count]) => sum + count, 0);
    const maxCountryCount = topCountries.reduce(
      (max, [, count]) => Math.max(max, count),
      0,
    );
    const geoPins = topCountries
      .map(([label, count]) => {
        const key = label.trim().toUpperCase();
        const coords = geoPinPositions[key];
        if (!coords) {
          return null;
        }
        const size = maxCountryCount
          ? Math.round(4 + (count / maxCountryCount) * 6)
          : 4;
        return { label, count, size, ...coords };
      })
      .filter(
        (
          pin,
        ): pin is { label: string; count: number; size: number; x: number; y: number } =>
          Boolean(pin),
      );

    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{activeSite?.name ?? "Site overview"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {activeSite ? (
              <div>
                <div>Domain: {activeSite.domain}</div>
                <div>Site ID: {activeSite.id}</div>
              </div>
            ) : (
              <p>Loading site details...</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Visitors now</CardTitle>
              <CardDescription>Active in the last 5 minutes.</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              <span className="inline-flex items-center gap-2">
                {visitorsNowQuery.data?.count?.toLocaleString() ?? "0"}
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
                </span>
              </span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bounce rate</CardTitle>
              <CardDescription>Sessions with a single pageview.</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {bounceRate.toFixed(1)}%
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Avg session</CardTitle>
              <CardDescription>Average time between first and last pageview.</CardDescription>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {formatDuration(avgSessionDurationMs)}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Revenue split</CardTitle>
              <CardDescription>New vs renewal vs refunds.</CardDescription>
            </CardHeader>
            <CardContent>
              {hasRevenueData ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueSeries}>
                      <CartesianGrid
                        vertical={false}
                        stroke="hsl(var(--border))"
                        strokeDasharray="3 3"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="dateLabel"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                      <Legend />
                      <Bar
                        dataKey="new"
                        stackId="revenue"
                        fill="#f97316"
                        name="New"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="renewal"
                        stackId="revenue"
                        fill="#3b82f6"
                        name="Renewal"
                      />
                      <Bar
                        dataKey="refund"
                        stackId="revenue"
                        fill="#ef4444"
                        name="Refunds"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No revenue data yet.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Revenue summary</CardTitle>
              <CardDescription>Totals for the selected range.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {formatCurrency(revenueTotals.total)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">New</span>
                <span className="font-medium">
                  {formatCurrency(revenueTotals.new)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Renewal</span>
                <span className="font-medium">
                  {formatCurrency(revenueTotals.renewal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Refunds</span>
                <span className="font-medium text-rose-500">
                  {formatRefund(revenueTotals.refund)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Geo distribution</CardTitle>
              <CardDescription>Top countries based on recent traffic.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topCountries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No geo data yet. Collect more visits to see the map.
                </p>
              ) : (
                <>
                  <div className="relative h-64 w-full overflow-hidden rounded-md border bg-muted/20">
                    <svg viewBox="0 0 800 420" className="h-full w-full">
                      <rect x="0" y="0" width="800" height="420" rx="24" fill="hsl(var(--muted))" opacity="0.35" />
                      {worldMapPaths.map((path, index) => (
                        <path
                          key={`${path}-${index}`}
                          d={path}
                          fill="hsl(var(--muted))"
                          opacity="0.8"
                          stroke="hsl(var(--border))"
                          strokeWidth="1"
                        />
                      ))}
                      {geoPins.map((pin) => (
                        <g key={pin.label}>
                          <circle cx={pin.x} cy={pin.y} r={pin.size + 2} fill="hsl(var(--primary))" opacity="0.25" />
                          <circle cx={pin.x} cy={pin.y} r={pin.size} fill="hsl(var(--primary))" />
                          <title>
                            {`${formatGeoLabel(pin.label)} · ${pin.count.toLocaleString()} visitors`}
                          </title>
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="space-y-2 text-sm">
                    {topCountries.map(([label, count]) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {formatGeoLabel(label)}
                        </span>
                        <span className="font-medium">{count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Regions & cities</CardTitle>
                <CardDescription>Ranked by pageviews.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={activeGeoTab === "region" ? "default" : "outline"}
                  onClick={() => setActiveGeoTab("region")}
                >
                  Regions
                </Button>
                <Button
                  size="sm"
                  variant={activeGeoTab === "city" ? "default" : "outline"}
                  onClick={() => setActiveGeoTab("city")}
                >
                  Cities
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-1">
              {activeGeoEntries.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No data available
                </div>
              ) : (
                activeGeoEntries.map(([label, count]) => {
                  const percentage =
                    activeGeoTotal === 0 ? 0 : (count / activeGeoTotal) * 100;
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
                          {formatGeoLabel(label)}
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your sites</h1>
          <p className="text-sm text-muted-foreground">
            Pick a site to view analytics and settings.
          </p>
        </div>
        <Link href={"/dashboard/new" as Route} className={cn(buttonVariants({ size: "sm" }))}>
          + Website
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Loading sites...
          </CardContent>
        </Card>
      ) : sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sites yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Create your first website to start tracking analytics.
            </p>
            <Link href={"/dashboard/new" as Route} className={cn(buttonVariants({ size: "sm" }))}>
              Create a site
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => {
            const totals = rollupQueries.data?.[site.id];
            const visitors = totals?.visitors ?? 0;
            return (
              <Card key={site.id}>
                <CardHeader>
                  <CardTitle>{site.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="text-sm text-muted-foreground">{site.domain}</div>
                  <div className="text-base font-medium">{formatVisitors(visitors)}</div>
                  <Link
                    href={`/dashboard/${site.id}` as Route}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    View dashboard
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
