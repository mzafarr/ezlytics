import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyApiKey } from "@my-better-t-app/api/api-key";
import { db, payment, rawEvent } from "@my-better-t-app/db";
import { sanitizeMetadataRecord } from "@/lib/metadata-sanitize";
import { runRetentionCleanup } from "@/lib/retention";
import { extractDimensionRollups, metricsForEvent, upsertDimensionRollups, upsertRollups } from "@/lib/rollups";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const idSchema = z.string().trim().min(1).max(128);

const currencySchema = z
  .string()
  .trim()
  .min(3, "currency is required")
  .max(10, "currency is too long")
  .transform((value) => value.toLowerCase());

const bodySchema = z.object({
  amount: z.coerce.number().int().nonnegative(),
  currency: currencySchema,
  transaction_id: idSchema,
  visitor_id: idSchema.optional(),
  email: z.string().trim().email().max(255).optional(),
  name: z.string().trim().min(1).max(128).optional(),
  customer_id: idSchema.optional(),
  renewal: z.boolean().optional(),
  refunded: z.boolean().optional(),
  timestamp: z.coerce.date().optional(),
});

const getGoalName = (amount: number) => (amount === 0 ? "free_trial" : "payment");

const buildMetadata = (payload: z.infer<typeof bodySchema>) => {
  const metadata: Record<string, unknown> = {
    provider: "custom",
    transaction_id: payload.transaction_id,
    amount: payload.amount,
    currency: payload.currency,
    event_type: payload.refunded ? "refund" : payload.renewal ? "renewal" : "new",
  };

  if (payload.customer_id) {
    metadata.customer_id = payload.customer_id;
  }
  if (payload.email) {
    metadata.email = payload.email;
  }
  if (payload.name) {
    metadata.name = payload.name;
  }
  if (payload.renewal !== undefined) {
    metadata.renewal = payload.renewal;
  }
  if (payload.refunded !== undefined) {
    metadata.refunded = payload.refunded;
  }
  if (payload.timestamp) {
    metadata.timestamp = payload.timestamp.toISOString();
  }

  return metadata;
};

const buildGoalMetadata = (payload: z.infer<typeof bodySchema>) => ({
  provider: "custom",
  transaction_id: payload.transaction_id,
  amount: payload.amount,
  currency: payload.currency,
  event_type: payload.refunded ? "refund" : payload.renewal ? "renewal" : "new",
});

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

  const createdAt = parsed.data.timestamp ?? new Date();
  const paymentId = randomUUID();

  await db.insert(payment).values({
    id: paymentId,
    siteId: authResult.siteId,
    visitorId: parsed.data.visitor_id ?? null,
    eventId: null,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    provider: "custom",
    eventType: parsed.data.refunded ? "refund" : parsed.data.renewal ? "renewal" : "new",
    transactionId: parsed.data.transaction_id,
    customerId: parsed.data.customer_id ?? null,
    email: parsed.data.email ?? null,
    name: parsed.data.name ?? null,
    renewal: parsed.data.renewal ?? false,
    refunded: parsed.data.refunded ?? false,
    createdAt,
  });

  if (parsed.data.visitor_id) {
    const paymentMetadata = buildMetadata(parsed.data);
    const goalMetadata = buildGoalMetadata(parsed.data);
    const sanitizedPaymentMetadata = sanitizeMetadataRecord(paymentMetadata) ?? {};
    const sanitizedGoalMetadata = sanitizeMetadataRecord(goalMetadata) ?? {};

    await db.insert(rawEvent).values({
      id: randomUUID(),
      siteId: authResult.siteId,
      eventId: null,
      type: "payment",
      name: "custom_payment",
      visitorId: parsed.data.visitor_id,
      metadata: sanitizedPaymentMetadata,
      createdAt,
    });

    await db.insert(rawEvent).values({
      id: randomUUID(),
      siteId: authResult.siteId,
      eventId: null,
      type: "goal",
      name: getGoalName(parsed.data.amount),
      visitorId: parsed.data.visitor_id,
      metadata: sanitizedGoalMetadata,
      createdAt,
    });

    const paymentMetrics = metricsForEvent({
      type: "payment",
      metadata: sanitizedPaymentMetadata,
    });
    const goalMetrics = metricsForEvent({ type: "goal", metadata: sanitizedGoalMetadata });

    await upsertRollups({
      siteId: authResult.siteId,
      timestamp: createdAt,
      metrics: paymentMetrics,
    });

    await upsertRollups({
      siteId: authResult.siteId,
      timestamp: createdAt,
      metrics: goalMetrics,
    });

    await upsertDimensionRollups({
      siteId: authResult.siteId,
      timestamp: createdAt,
      metrics: goalMetrics,
      dimensions: extractDimensionRollups({
        type: "goal",
        name: getGoalName(parsed.data.amount),
      }),
    });
  }

  return NextResponse.json({ ok: true });
};
