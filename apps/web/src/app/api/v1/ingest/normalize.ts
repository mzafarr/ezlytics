/**
 * Ingest normalization helpers.
 *
 * Functions for normalizing, sanitizing and transforming input values
 * including URLs, domains, tracking parameters, user agents, and timestamps.
 */

import { z } from "zod";
import {
  MAX_STRING_LENGTH,
  MAX_BACKFILL_MS,
  MAX_CLIENT_TS_SKEW_MS,
  ALLOWED_TOP_LEVEL_KEYS,
  payloadSchema,
} from "@/app/api/v1/ingest/schema";

export const clampString = (value: string, maxLength = MAX_STRING_LENGTH) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

export const normalizeDomain = (value: string) => {
  const trimmed = clampString(value, 255).toLowerCase();
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
    );
    return parsed.hostname.toLowerCase();
  } catch (error) {
    return trimmed.split("/")[0] || "";
  }
};

export const isDomainAllowed = (eventDomain: string, siteDomain: string) => {
  if (!eventDomain || !siteDomain) {
    return false;
  }
  if (eventDomain === siteDomain) {
    return true;
  }
  return eventDomain.endsWith(`.${siteDomain}`);
};

export const botSignatures = [
  "bot",
  "crawler",
  "spider",
  "crawling",
  "headless",
  "slurp",
  "baiduspider",
  "bingbot",
  "duckduckbot",
  "facebookexternalhit",
  "facebot",
  "ia_archiver",
  "yandex",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "python-requests",
  "curl",
  "wget",
  "postmanruntime",
  "httpclient",
  "axios",
  "okhttp",
  "go-http-client",
];

export const isBotUserAgent = (value: string | null) => {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return botSignatures.some((signature) => normalized.includes(signature));
};

export const normalizeUrl = (value: string) => {
  const trimmed = clampString(value, 2048);
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed, "https://placeholder.local");
    const pathname = parsed.pathname || "/";
    const search = parsed.search || "";
    return `${pathname}${search}` || "/";
  } catch (error) {
    return trimmed;
  }
};

export const normalizeReferrer = (value: string) => {
  const trimmed = clampString(value, 2048);
  if (!trimmed) {
    return "";
  }
  try {
    const parsed = new URL(trimmed, "https://placeholder.local");
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.origin + parsed.pathname;
    }
    return parsed.href;
  } catch (error) {
    return trimmed;
  }
};

export const normalizeTrackingValue = (value?: string) => {
  if (!value) {
    return "";
  }
  return clampString(value.toLowerCase(), 255);
};

export const toBucketDate = (timestamp: Date) =>
  new Date(
    Date.UTC(
      timestamp.getUTCFullYear(),
      timestamp.getUTCMonth(),
      timestamp.getUTCDate(),
    ),
  )
    .toISOString()
    .slice(0, 10);

export const resolveEventTimestamp = (payload: {
  ts?: number;
  timestamp?: Date;
}) => {
  const nowMs = Date.now();
  const candidate =
    typeof payload.ts === "number" && Number.isFinite(payload.ts)
      ? payload.ts
      : payload.timestamp && Number.isFinite(payload.timestamp.getTime())
        ? payload.timestamp.getTime()
        : null;
  if (candidate === null) {
    return {
      eventDate: new Date(nowMs),
      serverDate: new Date(nowMs),
      clientTimestamp: null,
      clockSkewMs: null,
      usedClientTimestamp: false,
      rejection: null as "past" | "future" | null,
    };
  }
  const skew = candidate - nowMs;
  // Reject if more than 24h in the past
  if (skew < -MAX_BACKFILL_MS) {
    return {
      eventDate: new Date(nowMs),
      serverDate: new Date(nowMs),
      clientTimestamp: candidate,
      clockSkewMs: skew,
      usedClientTimestamp: false,
      rejection: "past" as const,
    };
  }
  // Reject if more than 5 minutes in the future
  if (skew > MAX_CLIENT_TS_SKEW_MS) {
    return {
      eventDate: new Date(nowMs),
      serverDate: new Date(nowMs),
      clientTimestamp: candidate,
      clockSkewMs: skew,
      usedClientTimestamp: false,
      rejection: "future" as const,
    };
  }
  // Within acceptable window: use client time for rollups
  // This covers: past up to 24h OR future up to 5min
  const eventDate = new Date(candidate);
  return {
    eventDate,
    serverDate: new Date(nowMs),
    clientTimestamp: candidate,
    clockSkewMs: skew,
    usedClientTimestamp: true,
    rejection: null as "past" | "future" | null,
  };
};

export const normalizeTrackingValues = (
  payload: z.infer<typeof payloadSchema>,
) => {
  const normalized: Record<string, string> = {};
  const entries: Array<[string, string | undefined]> = [
    ["utm_source", payload.utm_source],
    ["utm_medium", payload.utm_medium],
    ["utm_campaign", payload.utm_campaign],
    ["utm_term", payload.utm_term],
    ["utm_content", payload.utm_content],
    ["source", payload.source],
    ["via", payload.via],
    ["ref", payload.ref],
  ];

  for (const [key, value] of entries) {
    const normalizedValue = normalizeTrackingValue(value);
    if (normalizedValue) {
      normalized[key] = normalizedValue;
    }
  }

  return normalized;
};

export const parseUserAgent = (value: string | null) => {
  if (!value) {
    return { device: "unknown", browser: "unknown", os: "unknown" };
  }
  const ua = value.toLowerCase();
  const device = /mobile|iphone|ipad|android/.test(ua) ? "mobile" : "desktop";
  const browser =
    ua.includes("edg/") || ua.includes("edge")
      ? "edge"
      : ua.includes("chrome")
        ? "chrome"
        : ua.includes("safari") && !ua.includes("chrome")
          ? "safari"
          : ua.includes("firefox")
            ? "firefox"
            : ua.includes("opera") || ua.includes("opr/")
              ? "opera"
              : "unknown";
  const os = ua.includes("windows")
    ? "windows"
    : ua.includes("mac os")
      ? "macos"
      : ua.includes("android")
        ? "android"
        : ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")
          ? "ios"
          : ua.includes("linux")
            ? "linux"
            : "unknown";
  return { device, browser, os };
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const ensureAllowlistedKeys = (payload: Record<string, unknown>) => {
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return key;
    }
  }
  return null;
};

export const resolveVersion = (payload: Record<string, unknown>) => {
  const raw = payload.v;
  if (raw === undefined || raw === null || raw === "") {
    return 1;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return null;
  }
  return parsed;
};

export const resolveIngestServerKey = (
  headers: Headers,
  queryKey: string | null,
) => {
  const header = headers.get("x-ingest-server-key");
  if (header && header.trim()) {
    return header.trim();
  }
  if (queryKey && queryKey.trim()) {
    return queryKey.trim();
  }
  return "";
};
