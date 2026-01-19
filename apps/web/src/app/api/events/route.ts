import { NextRequest } from "next/server";

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
  return headers;
};

export const POST = async (request: NextRequest) => {
  const body = await request.text();
  const target = new URL("/api/v1/ingest", request.url);
  const response = await fetch(target.toString(), {
    method: "POST",
    headers: forwardHeaders(request, body),
    body,
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
