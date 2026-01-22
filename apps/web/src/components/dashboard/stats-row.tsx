"use client";

import { ArrowDown, ArrowUp, Check } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

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

const data = [
  { value: 400 },
  { value: 300 },
  { value: 300 },
  { value: 200 },
  { value: 278 },
  { value: 189 },
  { value: 239 },
  { value: 349 },
  { value: 200 },
  { value: 278 },
  { value: 189 },
  { value: 349 },
];

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down";
  showSparkline?: boolean;
  accent?: string;
  toggle?: {
    enabled: boolean;
    onToggle: () => void;
  };
}

function StatCard({
  title,
  value,
  change,
  trend,
  showSparkline = false,
  accent,
  toggle,
}: StatCardProps) {
  const showTrend = Boolean(change && change !== "--" && trend);
  return (
    <div className="group flex h-full flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        {toggle ? (
          <button
            type="button"
            onClick={toggle.onToggle}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition"
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-[4px] border border-border/60",
                toggle.enabled ? "" : "opacity-50",
              )}
              style={{
                backgroundColor:
                  toggle.enabled && accent ? accent : "transparent",
              }}
            >
              {toggle.enabled ? (
                <Check className="h-3 w-3 text-slate-950" />
              ) : null}
            </span>
            <span className={cn(toggle.enabled ? "text-foreground" : "")}>
              {title}
            </span>
          </button>
        ) : (
          <span className="text-xs font-medium text-muted-foreground">
            {title}
          </span>
        )}
        {title === "Visitors now" && (
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
          </div>
        )}
      </div>
      <div className="text-2xl font-semibold text-foreground tracking-tight">
        {value}
      </div>
      <div className="flex items-center gap-2">
        {change ? (
          <p
            className={cn(
              "text-xs font-medium flex items-center",
              showTrend
                ? trend === "up"
                  ? "text-emerald-400"
                  : "text-rose-400"
                : "text-muted-foreground",
            )}
          >
            {change}
            {showTrend ? (
              trend === "up" ? (
                <ArrowUp className="h-3 w-3 ml-0.5" />
              ) : (
                <ArrowDown className="h-3 w-3 ml-0.5" />
              )
            ) : null}
          </p>
        ) : null}
        {showSparkline && (
          <div className="h-8 w-20 ml-auto opacity-60 group-hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient
                    id={`gradient-${title}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={trend === "up" ? "#34d399" : "#fb7185"}
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor={trend === "up" ? "#34d399" : "#fb7185"}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={trend === "up" ? "#34d399" : "#fb7185"}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${title})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

import { useDashboardData } from "./hooks/use-dashboard-data";

// ... existing StatCard code ...

interface StatsRowProps {
  dashboardData: ReturnType<typeof useDashboardData>;
  tooltips?: boolean;
  controls?: {
    showVisitors: boolean;
    showRevenue: boolean;
    onToggleVisitors: () => void;
    onToggleRevenue: () => void;
  };
}

const formatCompact = (value?: number, digits = 1) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "0";
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: digits,
  }).format(value);
};

const formatCurrencyCompact = (value?: number) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "$0";
  }
  const formatted = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
  return `$${formatted}`;
};

export function StatsRow({ dashboardData, tooltips, controls }: StatsRowProps) {
  const deltas = (dashboardData as any)?.deltas ?? {};
  const formatDelta = (value?: number) => {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return "--";
    }
    const prefix = value >= 0 ? "+" : "";
    return `${prefix}${value.toFixed(1)}%`;
  };
  const resolveTrend = (value?: number) =>
    value !== undefined && value !== null && value < 0 ? "down" : "up";

  // Extract metrics from dashboardData
  const {
    visitorsCount,
    visitorsNowCount,
    totalRevenue,
    primaryConversionRate,
    revenuePerVisitor,
    bounceRate,
    avgSessionDurationMs,
  } = dashboardData as any;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 px-4 py-4 shadow-sm">
      <div className="grid grid-cols-2 gap-y-6 lg:grid-cols-7 lg:divide-x lg:divide-border/50">
        <div className="lg:px-3">
          <StatCard
            title="Visitors"
            value={formatCompact(visitorsCount)}
            change={formatDelta(deltas.visitors)}
            trend={resolveTrend(deltas.visitors)}
            accent="var(--chart-2)"
            toggle={
              controls
                ? {
                    enabled: controls.showVisitors,
                    onToggle: controls.onToggleVisitors,
                  }
                : undefined
            }
          />
        </div>
        <div className="lg:px-3">
          <StatCard
            title="Visitors now"
            value={formatCompact(visitorsNowCount)}
            change="--"
            trend="up"
            showSparkline={false}
          />
        </div>
        <div className="lg:px-3">
          <StatCard
            title="Revenue"
            value={formatCurrencyCompact(totalRevenue)}
            change={formatDelta(deltas.revenue)}
            trend={resolveTrend(deltas.revenue)}
            accent="var(--chart-1)"
            toggle={
              controls
                ? {
                    enabled: controls.showRevenue,
                    onToggle: controls.onToggleRevenue,
                  }
                : undefined
            }
          />
        </div>
        <div className="lg:px-3">
          <StatCard
            title="Conversion rate"
            value={`${primaryConversionRate?.toFixed(2) ?? "0"}%`}
            change={formatDelta(deltas.conversionRate)}
            trend={resolveTrend(deltas.conversionRate)}
          />
        </div>
        <div className="lg:px-3">
          <StatCard
            title="Revenue/visitor"
            value={`$${revenuePerVisitor?.toFixed(2) ?? "0"}`}
            change={formatDelta(deltas.revenuePerVisitor)}
            trend={resolveTrend(deltas.revenuePerVisitor)}
          />
        </div>
        <div className="lg:px-3">
          <StatCard
            title="Bounce rate"
            value={`${bounceRate?.toFixed(1) ?? "0.0"}%`}
            change={formatDelta(deltas.bounceRate)}
            trend={resolveTrend(deltas.bounceRate)}
          />
        </div>
        <div className="lg:px-3">
          <StatCard
            title="Avg session"
            value={formatDuration(avgSessionDurationMs ?? 0)}
            change={formatDelta(deltas.avgSessionDurationMs)}
            trend={resolveTrend(deltas.avgSessionDurationMs)}
          />
        </div>
      </div>
    </div>
  );
}
