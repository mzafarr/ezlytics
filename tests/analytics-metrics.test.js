import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const read = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

test("visitors now excludes bots and non-pageviews", () => {
  const content = read("packages/api/src/routers/index.ts");
  assert.ok(content.includes('eq(rawEvent.type, "pageview")'));
  assert.ok(!content.includes("in ('pageview', 'heartbeat')"));
  assert.ok(content.includes("normalized}->>'bot'"));
  assert.ok(content.includes("visitorsNowCutoff"));
});

test("range visitors are unique across date range", () => {
  const content = read("packages/api/src/routers/index.ts");
  assert.ok(content.includes("rangeVisitors"));
  assert.ok(content.includes("count(distinct"));
  assert.ok(content.includes('eq(rawEvent.type, "pageview")'));
  assert.ok(content.includes("normalized}->>'bot'"));
});

test("dashboard visitors use range-unique totals", () => {
  const overviewHook = read("apps/web/src/app/dashboard/use-dashboard-overview-data.ts");
  const dataHook = read("apps/web/src/components/dashboard/hooks/use-dashboard-data.ts");
  assert.ok(overviewHook.includes("rangeVisitors"));
  assert.ok(dataHook.includes("rangeVisitors"));
});

test("session metrics use session start timestamp", () => {
  const metrics = read("apps/web/src/app/api/v1/ingest/metrics.ts");
  assert.ok(metrics.includes("first_timestamp"));
  assert.ok(metrics.includes("firstTimestamp"));
  assert.ok(metrics.includes("sessions = -1"));
});

test("rollup rebuild attributes session metrics to session start", () => {
  const rebuild = read("apps/web/src/lib/rollup-rebuild.ts");
  assert.ok(rebuild.includes("firstTimestamp"));
  assert.ok(rebuild.includes("nextStartDateKey"));
  assert.ok(rebuild.includes("previousStartDateKey"));
});

test("rollup rebuild mirrors ingest rollup timestamp semantics", () => {
  const rebuild = read("apps/web/src/lib/rollup-rebuild.ts");
  assert.ok(rebuild.includes("usedClientTimestamp === true"));
  assert.ok(rebuild.includes("createdAtTimestamp"));
});

test("rollup rebuild deletes each rollup table with table-specific filters", () => {
  const rebuild = read("apps/web/src/lib/rollup-rebuild.ts");
  assert.ok(rebuild.includes("deleteDailyFilters"));
  assert.ok(rebuild.includes("deleteHourlyFilters"));
  assert.ok(rebuild.includes("deleteDimensionDailyFilters"));
  assert.ok(rebuild.includes("deleteDimensionHourlyFilters"));
  assert.ok(rebuild.includes("db.delete(rollupHourly).where(deleteHourlyFilters)"));
  assert.ok(
    rebuild.includes(
      "db.delete(rollupDimensionDaily).where(deleteDimensionDailyFilters)",
    ),
  );
});

test("geo points query filters by event timestamp, includes end-of-day, and excludes bots", () => {
  const content = read("packages/api/src/routers/index.ts");
  assert.ok(content.includes("events.timestamp"));
  assert.ok(content.includes("T23:59:59.999Z"));
  assert.ok(content.includes("events.normalized"));
  assert.ok(content.includes("orderBy: (events, { desc }) => [desc(events.timestamp)]"));
});

test("ingest applies session-start context updates to dimension rollups", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  const ingestMetrics = read("apps/web/src/app/api/v1/ingest/metrics.ts");
  const rollups = read("apps/web/src/lib/rollups.ts");
  assert.ok(ingestRoute.includes("dimensionUpdates"));
  assert.ok(ingestRoute.includes("extractSessionDimensionRollups"));
  assert.ok(ingestMetrics.includes("first_normalized"));
  assert.ok(rollups.includes("extractSessionDimensionRollups"));
});

test("rollup rebuild adds session dimensions and supports diff mode", () => {
  const rebuild = read("apps/web/src/lib/rollup-rebuild.ts");
  const rebuildRoute = read("apps/web/src/app/api/cron/rollup-rebuild/route.ts");
  assert.ok(rebuild.includes("Session dimension rollups use first-pageview context"));
  assert.ok(rebuild.includes("includeDiff"));
  assert.ok(rebuild.includes("diff:"));
  assert.ok(rebuildRoute.includes("includeDiff"));
});

test("stats row includes KPI definition tooltips for core metrics", () => {
  const statsRow = read("apps/web/src/components/dashboard/stats-row.tsx");
  assert.ok(statsRow.includes("metricDefinitions"));
  assert.ok(statsRow.includes("Visitors now"));
  assert.ok(statsRow.includes("Bounce rate"));
  assert.ok(statsRow.includes("Avg session"));
  assert.ok(statsRow.includes("Info"));
});

test("dashboard overview query is date-range aware and anchored to selected UTC range", () => {
  const dashboard = read("apps/web/src/app/dashboard/dashboard.tsx");
  const rangeHelpers = read("apps/web/src/app/dashboard/overview-time-range.ts");
  assert.ok(dashboard.includes("resolveDashboardUtcDateRange"));
  assert.ok(dashboard.includes("startDate: selectedRange.startDate"));
  assert.ok(dashboard.includes("endDate: selectedRange.endDate"));
  assert.ok(rangeHelpers.includes("last30Days"));
  assert.ok(rangeHelpers.includes("Week to date"));
});

