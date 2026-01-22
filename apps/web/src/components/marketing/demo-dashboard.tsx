"use client";

import { useEffect, useMemo, useState } from "react";
import { BreakdownCard } from "@/components/dashboard/breakdown-card";
import { MainChart } from "@/components/dashboard/main-chart";
import { StatsRow } from "@/components/dashboard/stats-row";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Types derived from existing dashboard components
type DailyEntry = {
  date: string;
  visitors: number;
  revenue: number;
  revenueNew?: number;
  revenueRenewal?: number;
  revenueRefund?: number;
};

const SIMULATION_INTERVAL = 3000;

export function DemoDashboard() {
  const [nowVisitors, setNowVisitors] = useState(42);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Simulate "live" visitors fluctuation
  useEffect(() => {
    const interval = setInterval(() => {
      setNowVisitors((prev) => {
        const change = Math.floor(Math.random() * 5) - 2; // -2 to +2
        return Math.max(12, Math.min(150, prev + change));
      });
      setLastUpdate(Date.now());
    }, SIMULATION_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // Static demo data for the chart (last 30 days)
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const baseVisitors = isWeekend ? 400 : 1200;
      const visitors = Math.floor(baseVisitors + Math.random() * 300);
      const revenue = Math.floor(visitors * (0.8 + Math.random() * 0.4)); // Roughly $1 per visitor avg

      data.push({
        date: date.toISOString(),
        dateLabel: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        visitors,
        revenue,
        revenueNew: Math.floor(revenue * 0.8),
        revenueRenewal: Math.floor(revenue * 0.2),
        revenuePerVisitor: revenue / visitors,
        conversionRate: 2.4 + Math.random(),
      });
    }
    return data;
  }, []);

  const statsData = {
    visitorsCount: 32450,
    visitorsNowCount: nowVisitors,
    totalRevenue: 48290,
    primaryConversionRate: 3.2,
    revenuePerVisitor: 1.48,
    bounceRate: 42.5,
    avgSessionDurationMs: 145000, // 2m 25s
    deltas: {
      visitors: 12.5,
      revenue: 8.2,
      conversionRate: 1.1,
      revenuePerVisitor: -2.3,
      bounceRate: -5.4, // Lower is better (green usually handled by component logic)
      avgSessionDurationMs: 15.2,
    },
  };

  const topSources = [
    { label: "Google", value: "14,230", count: 14230, percentage: 45 },
    { label: "Direct", value: "8,120", count: 8120, percentage: 25 },
    { label: "Twitter / X", value: "5,400", count: 5400, percentage: 16 },
    { label: "LinkedIn", value: "2,200", count: 2200, percentage: 8 },
    { label: "Product Hunt", value: "1,800", count: 1800, percentage: 4 },
    { label: "Newsletter", value: "700", count: 700, percentage: 2 },
  ];

  const topPages = [
    { label: "/", value: "18,400" },
    { label: "/pricing", value: "6,200" },
    { label: "/blog/scaling-analytics", value: "4,100" },
    { label: "/docs/install", value: "2,800" },
    { label: "/features", value: "1,900" },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto rounded-xl border bg-background/50 backdrop-blur-xl shadow-2xl overflow-hidden pointer-events-none select-none lg:pointer-events-auto lg:select-auto">
      {/* Fake Browser Header for aesthetics */}
      <div className="border-b bg-muted/40 px-4 py-3 flex items-center gap-4">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
        </div>
        <div className="flex-1 text-center text-xs font-mono text-muted-foreground opacity-50">
          ezlytics.com/dashboard
        </div>
        <div className="w-10" />
      </div>

      <div className="p-6 flex flex-col gap-6">
        {/* @ts-ignore - types might be loose in the original component */}
        <StatsRow dashboardData={statsData} />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MainChart data={chartData} />
          </div>
          <div className="flex flex-col gap-6">
            <BreakdownCard
              title="Top Sources"
              items={topSources}
              className="flex-1"
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Pages</CardTitle>
              <CardDescription>Most visited URLs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {topPages.map((page) => (
                <div
                  key={page.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-mono text-muted-foreground">
                    {page.label}
                  </span>
                  <span className="font-medium">{page.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="flex items-center justify-center min-h-[200px] bg-muted/20 border-dashed">
            <div className="text-center space-y-2">
              <p className="font-medium text-muted-foreground">
                Real-time Geo Map
              </p>
              <p className="text-xs text-muted-foreground/60">
                Coming soon to demo
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
