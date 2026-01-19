import { NextRequest, NextResponse } from "next/server";

import { verifyApiKey } from "@my-better-t-app/api/api-key";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const rateLimitResponse = (retryAfter: number) =>
  NextResponse.json(
    { error: "Rate limit exceeded", retry_after: retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": retryAfter.toString(),
      },
    },
  );

const handler = async (request: NextRequest) => {
  const authResult = await verifyApiKey(request.headers.get("authorization"));
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const rateLimit = checkRateLimit({
    ip: getClientIp(request),
    siteId: authResult.siteId,
    scope: "api",
  });
  if (!rateLimit.ok) {
    return rateLimitResponse(rateLimit.retryAfter);
  }

  return NextResponse.json(
    { error: "Not found" },
    { status: 404 },
  );
};

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
