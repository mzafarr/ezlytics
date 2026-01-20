"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Mock data to match the screenshot vibe
const data = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "short" });

  // Random data generation
  const baseVisitors = 300 + Math.random() * 200;
  // Spike around index 18
  const spike = i > 15 && i < 22 ? (22 - Math.abs(18 - i)) * 100 : 0;
  const visitors = Math.round(baseVisitors + spike);

  return {
    date: `${day} ${month}`,
    fullDate: date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    visitors,
    revenue: Math.round(visitors * (1 + Math.random()) * 0.8), // Correlated but distinct
  };
});

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const visitorData = payload.find((p) => p.dataKey === "visitors");
    const revenueData = payload.find((p) => p.dataKey === "revenue");

    return (
      <div className="bg-popover text-popover-foreground border border-border p-4 rounded-xl shadow-2xl min-w-[240px]">
        <p className="text-muted-foreground text-sm mb-3 font-medium">
          {payload[0].payload.fullDate}
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-[2px] bg-[#60A5FA]"></div>
              <span className="text-foreground font-medium text-sm">
                Visitors
              </span>
            </div>
            <span className="text-foreground font-bold text-sm">
              {visitorData?.value}
            </span>
          </div>

          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Revenue
              </span>
              <span className="text-foreground font-bold text-sm">
                ${revenueData?.value}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-[2px] bg-[#FB923C]"></div>
                <span className="text-foreground font-medium text-sm">New</span>
              </div>
              <span className="text-foreground font-bold text-sm">
                ${revenueData?.value}
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/60 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Revenue/visitor</span>
              <span className="text-foreground font-mono">$1.53</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Conversion rate</span>
              <span className="text-foreground font-mono">0.72%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export function MainChart() {
  return (
    <Card className="col-span-4 bg-card border-border shadow-sm">
      <CardHeader className="pb-2">
        {/* Placeholder for Tabs/Controls if needed */}
      </CardHeader>
      <CardContent className="pl-0">
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                {/* Glow filter definition */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="hsl(var(--border))"
                strokeDasharray="3 3"
                opacity={0.5}
              />
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                yAxisId="left"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                cursor={{
                  stroke: "hsl(var(--border))",
                  strokeWidth: 2,
                }}
                content={<CustomTooltip />}
              />

              {/* Revenue Bars - Background */}
              <Bar
                yAxisId="right"
                dataKey="revenue"
                fill="#ea580c" /* Orange-600 ish */
                radius={[4, 4, 0, 0]}
                barSize={24}
                opacity={0.3}
              />

              {/* Visitors Area - Foreground with Glow */}
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="visitors"
                stroke="#60A5FA" /* Blue-400 */
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorVisitors)"
                filter="drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
