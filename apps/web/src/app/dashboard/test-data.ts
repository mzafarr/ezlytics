/**
 * Comprehensive test data for the dashboard.
 * This data is stored locally and shown instantly without any API/database calls.
 * Covers all sorts of cases for testing and debugging purposes.
 */

import type {
  ChartDatum,
  GeoDot,
  DashboardOverviewData,
} from "./use-dashboard-overview-data";

// Helper to generate dates for the last N days
function generateDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// Generate 30 days of comprehensive chart data
const dates = generateDateRange(30);

export const TEST_CHART_DATA: ChartDatum[] = dates.map((date, index) => {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Simulate realistic traffic patterns
  // - Weekends have lower traffic
  // - Mid-week (Tue-Thu) has peak traffic
  // - Some days have spikes (viral content, marketing campaigns)
  const baseVisitors = isWeekend ? 800 : 2500;
  const midWeekBoost =
    dayOfWeek === 2 || dayOfWeek === 3 || dayOfWeek === 4 ? 500 : 0;

  // Simulate a viral spike on day 10 and day 25
  const viralSpike = index === 10 || index === 25 ? 3000 : 0;

  // Add some randomness (seeded by index for consistency)
  const variation = Math.sin(index * 0.5) * 400;

  const visitors = Math.round(
    baseVisitors + midWeekBoost + viralSpike + variation,
  );

  // Revenue varies based on visitors and conversion
  // Some days have better conversion (sales, promotions)
  const isPromotionDay = index === 5 || index === 15 || index === 22;
  const baseConversion = isPromotionDay ? 5.5 : 3.2;
  const conversionRate = baseConversion + Math.sin(index * 0.3) * 0.8;
  const sessions = Math.round(visitors * 1.3); // Avg 1.3 sessions per visitor
  const goals = Math.round(sessions * (conversionRate / 100));

  // Revenue breakdown (higher refunds for visible dotted pattern)
  const avgOrderValue = 45 + Math.sin(index * 0.4) * 15;
  const revenue = Math.round(goals * avgOrderValue);
  const refundRate = 0.1 + Math.sin(index * 0.7) * 0.1; // 10-20% refunds
  const revenueRefund = Math.round(revenue * refundRate);
  const revenueNew = revenue - revenueRefund; // New = total minus refunds
  const revenueRenewal = 0; // Simplified

  const revenuePerVisitor = visitors > 0 ? revenue / visitors : 0;

  return {
    date,
    dateLabel: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    visitors,
    revenue,
    revenueNew,
    revenueRenewal,
    revenueRefund,
    revenuePerVisitor,
    conversionRate,
  };
});

// Calculate totals from chart data
const visitorsTotal = TEST_CHART_DATA.reduce((sum, d) => sum + d.visitors, 0);
const revenueTotal = TEST_CHART_DATA.reduce((sum, d) => sum + d.revenue, 0);
const revenueNewTotal = TEST_CHART_DATA.reduce(
  (sum, d) => sum + d.revenueNew,
  0,
);
const revenueRenewalTotal = TEST_CHART_DATA.reduce(
  (sum, d) => sum + d.revenueRenewal,
  0,
);
const revenueRefundTotal = TEST_CHART_DATA.reduce(
  (sum, d) => sum + d.revenueRefund,
  0,
);

export const TEST_STATS_DATA = {
  visitorsCount: visitorsTotal,
  visitorsNowCount: 127, // Simulated live visitors
  totalRevenue: revenueTotal,
  primaryConversionRate: 3.8,
  revenuePerVisitor: revenueTotal / visitorsTotal,
  bounceRate: 38.2,
  avgSessionDurationMs: 187000, // 3m 7s
  deltas: {
    visitors: 18.5,
    revenue: 24.3,
    conversionRate: 5.2,
    revenuePerVisitor: 4.8,
    bounceRate: -8.1, // Negative is good (less bouncing)
    avgSessionDurationMs: 12.4,
  },
};

// Top referrers - diverse sources
export const TEST_TOP_REFERRERS: Array<[string, number]> = [
  ["google.com", 28450],
  ["twitter.com", 12340],
  ["linkedin.com", 8920],
  ["facebook.com", 6780],
  ["reddit.com", 5430],
  ["producthunt.com", 4210],
];

// UTM sources - marketing campaign tracking
export const TEST_TOP_SOURCES: Array<[string, number]> = [
  ["direct", 32100],
  ["google", 18500],
  ["newsletter", 8900],
  ["twitter_ads", 6200],
  ["influencer_collab", 4100],
  ["podcast_mention", 2800],
];

// Top pages - realistic URL patterns
export const TEST_TOP_PAGES: Array<[string, number]> = [
  ["/", 45200],
  ["/pricing", 18900],
  ["/features", 12400],
  ["/docs/getting-started", 9800],
  ["/blog/why-analytics-matter", 7600],
  ["/dashboard", 6200],
  ["/docs/api-reference", 5100],
  ["/about", 3400],
];

// Countries - global distribution
export const TEST_TOP_COUNTRIES: Array<[string, number]> = [
  ["United States", 38200],
  ["United Kingdom", 12400],
  ["Germany", 8900],
  ["Canada", 6700],
  ["France", 5400],
];

