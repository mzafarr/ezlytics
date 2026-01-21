import z from "zod";

export const storageKeyFunnels = "datafast.funnels";
export const storageKeyExclusions = "datafast.exclusions";
export const storageKeyPrimaryGoal = "datafast.primaryGoal";
export const storageKeyDemoVisitorId = "datafast.demoVisitorId";
export const storageKeySavedViews = "datafast.savedViews";
export const storageKeyFilters = "datafast.filters";
export const defaultDemoVisitorId = "visitor-1";

export const directReferrerLabel = "(direct)";
export const notSetLabel = "(not set)";

export const funnelStepSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("page"),
    urlContains: z.string(),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("goal"),
    goalName: z.string(),
  }),
]);

export const funnelSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(funnelStepSchema),
});

export const funnelsSchema = z.array(funnelSchema);
export const exclusionSchema = z.object({
  pathPatterns: z.string(),
  countries: z.string(),
  hostnames: z.string(),
  excludeSelf: z.boolean(),
});
export const revenueProviderSchema = z.object({
  provider: z.enum(["none", "stripe", "lemonsqueezy"]),
  webhookSecret: z.string(),
});
export const filtersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  referrer: z.string(),
  source: z.string(),
  medium: z.string(),
  campaign: z.string(),
  content: z.string(),
  term: z.string(),
  country: z.string(),
  device: z.string(),
  browser: z.string(),
  os: z.string(),
  pagePath: z.string(),
  goalName: z.string(),
});
export const savedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  filters: filtersSchema,
});
export const savedViewsSchema = z.array(savedViewSchema);

export type Funnel = z.infer<typeof funnelSchema>;
export type FunnelStep = z.infer<typeof funnelStepSchema>;
export type SavedView = z.infer<typeof savedViewSchema>;
export type Filters = z.infer<typeof filtersSchema>;
export type Exclusions = z.infer<typeof exclusionSchema>;

export const defaultFilters: Filters = {
  startDate: "",
  endDate: "",
  referrer: "",
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
  country: "",
  device: "",
  browser: "",
  os: "",
  pagePath: "",
  goalName: "",
};

export const defaultExclusions = {
  pathPatterns: "",
  countries: "",
  hostnames: "",
  excludeSelf: false,
};
export const defaultRevenueProvider = {
  provider: "none" as const,
  webhookSecret: "",
};

export const filterLabels: Record<keyof Filters, string> = {
  startDate: "Start date",
  endDate: "End date",
  referrer: "Referrer",
  source: "Source",
  medium: "Medium",
  campaign: "Campaign",
  content: "Content",
  term: "Term",
  country: "Country",
  device: "Device",
  browser: "Browser",
  os: "OS",
  pagePath: "Page path",
  goalName: "Goal name",
};

export type DashboardView = "overview" | "funnels" | "settings";

export type AnalyticsSample = {
  date: string;
  timestamp: string;
  referrer: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  country: string;
  region: string;
  city: string;
  device: string;
  browser: string;
  os: string;
  path: string;
  hostname: string;
  visitorId: string;
  goal: string;
  revenue: number;
  eventType: "pageview" | "goal";
  metadata?: Record<string, string | number | boolean | null>;
};

export type VisitorSummary = {
  visitorId: string;
  visitCount: number;
  lastSeen: string;
  lastSeenAt: number;
  firstSeen: string;
  firstSeenAt: number;
  lastPath: string;
  lastReferrer: string;
  source: string;
  campaign: string;
  country: string;
  device: string;
  browser: string;
  os: string;
  pageviews: number;
  goals: number;
  revenue: number;
};

export type GoalSummary = {
  name: string;
  total: number;
  unique: number;
  conversionRate: number;
  value?: number;
  sources: Record<string, number>;
  pages: Record<string, number>;
};
