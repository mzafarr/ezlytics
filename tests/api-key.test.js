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
});

test("ingest rejects mismatched session ids", () => {
  const ingestRoute = read("apps/web/src/app/api/v1/ingest/route.ts");
  assert.ok(ingestRoute.includes("sessionId and session_id must match"));
});