// Devices
export const TEST_TOP_DEVICES: Array<[string, number]> = [
  ["Desktop", 52100],
  ["Mobile", 24300],
  ["Tablet", 4200],
];

// Browsers
export const TEST_TOP_BROWSERS: Array<[string, number]> = [
  ["Chrome", 48200],
  ["Safari", 18900],
  ["Firefox", 7800],
  ["Edge", 4600],
  ["Arc", 1100],
  ["Brave", 980],
];

// Geo dots for the map - global distribution
export const TEST_GEO_DOTS: GeoDot[] = [
  // North America
  { lat: 40.7128, lng: -74.006, count: 8900, x: 294, y: 115, size: 8 }, // NYC
  { lat: 34.0522, lng: -118.2437, count: 6200, x: 172, y: 131, size: 7 }, // LA
  { lat: 37.7749, lng: -122.4194, count: 5100, x: 160, y: 122, size: 6 }, // SF
  { lat: 41.8781, lng: -87.6298, count: 3800, x: 256, y: 112, size: 5 }, // Chicago
  { lat: 51.5074, lng: -0.1278, count: 4200, x: 398, y: 90, size: 6 }, // London
  { lat: 43.6532, lng: -79.3832, count: 2100, x: 278, y: 108, size: 4 }, // Toronto
  { lat: 29.7604, lng: -95.3698, count: 2400, x: 234, y: 140, size: 4 }, // Houston

  // Europe
  { lat: 52.52, lng: 13.405, count: 3100, x: 428, y: 88, size: 5 }, // Berlin
  { lat: 48.8566, lng: 2.3522, count: 2800, x: 404, y: 96, size: 5 }, // Paris
  { lat: 55.7558, lng: 37.6173, count: 1900, x: 481, y: 80, size: 4 }, // Moscow
  { lat: 41.9028, lng: 12.4964, count: 1600, x: 426, y: 112, size: 3 }, // Rome
  { lat: 59.3293, lng: 18.0686, count: 1200, x: 438, y: 71, size: 3 }, // Stockholm

  // Asia
  { lat: 35.6762, lng: 139.6503, count: 2600, x: 710, y: 127, size: 4 }, // Tokyo
  { lat: 22.3193, lng: 114.1694, count: 1800, x: 653, y: 158, size: 3 }, // Hong Kong
  { lat: 1.3521, lng: 103.8198, count: 1300, x: 630, y: 207, size: 3 }, // Singapore
  { lat: 28.6139, lng: 77.209, count: 2100, x: 570, y: 143, size: 4 }, // Delhi
  { lat: 31.2304, lng: 121.4737, count: 1500, x: 668, y: 137, size: 3 }, // Shanghai

  // Australia & Oceania
  { lat: -33.8688, lng: 151.2093, count: 1400, x: 735, y: 289, size: 3 }, // Sydney
  { lat: -37.8136, lng: 144.9631, count: 900, x: 721, y: 299, size: 2 }, // Melbourne

  // South America
  { lat: -23.5505, lng: -46.6333, count: 1100, x: 342, y: 265, size: 3 }, // Sao Paulo
  { lat: -34.6037, lng: -58.3816, count: 700, x: 322, y: 291, size: 2 }, // Buenos Aires

  // Africa
  { lat: -33.9249, lng: 18.4241, count: 600, x: 438, y: 289, size: 2 }, // Cape Town
  { lat: 30.0444, lng: 31.2357, count: 500, x: 468, y: 140, size: 2 }, // Cairo
];

// Full test data object matching DashboardOverviewData interface
export const TEST_OVERVIEW_DATA: Omit<
  DashboardOverviewData,
  "dailyEntries" | "dimensionTotals" | "sessionTotals" | "goalsTotal"
> & {
  chartData: ChartDatum[];
  topReferrers: Array<[string, number]>;
  topSources: Array<[string, number]>;
  topPages: Array<[string, number]>;
  visibleCountries: Array<[string, number]>;
  visibleDevices: Array<[string, number]>;
  visibleBrowsers: Array<[string, number]>;
  geoDots: GeoDot[];
} = {
  revenueTotals: {
    total: revenueTotal,
    new: revenueNewTotal,
    renewal: revenueRenewalTotal,
    refund: revenueRefundTotal,
  },
  visitorsTotal,
  conversionRate: TEST_STATS_DATA.primaryConversionRate,
  revenuePerVisitor: TEST_STATS_DATA.revenuePerVisitor,
  bounceRate: TEST_STATS_DATA.bounceRate,
  avgSessionDurationMs: TEST_STATS_DATA.avgSessionDurationMs,
  chartData: TEST_CHART_DATA,
  metricDeltas: TEST_STATS_DATA.deltas,
  topCountries: TEST_TOP_COUNTRIES,
  topReferrers: TEST_TOP_REFERRERS,
  topSources: TEST_TOP_SOURCES,
  topPages: TEST_TOP_PAGES,
  topDevices: TEST_TOP_DEVICES,
  topBrowsers: TEST_TOP_BROWSERS,
  visibleCountries: TEST_TOP_COUNTRIES,
  visibleDevices: TEST_TOP_DEVICES,
  visibleBrowsers: TEST_TOP_BROWSERS,
  geoDots: TEST_GEO_DOTS,
};
