import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { and, db, eq, payment, rawEvent } from "@my-better-t-app/db";
import { env } from "@my-better-t-app/env/server";
import { sanitizeMetadataRecord } from "@/lib/metadata-sanitize";
import { extractDimensionRollups, metricsForEvent, upsertDimensionRollups, upsertRollups } from "@/lib/rollups";

const SUPPORTED_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const getString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const parseAmount = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getAttributionSnapshot = async (siteId: string, visitorId: string) => {
  const pageview = await db.query.rawEvent.findFirst({
    columns: { id: true, metadata: true, createdAt: true },
    where: (events) =>
      and(eq(events.siteId, siteId), eq(events.visitorId, visitorId), eq(events.type, "pageview")),
    orderBy: (events, { desc }) => [desc(events.createdAt)],
  });

  if (!pageview) {
    return null;
  }

  return {
    pageview_id: pageview.id,
    pageview_timestamp: pageview.createdAt.toISOString(),
    metadata: isRecord(pageview.metadata) ? pageview.metadata : null,
  };
};

const getGoalName = (amount: number | null) => (amount === 0 ? "free_trial" : "payment");

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const parseStripeSignature = (header: string) => {
  const parts = header.split(",");
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || !value) {
      continue;
    }
    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        timestamp = parsed;
      }
    } else if (key === "v1") {
      signatures.push(value);
    }
  }
  return { timestamp, signatures };
};

const verifyStripeSignature = (payload: string, signatureHeader: string, secret: string) => {
  const { timestamp, signatures } = parseStripeSignature(signatureHeader);
  if (!timestamp || signatures.length === 0) {
    return false;
  }
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  return signatures.some((signature) => safeEqual(signature, expected));
};

