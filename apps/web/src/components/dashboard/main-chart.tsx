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
import { useTheme } from "next-themes";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

type MainChartDatum = {
  date: string;
  dateLabel: string;
  visitors: number;
  revenue: number;
  revenueNew?: number;
  revenueRenewal?: number;
  revenueRefund?: number;
  revenuePerVisitor?: number;
  conversionRate?: number;
};

const formatCurrency = (value: number) => `$${value.toLocaleString()}`;
const visitorsColor = "#38b6ff"; // secondary blue
const revenueColor = "#ff914d"; // orange
const revenueRefundColor = "#ff5757"; // red

// Custom shape for refund bar - transparent fill with dashed border (no bottom)
const RefundBarShape = (props: any) => {
  const { x, y, width, height } = props;
  if (!height || height <= 0) return null;

  const strokeW = 1;
  const inset = strokeW / 2; // Inset to align stroke with bar edges
  const r = 3; // corner radius

  // Inset coordinates so stroke aligns with revenue bar
  const ix = x + inset;
  const iy = y + inset;
  const iw = width - strokeW;
  const ih = height - inset; // Only inset top, not bottom (it connects to bar)

  // Draw path: left side up -> top-left curve -> top -> top-right curve -> right side down
  // No bottom border
  const path = `
    M ${ix} ${iy + ih}
    L ${ix} ${iy + r}
    Q ${ix} ${iy} ${ix + r} ${iy}
    L ${ix + iw - r} ${iy}
    Q ${ix + iw} ${iy} ${ix + iw} ${iy + r}
    L ${ix + iw} ${iy + ih}
  `;

  return (
    <path
      d={path}
      fill="transparent"
      stroke={revenueColor}
      strokeWidth={strokeW}
      strokeDasharray="4 3"
      opacity={0.7}
    />
  );
};

// Custom shape for revenue bar - flat top when refund exists, rounded when no refund
const RevenueBarShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!height || height <= 0) return null;

  const hasRefund = payload?.revenueRefund && payload.revenueRefund > 0;
  const r = hasRefund ? 0 : 4; // flat when refund exists, rounded otherwise

  if (r === 0) {
    // Flat rectangle
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={revenueColor}
        opacity={0.85}
      />
    );
  }

  // Square top corners
  const path = `
    M ${x} ${y + height}
    L ${x} ${y}
    L ${x + width} ${y}
    L ${x + width} ${y + height}
    Z
  `;

  return <path d={path} fill={revenueColor} opacity={0.85} />;
};

const formatFullDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

