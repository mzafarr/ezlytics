import { NextRequest, NextResponse } from "next/server";

import { env } from "@my-better-t-app/env/server";
import { runRollupRebuild } from "@/lib/rollup-rebuild";

const getAuthToken = (request: NextRequest) => {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) {
    return match[1];
  }
  const headerSecret = request.headers.get("x-cron-secret");
  if (headerSecret) {
    return headerSecret;
  }
  return request.nextUrl.searchParams.get("secret");
};

const parseDateParam = (value: string | null, label: string) => {
  if (!value) {
    return { ok: false as const, error: `${label} is required` };
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return { ok: false as const, error: `${label} is invalid` };
  }
  return { ok: true as const, value: parsed };
};

const handler = async (request: NextRequest) => {
  const secret = env.ROLLUP_REBUILD_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Rollup rebuild secret not configured" },
      { status: 500 },
    );
  }
  const token = getAuthToken(request);
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const siteId = searchParams.get("siteId") ?? searchParams.get("site_id");
  const dryRun =
    searchParams.get("dryRun") === "true" ||
    searchParams.get("dry_run") === "true";
  const includeDiff =
    searchParams.get("diff") === "true" ||
    searchParams.get("includeDiff") === "true" ||
    searchParams.get("include_diff") === "true" ||
    dryRun;

  const fromParam = parseDateParam(searchParams.get("from"), "from");
  if (!fromParam.ok) {
    return NextResponse.json({ error: fromParam.error }, { status: 400 });
  }
  const toParam = parseDateParam(searchParams.get("to"), "to");
  if (!toParam.ok) {
    return NextResponse.json({ error: toParam.error }, { status: 400 });
  }

  try {
    const result = await runRollupRebuild({
      siteId,
      from: fromParam.value,
      to: toParam.value,
      dryRun,
      includeDiff,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Rollup rebuild failed",
      },
      { status: 500 },
    );
  }
};

export { handler as GET, handler as POST };
