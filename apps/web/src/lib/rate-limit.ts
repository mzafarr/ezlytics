import { NextRequest } from "next/server";

import { env } from "@my-better-t-app/env/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | { ok: true }
  | {
      ok: false;
      retryAfter: number;
    };

const WINDOW_SECONDS = env.RATE_LIMIT_WINDOW_SECONDS ?? 60;
const MAX_REQUESTS_PER_IP = env.RATE_LIMIT_MAX_REQUESTS_PER_IP ?? 60;
const MAX_REQUESTS_PER_SITE = env.RATE_LIMIT_MAX_REQUESTS_PER_SITE ?? 300;

const getStore = () => {
  const globalScope = globalThis as typeof globalThis & {
    __rateLimitStore?: Map<string, RateLimitBucket>;
  };
  if (!globalScope.__rateLimitStore) {
    globalScope.__rateLimitStore = new Map();
  }
  return globalScope.__rateLimitStore;
};

const consumeBucket = (key: string, limit: number) => {
  const store = getStore();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + WINDOW_SECONDS * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, retryAfter: 0 };
  }

  if (existing.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { allowed: false, retryAfter };
  }

  existing.count += 1;
  store.set(key, existing);
  return { allowed: true, retryAfter: 0 };
};

export const getClientIp = (request: NextRequest) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-vercel-ip") ||
    request.headers.get("cf-connecting-ip") ||
    ""
  );
};

export const checkRateLimit = ({
  ip,
  siteId,
  scope,
}: {
  ip?: string | null;
  siteId?: string | null;
  scope: string;
}): RateLimitResult => {
  const retryAfter: number[] = [];

  if (ip) {
    const ipResult = consumeBucket(`${scope}:ip:${ip}`, MAX_REQUESTS_PER_IP);
    if (!ipResult.allowed) {
      retryAfter.push(ipResult.retryAfter);
    }
  }

  if (siteId) {
    const siteResult = consumeBucket(
      `${scope}:site:${siteId}`,
      MAX_REQUESTS_PER_SITE,
    );
    if (!siteResult.allowed) {
      retryAfter.push(siteResult.retryAfter);
    }
  }

  if (retryAfter.length > 0) {
    return { ok: false, retryAfter: Math.max(...retryAfter) };
  }

  return { ok: true };
};
