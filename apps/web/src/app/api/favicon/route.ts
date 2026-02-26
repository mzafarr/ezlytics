import { NextRequest, NextResponse } from "next/server";

// Cache favicons aggressively: 7 days browser + CDN, stale-while-revalidate 1 day
const CACHE_CONTROL = "public, max-age=604800, stale-while-revalidate=86400";

// Simple in-process memory cache so repeated requests within the same
// server instance are served instantly without even hitting Google.
const memCache = new Map<string, { body: ArrayBuffer; contentType: string }>();

function isValidDomain(domain: string): boolean {
  // Basic guard: no spaces, no protocol prefix, at least one dot
  return (
    typeof domain === "string" &&
    domain.length > 0 &&
    domain.length < 253 &&
    !domain.includes(" ") &&
    !domain.includes("/") &&
    !domain.includes("..") &&
    domain.includes(".")
  );
}

export const GET = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain") ?? "";

  if (!isValidDomain(domain)) {
    return new NextResponse(null, { status: 400 });
  }

  // Serve from in-process cache if available
  const cached = memCache.get(domain);
  if (cached) {
    return new NextResponse(cached.body, {
      status: 200,
      headers: {
        "Content-Type": cached.contentType,
        "Cache-Control": CACHE_CONTROL,
        "X-Cache": "HIT",
      },
    });
  }

  // Fetch from Google's favicon service (sz=32 gives a crisp 32×32 icon)
  const upstreamUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EzlyticsFaviconProxy/1.0)",
      },
      // Next.js fetch cache: revalidate every 7 days at the framework level too
      next: { revalidate: 604800 },
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: 502 });
    }

    const contentType =
      upstream.headers.get("content-type") ?? "image/png";
    const body = await upstream.arrayBuffer();

    // Store in process-level cache (unbounded but favicon files are tiny ~1-4 KB each)
    if (memCache.size < 5000) {
      memCache.set(domain, { body, contentType });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
        "X-Cache": "MISS",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
};
