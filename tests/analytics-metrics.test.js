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
  assert.ok(content.includes("normalized}->>'bot'"));
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
