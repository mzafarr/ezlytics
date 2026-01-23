import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const read = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

test("site schema defines an api key column", () => {
  const content = read("packages/db/src/schema/site.ts");
  assert.ok(content.includes("apiKey"));
  assert.ok(content.includes("api_key"));
});

test("sites router supports api key rotation", () => {
  const content = read("packages/api/src/routers/index.ts");
  assert.ok(content.includes("rotateApiKey"));
  assert.ok(content.includes("key_"));
});

test("proxy endpoints expose script and events routes", () => {
  const scriptRoute = read("apps/web/src/app/js/script.js/route.ts");
  assert.ok(scriptRoute.includes("application/javascript"));

  const eventsRoute = read("apps/web/src/app/api/events/route.ts");
  assert.ok(eventsRoute.includes("/api/v1/ingest"));
  assert.ok(eventsRoute.includes("authorization"));
  assert.ok(eventsRoute.includes("user-agent"));
  assert.ok(eventsRoute.includes('get("user-agent") ?? ""'));
});

test("ingest rejects mismatched session ids", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("sessionId and session_id must match"));
});

test("ingest accepts a single session id", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("payload.sessionId ?? payload.session_id"));
});

test("ingest coerces numeric ts strings", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("z.preprocess"));
  assert.ok(ingestRoute.includes('typeof value === "string"'));
  assert.ok(ingestRoute.includes("return Number(trimmed)"));
});

test("ingest treats missing user-agent as non-bot", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("if (!value) {"));
  assert.ok(ingestRoute.includes("return false;"));
});

test("ingest restricts bot flag to privileged requests", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("payload.bot !== undefined"));
  assert.ok(ingestRoute.includes("Bot flag requires a server key"));
  assert.ok(ingestRoute.includes("x-ingest-server-key"));
  assert.ok(ingestRoute.includes("INGEST_SERVER_KEY"));
});

test("ingest defines MAX_BACKFILL_MS for 24h backfill window", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("MAX_BACKFILL_MS"));
  assert.ok(ingestRoute.includes("24 * 60 * 60 * 1000"));
});

test("ingest rejects timestamps more than 24h in the past", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("more than 24h in the past"));
});

test("ingest rejects timestamps more than 5 minutes in the future", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("more than 5 minutes in the future"));
});
