"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BreakdownItem = {
  label: string;
  value: string;
  count: number;
  percentage: number; // 0 to 100
  icon?: React.ReactNode;
};

interface BreakdownCardProps {
  title: string;
  items: BreakdownItem[];
  icon?: React.ReactNode;
  className?: string;
  metricLabel?: string;
}

export function BreakdownCard({
  title,
  items,
  icon,
  className,
  metricLabel = "Visitors",
}: BreakdownCardProps) {
  return (
    <Card className={cn("bg-card border-border shadow-sm h-full", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground font-medium">
          <span>{metricLabel}</span>
          <span>↓</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {items.map((item, index) => (
          <div
            key={index}
            className="relative group min-h-[32px] flex items-center"
          >
            {/* Progress Bar Background */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-primary/10 rounded-none transition-all duration-500"
              style={{ width: `${item.percentage}%` }}
            />
            {/* Content using flex z-10 */}
            <div className="relative z-10 flex items-center justify-between w-full px-2 py-1.5">
              <div className="flex items-center gap-2 overflow-hidden">
                {item.icon && (
                  <span className="text-muted-foreground flex-shrink-0">
                    {item.icon}
                  </span>
                )}
                <span className="text-sm text-foreground truncate font-medium">
                  {item.label}
                </span>
              </div>
              <span className="text-sm text-muted-foreground font-mono">
                {item.value}
              </span>
            </div>
            {/* Hover Highlight */}
            <div className="absolute inset-0 hover:bg-muted/40 transition-colors rounded-none pointer-events-none" />
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
