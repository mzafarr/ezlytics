"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Globe, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  DASHBOARD_DATE_RANGE_OPTIONS,
  DASHBOARD_GRANULARITY_OPTIONS,
  formatUtcTimeLabel,
  type DashboardChartGranularity,
  type DashboardDateRangeKey,
} from "../overview-time-range";

type OverviewToolbarProps = {
  siteName: string;
  siteDomain: string;
  selectedRangeKey: DashboardDateRangeKey;
  selectedRangeLabel: string;
  onRangeChange: (value: DashboardDateRangeKey) => void;
  chartGranularity: DashboardChartGranularity;
  onGranularityChange: (value: DashboardChartGranularity) => void;
  isRefreshing?: boolean;
  onExport?: (format: "csv-daily" | "csv-breakdown" | "json") => void;
};

const normalizeDomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");

const toProjectLabel = (siteName: string, siteDomain: string) => {
  const normalizedDomain = normalizeDomain(siteDomain);
  const normalizedName = siteName.trim();
  if (
    normalizedName.length > 0 &&
    normalizedName.toLowerCase() !== normalizedDomain
  ) {
    return normalizedName;
  }

  const parts = normalizedDomain.split(".").filter(Boolean);
  if (parts.length === 0) {
    return "Project";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts[parts.length - 2];
};

export function OverviewToolbar({
  siteName,
  siteDomain,
  selectedRangeKey,
  selectedRangeLabel,
  onRangeChange,
  chartGranularity,
  onGranularityChange,
  isRefreshing = false,
  onExport,
}: OverviewToolbarProps) {
  const [iconError, setIconError] = useState(false);
  const normalizedDomain = normalizeDomain(siteDomain);
  const projectLabel = toProjectLabel(siteName, siteDomain);
  const faviconUrl = useMemo(() => {
    if (!normalizedDomain) {
      return "";
    }
    return `https://${normalizedDomain}/favicon.ico`;
  }, [normalizedDomain]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border-2 border-border bg-white px-3 py-2 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        {faviconUrl && !iconError ? (
          <img
            src={faviconUrl}
            alt={`${projectLabel} favicon`}
            className="h-7 w-7 shrink-0 rounded-none border-2 border-border"
            onError={() => setIconError(true)}
          />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border-2 border-border bg-muted">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {projectLabel}
          </p>
          {normalizedDomain ? (
            <p className="truncate text-xs text-muted-foreground">
              {normalizedDomain}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isRefreshing ? (
          <span className="text-[11px] text-muted-foreground">Updating…</span>
        ) : null}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="min-w-36 justify-between"
              />
            }
          >
            {selectedRangeLabel}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <div className="px-2 py-2 text-xs text-muted-foreground">
              Current UTC time: {formatUtcTimeLabel()}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={selectedRangeKey}
              onValueChange={(value) =>
                onRangeChange(value as DashboardDateRangeKey)
              }
            >
              {DASHBOARD_DATE_RANGE_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.key} value={option.key}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="min-w-24 justify-between"
              />
            }
          >
            {chartGranularity === "daily" ? "Daily" : "Weekly"}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-32">
            <DropdownMenuRadioGroup
              value={chartGranularity}
              onValueChange={(value) =>
                onGranularityChange(value as DashboardChartGranularity)
              }
            >
              {DASHBOARD_GRANULARITY_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.key} value={option.key}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {onExport && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                />
              }
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Download data
              </div>
              <DropdownMenuSeparator />
              <button
                className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => onExport("csv-daily")}
              >
                Daily stats (.csv)
              </button>
              <button
                className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => onExport("csv-breakdown")}
              >
                Breakdown by dimension (.csv)
              </button>
              <DropdownMenuSeparator />
              <button
                className="relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onClick={() => onExport("json")}
              >
                All data (.json)
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
