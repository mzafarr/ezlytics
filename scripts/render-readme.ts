import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BRAND_DESCRIPTION, BRAND_NAME } from "@my-better-t-app/config/brand";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const templatePath = path.join(repoRoot, "README.template.md");
const outputPath = path.join(repoRoot, "README.md");

const template = await readFile(templatePath, "utf8");
const output = template
  .replaceAll("{{brandName}}", BRAND_NAME)
  .replaceAll("{{brandDescription}}", BRAND_DESCRIPTION);

await writeFile(outputPath, output);
