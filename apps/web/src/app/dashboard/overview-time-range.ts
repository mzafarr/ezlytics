export type DashboardDateRangeKey =
  | "today"
  | "yesterday"
  | "last24Hours"
  | "last7Days"
  | "last30Days"
  | "weekToDate"
  | "monthToDate";

export type DashboardChartGranularity = "daily" | "weekly";

export type DashboardDateRangeOption = {
  key: DashboardDateRangeKey;
  label: string;
};

export type DashboardDateRange = {
  key: DashboardDateRangeKey;
  label: string;
  startDate: string;
  endDate: string;
};

export const DASHBOARD_DATE_RANGE_OPTIONS: DashboardDateRangeOption[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last24Hours", label: "Last 24 hours" },
  { key: "last7Days", label: "Last 7 days" },
  { key: "last30Days", label: "Last 30 days" },
  { key: "weekToDate", label: "Week to date" },
  { key: "monthToDate", label: "Month to date" },
];

export const DASHBOARD_GRANULARITY_OPTIONS: Array<{
  key: DashboardChartGranularity;
  label: string;
}> = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeUtcDate = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const formatUtcDate = (value: Date) => value.toISOString().slice(0, 10);

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const startOfUtcWeek = (value: Date) => {
  const normalized = normalizeUtcDate(value);
  const day = normalized.getUTCDay();
  const offset = (day + 6) % 7; // Monday-based week
  return addUtcDays(normalized, -offset);
};

const startOfUtcMonth = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));

export const resolveDashboardUtcDateRange = (
  key: DashboardDateRangeKey,
  now = new Date(),
): DashboardDateRange => {
  const today = normalizeUtcDate(now);
  const yesterday = addUtcDays(today, -1);
  const last24HoursStart = normalizeUtcDate(new Date(now.getTime() - DAY_MS));

  const label =
    DASHBOARD_DATE_RANGE_OPTIONS.find((option) => option.key === key)?.label ?? "Last 30 days";

  switch (key) {
    case "today":
      return { key, label, startDate: formatUtcDate(today), endDate: formatUtcDate(today) };
    case "yesterday":
      return {
        key,
        label,
        startDate: formatUtcDate(yesterday),
        endDate: formatUtcDate(yesterday),
      };
    case "last24Hours":
      return {
        key,
        label,
        startDate: formatUtcDate(last24HoursStart),
        endDate: formatUtcDate(today),
      };
    case "last7Days":
      return {
        key,
        label,
        startDate: formatUtcDate(addUtcDays(today, -6)),
        endDate: formatUtcDate(today),
      };
    case "weekToDate":
      return {
        key,
        label,
        startDate: formatUtcDate(startOfUtcWeek(today)),
        endDate: formatUtcDate(today),
      };
    case "monthToDate":
      return {
        key,
        label,
        startDate: formatUtcDate(startOfUtcMonth(today)),
        endDate: formatUtcDate(today),
      };
    case "last30Days":
    default:
      return {
        key: "last30Days",
        label: "Last 30 days",
        startDate: formatUtcDate(addUtcDays(today, -29)),
        endDate: formatUtcDate(today),
      };
  }
};

export const formatUtcTimeLabel = (now = new Date()) =>
  now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  });
