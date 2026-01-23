import { NextRequest, NextResponse } from "next/server";

const getCorsHeaders = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
};

const withCors = (response: Response, origin: string | null) => {
  const nextResponse = response instanceof NextResponse
    ? response
    : new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
  const corsHeaders = getCorsHeaders(origin);
  for (const [key, value] of Object.entries(corsHeaders)) {
    nextResponse.headers.set(key, value);
  }
  if (origin) {
    nextResponse.headers.append("Vary", "Origin");
  }
  return nextResponse;
};

const forwardHeaders = (request: NextRequest, body?: string) => {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  const contentLength = body ? Buffer.byteLength(body).toString() : null;
  if (contentLength) {
    headers.set("content-length", contentLength);
  }
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("authorization", authorization);
  }
  const userAgent = request.headers.get("user-agent") ?? "";
  headers.set("user-agent", userAgent);
  return headers;
};

export const POST = async (request: NextRequest) => {
  const body = await request.text();
  const sourceUrl = new URL(request.url);
  const target = new URL("/api/v1/ingest", request.url);
  sourceUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });
  const response = await fetch(target.toString(), {
    method: "POST",
    headers: forwardHeaders(request, body),
    body,
  });
  return withCors(response, request.headers.get("origin"));
};

export const OPTIONS = (request: NextRequest) => {
  return withCors(new NextResponse(null, { status: 204 }), request.headers.get("origin"));
};