export const POST = async (
  request: NextRequest,
  context: { params: Promise<{ websiteId: string }> },
) => {
  const { websiteId: rawWebsiteId } = await context.params;
  const websiteId = getString(rawWebsiteId);
  if (!websiteId) {
    return NextResponse.json({ error: "Website id is required" }, { status: 400 });
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook secret not configured" }, { status: 500 });
  }

  const signatureHeader = request.headers.get("stripe-signature");
  if (!signatureHeader) {
    return NextResponse.json({ error: "Stripe signature header missing" }, { status: 400 });
  }

  const body = await request.text();
  if (!verifyStripeSignature(body, signatureHeader, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe signature" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = body ? JSON.parse(body) : {};
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const eventId = getString(payload.id);
  const eventType = getString(payload.type);
  const eventData = isRecord(payload.data) ? payload.data : null;
  const eventObject = eventData && isRecord(eventData.object) ? eventData.object : null;

  if (!eventId || !eventType || !eventObject) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  if (!SUPPORTED_EVENTS.has(eventType)) {
    return NextResponse.json({ received: true });
  }
  const paymentEventId = `${eventId}:payment`;
  const goalEventId = `${eventId}:goal`;

  const metadata = isRecord(eventObject.metadata) ? eventObject.metadata : {};
  const visitorId = getString(metadata.ezlytics_visitor_id);
  if (!visitorId) {
    return NextResponse.json({ error: "ezlytics_visitor_id is required in metadata" }, { status: 400 });
  }

  const siteRecord = await db.query.site.findFirst({
    columns: { id: true },
    where: (sites, { eq }) => eq(sites.websiteId, websiteId),
  });

  if (!siteRecord) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }


  const sessionId = getString(metadata.ezlytics_session_id);
  const transactionId = getString(eventObject.payment_intent) || getString(eventObject.id);
  const amount = parseAmount(eventObject.amount_total);
  const currency = getString(eventObject.currency).toLowerCase();
  const customerId = getString(eventObject.customer);
  const paymentStatus = getString(eventObject.payment_status).toLowerCase();
  const isRefunded = paymentStatus === "refunded";
  const existingPayment =
    !isRefunded && customerId
      ? await db.query.payment.findFirst({
          columns: { id: true },
          where: (payments) =>
            and(
              eq(payments.siteId, siteRecord.id),
              eq(payments.customerId, customerId),
              eq(payments.provider, "stripe"),
            ),
        })
      : null;
  const paymentEventType = isRefunded ? "refund" : existingPayment ? "renewal" : "new";
  const attribution = await getAttributionSnapshot(siteRecord.id, visitorId);
  const paymentMetadata: Record<string, unknown> = {
    provider: "stripe",
    event_type: paymentEventType,
    transaction_id: transactionId || null,
    checkout_session_id: getString(eventObject.id) || null,
    amount,
    currency: currency || null,
    customer_id: customerId || null,
  };

  if (sessionId) {
    paymentMetadata.session_id = sessionId;
  }
  if (attribution) {
    paymentMetadata.attribution = attribution;
  }

  const goalMetadata = {
    provider: "stripe",
    event_type: paymentEventType,
    transaction_id: transactionId || null,
    amount,
    currency: currency || null,
  };
  const sanitizedPaymentMetadata = sanitizeMetadataRecord(paymentMetadata) ?? {};
  const sanitizedGoalMetadata = sanitizeMetadataRecord(goalMetadata) ?? {};

  const timestamp = new Date();
  const eventTimestamp = timestamp.getTime();
  const paymentMetrics = metricsForEvent({ type: "payment", metadata: sanitizedPaymentMetadata });
  const goalMetrics = metricsForEvent({ type: "goal", metadata: sanitizedGoalMetadata });

  const shouldSkip = await db.transaction(async (tx) => {
    const existing = await tx.query.rawEvent.findFirst({
      columns: { id: true },
      where: (events) =>
        and(eq(events.siteId, siteRecord.id), eq(events.eventId, paymentEventId)),
    });
    if (existing) {
      return true;
    }

    const insertedPayment = await tx
      .insert(payment)
      .values({
        id: randomUUID(),
        siteId: siteRecord.id,
        visitorId,
        eventId: paymentEventId,
        amount: amount ?? 0,
        currency: currency || "usd",
        provider: "stripe",
        eventType: paymentEventType,
        transactionId: transactionId || eventId,
        customerId: customerId || null,
        email: null,
        name: null,
        renewal: paymentEventType === "renewal",
        refunded: paymentEventType === "refund",
        createdAt: timestamp,
      })
      .onConflictDoNothing({
        target: [payment.siteId, payment.transactionId],
      })
      .returning({ id: payment.id });
    if (insertedPayment.length === 0) {
      return true;
    }

    await tx.insert(rawEvent).values({
      id: randomUUID(),
      siteId: siteRecord.id,
      eventId: paymentEventId,
      type: "payment",
      name: "stripe_checkout",
      visitorId,
      sessionId: sessionId || null,
      timestamp: eventTimestamp,
      metadata: sanitizedPaymentMetadata,
    });

    await tx.insert(rawEvent).values({
      id: randomUUID(),
      siteId: siteRecord.id,
      eventId: goalEventId,
      type: "goal",
      name: getGoalName(amount),
      visitorId,
      sessionId: sessionId || null,
      timestamp: eventTimestamp,
      metadata: sanitizedGoalMetadata,
    });

    await upsertRollups({
      db: tx,
      siteId: siteRecord.id,
      timestamp,
      metrics: paymentMetrics,
    });

    await upsertRollups({
      db: tx,
      siteId: siteRecord.id,
      timestamp,
      metrics: goalMetrics,
    });

    await upsertDimensionRollups({
      db: tx,
      siteId: siteRecord.id,
      timestamp,
      metrics: goalMetrics,
      dimensions: extractDimensionRollups({
        type: "goal",
        name: getGoalName(amount),
      }),
    });

    return false;
  });

  if (shouldSkip) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  return NextResponse.json({ ok: true });
};
