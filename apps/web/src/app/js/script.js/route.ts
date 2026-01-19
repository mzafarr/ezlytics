import { readFileSync } from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

const scriptPath = path.join(process.cwd(), "public/script.js");
const script = readFileSync(scriptPath, "utf8");

export const GET = () =>
  new NextResponse(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=3600, immutable",
    },
  });
