import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyApiKey } from "@my-better-t-app/api/api-key";
import { and, db, eq, rawEvent } from "@my-better-t-app/db";
import { sanitizeMetadataRecord } from "@/lib/metadata-sanitize";
import { runRetentionCleanup } from "@/lib/retention";
import { extractDimensionRollups, metricsForEvent, upsertDimensionRollups, upsertRollups } from "@/lib/rollups";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const MAX_METADATA_KEYS = 10;
const MAX_METADATA_KEY_LENGTH = 64;
const MAX_METADATA_VALUE_LENGTH = 255;

const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(64, "Name must be 64 characters or less")
  .regex(/^[a-z0-9_-]+$/, "Name must be lowercase letters, numbers, underscores, or hyphens");

const metadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const metadataSchema = z
  .record(z.string(), metadataValueSchema)
  .superRefine((value, ctx) => {
    const entries = Object.entries(value);
    if (entries.length > MAX_METADATA_KEYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metadata cannot exceed ${MAX_METADATA_KEYS} entries`,
      });
    }

    for (const [rawKey, rawValue] of entries) {
      const key = rawKey.trim().toLowerCase();
      if (!key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "metadata keys cannot be empty",
        });
        continue;
      }
      if (key.length > MAX_METADATA_KEY_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `metadata key "${rawKey}" exceeds ${MAX_METADATA_KEY_LENGTH} characters`,
        });
      }
      if (!/^[a-z0-9_-]+$/.test(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `metadata key "${rawKey}" contains invalid characters`,
        });
      }

      if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();
        if (!trimmed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `metadata value for "${rawKey}" cannot be empty`,
          });
        } else if (trimmed.length > MAX_METADATA_VALUE_LENGTH) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `metadata value for "${rawKey}" exceeds ${MAX_METADATA_VALUE_LENGTH} characters`,
          });
        }
      }
    }
  })
  .transform((value) => {
    const normalized: Record<string, string | number | boolean | null> = {};
    for (const [rawKey, rawValue] of Object.entries(value)) {
      const key = rawKey.trim().toLowerCase();
      const safeValue = typeof rawValue === "string" ? rawValue.trim() : rawValue;
      if (!key) {
        continue;
      }
      if (typeof safeValue === "string") {
        const sanitized = safeValue.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        normalized[key] =
          sanitized.length > MAX_METADATA_VALUE_LENGTH
            ? sanitized.slice(0, MAX_METADATA_VALUE_LENGTH)
            : sanitized;
      } else {
        normalized[key] = safeValue;
      }
    }
    return normalized;
  })
  .optional();

const bodySchema = z.object({
  datafast_visitor_id: z
    .string()
    .trim()
    .min(1, "datafast_visitor_id is required")
    .max(128, "datafast_visitor_id is too long"),
  name: nameSchema,
  metadata: metadataSchema,
});

const hasPriorPageview = async (siteId: string, visitorId: string) => {
  const existing = await db.query.rawEvent.findFirst({
    columns: { id: true },
    where: (events) =>
      and(eq(events.siteId, siteId), eq(events.visitorId, visitorId), eq(events.type, "pageview")),
  });
  return Boolean(existing);
};

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

export const POST = async (request: NextRequest) => {
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

  await runRetentionCleanup();

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const visitorId = parsed.data.datafast_visitor_id;
  const hadPageview = await hasPriorPageview(authResult.siteId, visitorId);
  if (!hadPageview) {
    return NextResponse.json(
      { error: "Visitor must have a prior pageview before goals can be recorded" },
      { status: 409 },
    );
  }

  const metadata = sanitizeMetadataRecord(parsed.data.metadata ?? null, MAX_METADATA_VALUE_LENGTH);
  const createdAt = new Date();
  const timestamp = createdAt.getTime();

  await db.insert(rawEvent).values({
    id: randomUUID(),
    siteId: authResult.siteId,
    eventId: null,
    type: "goal",
    name: parsed.data.name,
    visitorId,
    timestamp,
    metadata,
    createdAt,
  });

  const metrics = metricsForEvent({ type: "goal", metadata });

  await upsertRollups({
    siteId: authResult.siteId,
    timestamp: createdAt,
    metrics,
  });

  await upsertDimensionRollups({
    siteId: authResult.siteId,
    timestamp: createdAt,
    metrics,
    dimensions: extractDimensionRollups({
      type: "goal",
      name: parsed.data.name,
    }),
  });

  return NextResponse.json({ ok: true });
};