test("dashboard site list uses summary endpoint instead of per-site rollup fanout", () => {
  const dashboard = read("apps/web/src/app/dashboard/dashboard.tsx");
  const router = read("packages/api/src/routers/index.ts");
  assert.ok(dashboard.includes("trpc.sites.summary.queryOptions"));
  assert.ok(!dashboard.includes("Promise.all("));
  assert.ok(router.includes("sites.summary"));
  assert.ok(router.includes("coalesce(sum("));
});

test("overview chart supports daily and weekly bucketing", () => {
  const overviewHook = read("apps/web/src/app/dashboard/use-dashboard-overview-data.ts");
  assert.ok(overviewHook.includes('granularity === "daily"'));
  assert.ok(overviewHook.includes("const weeklyMap = new Map"));
  assert.ok(overviewHook.includes("Wk "));
});

test("overview toolbar exposes site identity and range/granularity dropdowns", () => {
  const toolbar = read("apps/web/src/app/dashboard/_components/overview-toolbar.tsx");
  assert.ok(toolbar.includes("/favicon.ico"));
  assert.ok(toolbar.includes("Current UTC time"));
  assert.ok(toolbar.includes("DASHBOARD_DATE_RANGE_OPTIONS"));
  assert.ok(toolbar.includes("DASHBOARD_GRANULARITY_OPTIONS"));
});

test("rollups endpoint supports split payload flags and bounded limits", () => {
  const router = read("packages/api/src/routers/index.ts");
  assert.ok(router.includes("includeDimensions"));
  assert.ok(router.includes("includeGeoPoints"));
  assert.ok(router.includes("resolveBoundedDateRange"));
  assert.ok(router.includes("Promise.all(["));
  assert.ok(router.includes("dimensionLimit"));
  assert.ok(router.includes("geoPointLimit"));
});

test("kpi snapshot endpoint returns range + realtime metrics from one request snapshot", () => {
  const router = read("packages/api/src/routers/index.ts");
  assert.ok(router.includes("kpiSnapshot"));
  assert.ok(router.includes("snapshotAt"));
  assert.ok(router.includes("visitorsNowCutoff"));
  assert.ok(router.includes("rangeVisitorsQueryMs"));
  assert.ok(router.includes("visitorsNowQueryMs"));
  assert.ok(router.includes("analytics.kpiSnapshot"));
});

test("kpi snapshot supports server-side rolling last-24-hours preset", () => {
  const router = read("packages/api/src/routers/index.ts");
  assert.ok(router.includes('rangePreset: z.enum(["last24Hours"]).optional()'));
  assert.ok(router.includes("nowTimestamp - DAY_MS"));
  assert.ok(router.includes("sessionsRangeQueryMs"));
});

test("dashboard stats cards consume kpi snapshot query", () => {
  const dashboard = read("apps/web/src/app/dashboard/dashboard.tsx");
  assert.ok(dashboard.includes("trpc.analytics.kpiSnapshot.queryOptions"));
  assert.ok(dashboard.includes('rangePreset: "last24Hours"'));
  assert.ok(dashboard.includes("refetchInterval: siteId ? 10_000 : false"));
  assert.ok(dashboard.includes("kpiSnapshotQuery.data?.visitors"));
  assert.ok(dashboard.includes("kpiSnapshotQuery.data?.visitorsNow"));
});

test("ingest clamps small future client timestamps to server-now for realtime consistency", () => {
  const normalize = read("apps/web/src/app/api/v1/ingest/normalize.ts");
  assert.ok(normalize.includes("if (skew > 0)"));
  assert.ok(normalize.includes("usedClientTimestamp: false"));
});

test("ingest returns debug timing metadata outside production", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("process.env.NODE_ENV !== \"production\""));
  assert.ok(ingestRoute.includes("usedClientTimestamp"));
  assert.ok(ingestRoute.includes("clockSkewMs"));
});

test("ingest schema supports heartbeat events for realtime presence", () => {
  const schema = read("apps/web/src/app/api/v1/ingest/schema.ts");
  const script = read("apps/web/public/script.js");
  assert.ok(schema.includes("\"heartbeat\""));
  assert.ok(script.includes("type: \"heartbeat\""));
  assert.ok(script.includes("HEARTBEAT_INTERVAL_MS"));
});

test("webhook routes use distinct raw event ids for payment and goal", () => {
  const stripe = read("apps/web/src/app/api/webhooks/stripe/[websiteId]/route.ts");
  const lemonsqueezy = read("apps/web/src/app/api/webhooks/lemonsqueezy/[websiteId]/route.ts");
  assert.ok(stripe.includes(":payment"));
  assert.ok(stripe.includes(":goal"));
  assert.ok(lemonsqueezy.includes(":payment"));
  assert.ok(lemonsqueezy.includes(":goal"));
});

test("payments endpoint records payment revenue rollups even without visitor id", () => {
  const content = read("apps/web/src/app/api/v1/payments/route.ts");
  assert.ok(content.includes("visitorIdForPaymentEvent"));
  assert.ok(content.includes("metrics: paymentMetrics"));
});

test("overview normalizes rollup dates to YYYY-MM-DD keys", () => {
  const overviewHook = read("apps/web/src/app/dashboard/use-dashboard-overview-data.ts");
  assert.ok(overviewHook.includes("const toDateKey"));
  assert.ok(overviewHook.includes("raw.slice(0, 10)"));
  assert.ok(overviewHook.includes("entry.date.length === 10"));
});
