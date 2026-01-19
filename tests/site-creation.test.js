import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const read = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

test("site creation UI collects name and root domain", () => {
  const content = read("apps/web/src/app/dashboard/dashboard.tsx");
  assert.ok(content.includes("Site name"));
  assert.ok(content.includes("Root domain"));
});

test("install snippet includes required data attributes and copy control", () => {
  const content = read("apps/web/src/app/dashboard/dashboard.tsx");
  assert.ok(content.includes("data-website-id"));
  assert.ok(content.includes("data-domain"));
  assert.ok(content.includes("/js/script.js"));
  assert.ok(content.includes("Copy snippet"));
});

test("site API creates a public website id", () => {
  const content = read("packages/api/src/routers/index.ts");
  assert.ok(content.includes("websiteId"));
  assert.ok(content.includes("web_"));
  assert.ok(content.includes("randomUUID"));
});
