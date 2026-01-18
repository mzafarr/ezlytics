import { NextRequest, NextResponse } from "next/server";

import { verifyApiKey } from "@my-better-t-app/api/api-key";

const handler = async (request: NextRequest) => {
  const authResult = await verifyApiKey(request.headers.get("authorization"));
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  return NextResponse.json(
    { error: "Not found" },
    { status: 404 },
  );
};

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
