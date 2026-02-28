import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@my-better-t-app/auth";
import { and, db, eq, payment, rawEvent, site } from "@my-better-t-app/db";
import { sanitizeMetadataRecord } from "@/lib/metadata-sanitize";
import { metricsForEvent, upsertRollups } from "@/lib/rollups";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const getString = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const parseAmount = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const isRecord = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const MAX_ORDERS = 500; // safety cap per sync call

// ─────────────────────────────────────────────────────────────────────────────
// Stripe sync
// ─────────────────────────────────────────────────────────────────────────────

async function syncStripe(
  apiKey: string,
  siteId: string,
  fromTimestamp: number | undefined,
): Promise<number> {
  let synced = 0;
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      limit: "100",
      // expand line items / payment intent to get the right data
      "expand[]": "data.line_items",
    });
    if (fromTimestamp) params.set("created[gte]", String(fromTimestamp));
    if (cursor) params.set("starting_after", cursor);

    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const msg =
        (isRecord(err.error) && typeof err.error.message === "string"
          ? err.error.message
          : null) ?? "Stripe API error";
      throw new Error(msg);
    }
    const body = (await res.json()) as Record<string, unknown>;
    const sessions = (body.data as Array<Record<string, unknown>>) ?? [];

    for (const session of sessions) {
      if (synced >= MAX_ORDERS) break;
      // Only completed sessions with actual payment
      const status = getString(session.status);
      const paymentStatus = getString(session.payment_status);
      if (status !== "complete" && paymentStatus !== "paid") continue;

      const transactionId =
        getString(session.payment_intent) || getString(session.id);
      if (!transactionId) continue;

      const amount = parseAmount(session.amount_total);
      const currency = getString(session.currency).toLowerCase() || "usd";
      const customerId = getString(session.customer) || null;
      const createdAt =
        typeof session.created === "number"
          ? new Date(session.created * 1000)
          : new Date();

      const paymentEventId = `stripe_sync:${transactionId}`;
      const paymentMetadata = {
        provider: "stripe",
        event_type: "new",
        transaction_id: transactionId,
        amount,
        currency,
        customer_id: customerId,
        synced: true,
      };
      const sanitized = sanitizeMetadataRecord(paymentMetadata) ?? {};
      const metrics = metricsForEvent({ type: "payment", metadata: sanitized });
      const syntheticVisitorId = `txn_${transactionId}`.slice(0, 128);

      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(payment)
          .values({
            id: randomUUID(),
            siteId,
            visitorId: null,
            eventId: paymentEventId,
            amount: amount ?? 0,
            currency,
            provider: "stripe",
            eventType: "new",
            transactionId,
            customerId,
            email: null,
            name: null,
            renewal: false,
            refunded: false,
            createdAt,
          })
          .onConflictDoNothing({ target: [payment.siteId, payment.transactionId] })
          .returning({ id: payment.id });

        if (inserted.length === 0) return; // already exists

        await tx
          .insert(rawEvent)
          .values({
            id: randomUUID(),
            siteId,
            eventId: paymentEventId,
            type: "payment",
            name: "stripe_checkout",
            visitorId: syntheticVisitorId,
            sessionId: null,
            timestamp: createdAt.getTime(),
            metadata: sanitized,
          })
          .onConflictDoNothing({ target: [rawEvent.siteId, rawEvent.eventId] });

        await upsertRollups({ db: tx, siteId, timestamp: createdAt, metrics });
        synced++;
      });
    }

    const lastSession = sessions[sessions.length - 1];
    cursor =
      body.has_more === true && lastSession
        ? getString(lastSession.id)
        : undefined;
  } while (cursor && synced < MAX_ORDERS);

  return synced;
}

// ─────────────────────────────────────────────────────────────────────────────
// LemonSqueezy sync
// ─────────────────────────────────────────────────────────────────────────────