// Mock data to match the screenshot vibe
const fallbackData: MainChartDatum[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "short" });

  const baseVisitors = 300 + Math.random() * 200;
  const spike = i > 15 && i < 22 ? (22 - Math.abs(18 - i)) * 100 : 0;
  const visitors = Math.round(baseVisitors + spike);
  const totalRevenue = Math.round(visitors * (1 + Math.random()) * 0.8);

  // Refunds vary between 8-15% of revenue (visible dotted portion)
  const refundRate = 0.08 + Math.random() * 0.07;
  const revenueRefund = Math.round(totalRevenue * refundRate);
  const revenueNew = totalRevenue - revenueRefund;

  return {
    date: date.toISOString().slice(0, 10),
    dateLabel: `${day} ${month}`,
    visitors,
    revenue: totalRevenue,
    revenueNew,
    revenueRenewal: 0,
    revenueRefund,
    revenuePerVisitor: visitors ? totalRevenue / visitors : 0,
    conversionRate: 0.7 + Math.random() * 0.4,
  };
});

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const datum = payload[0]?.payload as MainChartDatum | undefined;
    const visitors = datum?.visitors ?? 0;
    const revenue = datum?.revenue ?? 0;
    const revenueNew = datum?.revenueNew ?? 0;
    const revenueRefund = datum?.revenueRefund ?? 0;
    const revenuePerVisitor =
      datum?.revenuePerVisitor ?? (visitors ? revenue / visitors : 0);
    const conversionRate = datum?.conversionRate ?? 0;
    const hasSplit = revenueNew + revenueRefund > 0;

    return (
      <div className="bg-popover text-popover-foreground border border-border p-4 rounded-xl shadow-2xl min-w-[240px]">
        <p className="text-muted-foreground text-sm mb-3 font-medium">
          {datum?.date ? formatFullDate(datum.date) : "-"}
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-none"
                style={{ backgroundColor: visitorsColor }}
              ></div>
              <span className="text-foreground font-medium text-sm">
                Visitors
              </span>
            </div>
            <span className="text-foreground font-bold text-sm">
              {visitors.toLocaleString()}
            </span>
          </div>

          <div className="pt-2 border-t border-border/60">
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Revenue
              </span>
              <span className="text-foreground font-bold text-sm">
                {formatCurrency(revenue)}
              </span>
            </div>
            {hasSplit ? (
              <div className="space-y-1.5">
                {revenueNew > 0 ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-none"
                        style={{ backgroundColor: revenueColor }}
                      ></div>
                      <span className="text-foreground font-medium text-sm">
                        New
                      </span>
                    </div>
                    <span className="text-foreground font-bold text-sm">
                      {formatCurrency(revenueNew)}
                    </span>
                  </div>
                ) : null}
                {revenueRefund > 0 ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-none border border-dashed border-foreground/50" />
                      <span className="text-foreground font-medium text-sm">
                        Refunds
                      </span>
                    </div>
                    <span className="text-foreground font-bold text-sm">
                      -{formatCurrency(revenueRefund)}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="pt-2 border-t border-border/60 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Revenue/visitor</span>
              <span className="text-foreground font-mono">
                ${revenuePerVisitor.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Conversion rate</span>
              <span className="text-foreground font-mono">
                {conversionRate.toFixed(2)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export function MainChart({
  data,
  showVisitors = true,
  showRevenue = true,
}: {
  data?: MainChartDatum[];
  showVisitors?: boolean;
  showRevenue?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const axisColor = resolvedTheme === "dark" ? "#a1a1aa" : "#52525b";

  const hasExternalData = Array.isArray(data);
  const chartData = hasExternalData ? data : fallbackData;
  const isEmpty = hasExternalData && (!data || data.length === 0);
  const hasSeries = showVisitors || showRevenue;

  return (
    <Card className="col-span-4 bg-white border-2 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none">
      <CardHeader className="pb-2"></CardHeader>
      <CardContent className="pl-0">
        {isEmpty ? (
          <div className="flex h-[320px] w-full items-center justify-center text-sm text-muted-foreground">
            No chart data yet.
          </div>
        ) : !hasSeries ? (
          <div className="flex h-[320px] w-full items-center justify-center text-sm text-muted-foreground">
            Toggle a series to show the chart.
          </div>
        ) : (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient
                    id="colorVisitors"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor={visitorsColor}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="95%"
                      stopColor={visitorsColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                  <pattern
                    id="refundPattern"
                    patternUnits="userSpaceOnUse"
                    width="6"
                    height="6"
                  >
                    {/* Sparse dot pattern to simulate dotted border effect */}
                    <circle
                      cx="1"
                      cy="1"
                      r="1"
                      fill={revenueColor}
                      opacity="0.6"
                    />
                  </pattern>
                  <filter
                    id="glow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite
                      in="SourceGraphic"
                      in2="blur"
                      operator="over"
                    />
                  </filter>
                </defs>
                <CartesianGrid
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                  opacity={0.5}
                />
                <XAxis
                  dataKey="dateLabel"
                  stroke={axisColor}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: axisColor }}
                  dy={10}
                />
                {showVisitors ? (
                  <YAxis
                    yAxisId="left"
                    stroke={axisColor}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: axisColor }}
                    tickFormatter={(value) => `${value}`}
                  />
                ) : null}
                {showRevenue ? (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke={axisColor}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: axisColor }}
                    tickFormatter={(value) => `$${value}`}
                  />
                ) : null}
                <Tooltip
                  cursor={{
                    stroke: "hsl(var(--border))",
                    strokeWidth: 2,
                  }}
                  content={<CustomTooltip />}
                />

                {showRevenue ? (
                  <Bar
                    yAxisId="right"
                    dataKey="revenueNew"
                    stackId="revenue"
                    shape={<RevenueBarShape />}
                    barSize={20}
                    minPointSize={3}
                    name="Revenue"
                  />
                ) : null}
                {showRevenue ? (
                  <Bar
                    yAxisId="right"
                    dataKey="revenueRefund"
                    stackId="revenue"
                    shape={<RefundBarShape />}
                    barSize={20}
                    name="Refunds"
                  />
                ) : null}

                {showVisitors ? (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="visitors"
                    stroke={visitorsColor}
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorVisitors)"
                    filter="none"
                  />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
