"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  change: string;
  trend: "up" | "down";
  showSparkline?: boolean;
}

function StatCard({
  title,
  value,
  change,
  trend,
  showSparkline = true,
}: StatCardProps) {
  return (
    <Card className="bg-transparent border-none shadow-none p-0 group">
      <CardHeader className="p-0 pb-1 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {title}
        </CardTitle>
        {title === "Visitors now" && (
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="text-2xl font-bold text-foreground tracking-tight">
          {value}
        </div>
        <div className="flex items-center gap-2 mt-1 h-8">
          <p
            className={cn(
              "text-xs font-medium flex items-center",
              trend === "up" ? "text-emerald-500" : "text-rose-500",
            )}
          >
            {change}
            {trend === "up" ? (
              <ArrowUp className="h-3 w-3 ml-0.5" />
            ) : (
              <ArrowDown className="h-3 w-3 ml-0.5" />
            )}
          </p>
          {showSparkline && (
            <div className="h-8 w-20 ml-auto opacity-50 group-hover:opacity-100 transition-opacity">
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
                        stopColor={trend === "up" ? "#10b981" : "#f43f5e"}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor={trend === "up" ? "#10b981" : "#f43f5e"}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={trend === "up" ? "#10b981" : "#f43f5e"}
                    strokeWidth={1.5}
                    fill={`url(#gradient-${title})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useDashboardData } from "./hooks/use-dashboard-data";

// ... existing StatCard code ...

interface StatsRowProps {
  dashboardData: ReturnType<typeof useDashboardData>;
  tooltips?: boolean;
}

export function StatsRow({ dashboardData, tooltips }: StatsRowProps) {
  // Extract metrics from dashboardData
  const {
    visitorsCount,
    totalRevenue,
    primaryConversionRate,
    revenuePerVisitor,
    // Note: bounce rate and live visitors might not be in hook yet, using placeholders or computed if available
  } = dashboardData as any;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-6 mb-8 w-full overflow-x-auto pb-4 lg:pb-0">
      <StatCard
        title="Visitors"
        value={visitorsCount?.toLocaleString() ?? "0"}
        change="+0.0%" // Todo: Implement comparison
        trend="up"
      />
      <StatCard
        title="Revenue"
        value={`$${totalRevenue?.toLocaleString() ?? "0"}`}
        change="+0.0%"
        trend="up"
      />
      <StatCard
        title="Conversion rate"
        value={`${primaryConversionRate?.toFixed(2) ?? "0"}%`}
        change="+0.0%"
        trend="up"
      />
      <StatCard
        title="Revenue/visitor"
        value={`$${revenuePerVisitor?.toFixed(2) ?? "0"}`}
        change="+0.0%"
        trend="up"
      />
      <StatCard title="Bounce rate" value="0%" change="-0.0%" trend="down" />
      <StatCard
        title="Visitors now"
        value="0"
        change=""
        trend="up"
        showSparkline={false}
      />
    </div>
  );
}
