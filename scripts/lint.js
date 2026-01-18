import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const tscPath = path.join(repoRoot, "node_modules", ".bin", "tsc");

const projects = [
  "apps/web/tsconfig.json",
  "packages/auth/tsconfig.json",
];

for (const project of projects) {
  const result = spawnSync(
    tscPath,
    ["-p", path.join(repoRoot, project), "--noEmit"],
    { stdio: "inherit" },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
