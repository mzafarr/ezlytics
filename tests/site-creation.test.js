import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const read = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

test("site creation onboarding collects domain and timezone", () => {
  const content = read("apps/web/src/app/dashboard/new/step-one.tsx");
  assert.ok(content.includes("Domain"));
  assert.ok(content.includes("Timezone"));
});

test("install snippet includes required data attributes and copy control", () => {
  const content = read("apps/web/src/components/dashboard/views/SettingsView.tsx");
  assert.ok(content.includes("data-website-id"));
  assert.ok(content.includes("data-domain"));
  assert.ok(content.includes("data-api-key"));
  assert.ok(content.includes("/js/script.js"));
  assert.ok(content.includes("Copy"));
});

test("site API creates a public website id", () => {
  const content = read("packages/api/src/routers/index.ts");
  assert.ok(content.includes("websiteId"));
  assert.ok(content.includes("web_"));
  assert.ok(content.includes("randomUUID"));
});
