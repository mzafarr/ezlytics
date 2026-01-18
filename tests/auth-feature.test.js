import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const read = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");

test("auth config enables magic link, Google OAuth, and account linking", () => {
  const content = read("packages/auth/src/index.ts");
  assert.ok(content.includes("magicLink"));
  assert.ok(content.includes("socialProviders"));
  assert.ok(content.includes("google"));
  assert.ok(content.includes("accountLinking"));
  assert.ok(content.includes('trustedProviders: ["google"]'));
});

test("auth client enables magic link plugin", () => {
  const content = read("apps/web/src/lib/auth-client.ts");
  assert.ok(content.includes("magicLinkClient"));
});

test("sign-in form supports email, magic link, and Google auth", () => {
  const content = read("apps/web/src/components/sign-in-form.tsx");
  assert.ok(content.includes("signIn.email"));
  assert.ok(content.includes("signIn.magicLink"));
  assert.ok(content.includes('provider: "google"'));
});

test("sign-up form supports email and Google auth", () => {
  const content = read("apps/web/src/components/sign-up-form.tsx");
  assert.ok(content.includes("signUp.email"));
  assert.ok(content.includes("signIn.social"));
  assert.ok(content.includes('provider: "google"'));
});

test("user menu includes sign out action", () => {
  const content = read("apps/web/src/components/user-menu.tsx");
  assert.ok(content.includes("signOut"));
});
