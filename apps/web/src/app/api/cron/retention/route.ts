import { NextRequest, NextResponse } from "next/server";

import { env } from "@my-better-t-app/env/server";
import { runRetentionCleanup } from "@/lib/retention";

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

const handler = async (request: NextRequest) => {
  const secret = env.RETENTION_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Retention cron secret not configured" },
      { status: 500 },
    );
  }
  const token = getAuthToken(request);
  if (!token || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await runRetentionCleanup();
  return NextResponse.json({ ok: true });
};

export { handler as GET, handler as POST };