async function syncLemonSqueezy(
  apiKey: string,
  siteId: string,
  fromDate: string | undefined,
): Promise<number> {
  // Step 1: get store ID
  const storesRes = await fetch("https://api.lemonsqueezy.com/v1/stores", {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/vnd.api+json" },
  });
  if (!storesRes.ok) throw new Error("Failed to fetch LemonSqueezy stores. Check your API key.");
  const storesBody = (await storesRes.json()) as Record<string, unknown>;
  const storesArr = storesBody.data as Array<Record<string, unknown>> | undefined;
  const storeId = typeof storesArr?.[0]?.id === "string" ? storesArr[0].id : null;
  if (!storeId) throw new Error("No LemonSqueezy store found for this API key.");

  let synced = 0;
  let nextUrl: string | null = null;

  // LS API supports filter[store_id] and page[size] but NOT filter[status] or date filters
  // We filter status and date client-side
  const initialParams = new URLSearchParams({
    "filter[store_id]": storeId,
    "page[size]": "100",
  });
  const fromMs = fromDate ? new Date(fromDate).getTime() : null;
  nextUrl = `https://api.lemonsqueezy.com/v1/orders?${initialParams}`;

  do {
    const res = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/vnd.api+json" },
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const errors = err.errors as Array<Record<string, unknown>> | undefined;
      const msg =
        Array.isArray(errors) && typeof errors[0]?.detail === "string"
          ? errors[0].detail
          : "LemonSqueezy API error";
      throw new Error(msg);
    }
    const body = (await res.json()) as Record<string, unknown>;
    const orders = (body.data as Array<Record<string, unknown>>) ?? [];

    for (const order of orders) {
      if (synced >= MAX_ORDERS) break;
      const attrs = isRecord(order.attributes) ? order.attributes : {};
      const status = getString(attrs.status);
      // filter client-side: skip non-paid/non-complete orders
      if (status !== "paid" && status !== "complete") continue;

      // filter client-side by fromDate
      const createdAtStr = getString(attrs.created_at);
      const createdAt = createdAtStr ? new Date(createdAtStr) : new Date();
      if (fromMs !== null && createdAt.getTime() < fromMs) continue;

      // order_number is an integer in LS — coerce to string
      const orderNumber =
        typeof attrs.order_number === "number"
          ? String(attrs.order_number)
          : getString(attrs.order_number);
      const transactionId =
        orderNumber ||
        getString(attrs.identifier) ||
        String(order.id);
      if (!transactionId) continue;

      const amount =
        parseAmount(attrs.total) ??
        parseAmount(attrs.total_usd) ??
        parseAmount(attrs.subtotal) ??
        null;
      const currency = getString(attrs.currency).toLowerCase() || "usd";
      const customerId = getString(attrs.customer_id) || null;
      const paymentEventId = `ls_sync:${transactionId}`;
      const paymentMetadata = {
        provider: "lemonsqueezy",
        event_type: "new",
        transaction_id: transactionId,
        order_id: getString(order.id) || null,
        order_number: getString(attrs.order_number) || null,
        amount,
        currency,
        customer_id: customerId,
        synced: true,
      };
      const sanitized = sanitizeMetadataRecord(paymentMetadata) ?? {};
      const metrics = metricsForEvent({ type: "payment", metadata: sanitized });
      const syntheticVisitorId = `txn_${transactionId}`.slice(0, 128);

      await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(payment)
          .values({
            id: randomUUID(),
            siteId,
            visitorId: null,
            eventId: paymentEventId,
            amount: amount ?? 0,
            currency,
            provider: "lemonsqueezy",
            eventType: "new",
            transactionId,
            customerId,
            email: getString(attrs.user_email) || null,
            name: getString(attrs.user_name) || null,
            renewal: false,
            refunded: false,
            createdAt,
          })
          .onConflictDoNothing({ target: [payment.siteId, payment.transactionId] })
          .returning({ id: payment.id });

        if (inserted.length === 0) return;

        await tx
          .insert(rawEvent)
          .values({
            id: randomUUID(),
            siteId,
            eventId: paymentEventId,
            type: "payment",
            name: "lemonsqueezy_checkout",
            visitorId: syntheticVisitorId,
            sessionId: null,
            timestamp: createdAt.getTime(),
            metadata: sanitized,
          })
          .onConflictDoNothing({ target: [rawEvent.siteId, rawEvent.eventId] });

        await upsertRollups({ db: tx, siteId, timestamp: createdAt, metrics });
        synced++;
      });
    }

    const links = isRecord(body.links) ? body.links : {};
    const next = getString(links.next);
    nextUrl = next || null;
  } while (nextUrl && synced < MAX_ORDERS);

  return synced;
}

// ─────────────────────────────────────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────────────────────────────────────

const bodySchema = z.object({
  siteId: z.string().min(1),
  provider: z.enum(["stripe", "lemonsqueezy"]),
  apiKey: z.string().trim().min(1, "API key is required"),
  fromDate: z.string().optional(), // ISO date, e.g. "2024-01-01"
});

export const POST = async (request: NextRequest) => {
  // Verify session
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { siteId, provider, apiKey, fromDate } = parsed.data;

  // Verify the site belongs to this user
  const siteRecord = await db.query.site.findFirst({
    columns: { id: true, revenueProvider: true },
    where: (sites) => and(eq(sites.id, siteId), eq(sites.userId, session.user.id)),
  });
  if (!siteRecord) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  if (siteRecord.revenueProvider !== provider) {
    return NextResponse.json(
      { error: `Site is connected to ${siteRecord.revenueProvider ?? "no provider"}, not ${provider}` },
      { status: 400 },
    );
  }

  try {
    let synced: number;
    const fromTimestamp = fromDate ? Math.floor(new Date(fromDate).getTime() / 1000) : undefined;

    if (provider === "stripe") {
      synced = await syncStripe(apiKey, siteRecord.id, fromTimestamp);
    } else {
      synced = await syncLemonSqueezy(apiKey, siteRecord.id, fromDate);
    }

    return NextResponse.json({ ok: true, synced });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
};
