import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { verifyApiKey } from "@my-better-t-app/api/api-key";
import { db, payment, rawEvent } from "@my-better-t-app/db";
import { metricsForEvent, upsertRollups } from "@/lib/rollups";

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
});

export const POST = async (request: NextRequest) => {
  const authResult = await verifyApiKey(request.headers.get("authorization"));
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

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
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    provider: "custom",
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

    await db.insert(rawEvent).values({
      id: randomUUID(),
      siteId: authResult.siteId,
      type: "payment",
      name: "custom_payment",
      visitorId: parsed.data.visitor_id,
      metadata: paymentMetadata,
      createdAt,
    });

    await db.insert(rawEvent).values({
      id: randomUUID(),
      siteId: authResult.siteId,
      type: "goal",
      name: getGoalName(parsed.data.amount),
      visitorId: parsed.data.visitor_id,
      metadata: goalMetadata,
      createdAt,
    });

    await upsertRollups({
      siteId: authResult.siteId,
      timestamp: createdAt,
      metrics: metricsForEvent({
        type: "payment",
        metadata: paymentMetadata,
      }),
    });

    await upsertRollups({
      siteId: authResult.siteId,
      timestamp: createdAt,
      metrics: metricsForEvent({ type: "goal", metadata: goalMetadata }),
    });
  }

  return NextResponse.json({ ok: true });
};
