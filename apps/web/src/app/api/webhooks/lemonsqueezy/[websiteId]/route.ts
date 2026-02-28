import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { and, db, eq, payment, rawEvent } from "@my-better-t-app/db";
import { decryptRevenueKey } from "@my-better-t-app/api/revenue-keys";
import { sanitizeMetadataRecord } from "@/lib/metadata-sanitize";
import { extractDimensionRollups, metricsForEvent, upsertDimensionRollups, upsertRollups } from "@/lib/rollups";

const SUPPORTED_EVENTS = new Set(["order_created", "subscription_payment_success"]);

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

const parseCustomData = (value: unknown) => {
  if (isRecord(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
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

const getPaymentEventType = (eventName: string, attributes: Record<string, unknown>) => {
  const status = getString(attributes.status).toLowerCase();
  if (attributes.refunded === true || status === "refunded") {
    return "refund";
  }
  if (eventName === "subscription_payment_success") {
    return "renewal";
  }
  return "new";
};

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyLemonSqueezySignature = (
  payload: string,
  signatureHeader: string,
  secret: string,
) => {
  const digest = createHmac("sha256", secret).update(payload, "utf8").digest("hex");
  return safeEqual(signatureHeader, digest);
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

  // Read the raw body first (must happen before any parsing)
  const body = await request.text();

  const signatureHeader =
    request.headers.get("x-signature") || request.headers.get("x-lemonsqueezy-signature");
  if (!signatureHeader) {
    return NextResponse.json({ error: "LemonSqueezy signature header missing" }, { status: 400 });
  }

  // Look up site to get the per-site webhook secret
  const siteRecord = await db.query.site.findFirst({
    columns: { id: true, revenueProvider: true, revenueProviderKeyEncrypted: true },
    where: (sites, { eq }) => eq(sites.websiteId, websiteId),
  });

  if (!siteRecord) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  if (!siteRecord.revenueProviderKeyEncrypted) {
    return NextResponse.json({ error: "LemonSqueezy revenue provider not configured for this site" }, { status: 400 });
  }

  if (siteRecord.revenueProvider !== "lemonsqueezy") {
    return NextResponse.json({ error: "This site is not configured for LemonSqueezy" }, { status: 400 });
  }

  let webhookSecret: string;
  try {
    webhookSecret = decryptRevenueKey(siteRecord.revenueProviderKeyEncrypted);
  } catch {
    return NextResponse.json({ error: "Failed to read webhook secret" }, { status: 500 });
  }

  if (!verifyLemonSqueezySignature(body, signatureHeader, webhookSecret)) {
    return NextResponse.json({ error: "Invalid LemonSqueezy signature" }, { status: 400 });
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
  const meta = isRecord(payload.meta) ? payload.meta : null;
  const eventName = getString(meta?.event_name ?? payload.event_name);
  const data = isRecord(payload.data) ? payload.data : null;
  const attributes = data && isRecord(data.attributes) ? data.attributes : null;

  if (!eventId || !eventName || !data || !attributes) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  if (!SUPPORTED_EVENTS.has(eventName)) {
    return NextResponse.json({ received: true });
  }
  const paymentEventId = `${eventId}:payment`;
  const goalEventId = `${eventId}:goal`;

  const customData =
    parseCustomData(meta?.custom_data) ??
    parseCustomData(meta?.custom) ??
    parseCustomData(attributes.custom_data) ??
    parseCustomData(attributes.custom) ??
    parseCustomData(attributes.custom_fields) ??
    parseCustomData(payload.custom_data) ??
    parseCustomData(payload.custom);

  // visitor ID is optional — revenue is always recorded, attribution only when present
  const visitorId = customData ? getString(customData.ezlytics_visitor_id) : "";
  const hasVisitor = Boolean(visitorId);


  const sessionId = customData ? getString(customData.ezlytics_session_id) : "";
  const transactionId =
    getString(attributes.order_number) ||
    getString(attributes.identifier) ||
    getString(data.id);
  const amount =
    parseAmount(attributes.total) ??
    parseAmount(attributes.total_amount) ??
    parseAmount(attributes.subtotal) ??
    parseAmount(attributes.amount);
  const currency = getString(attributes.currency).toLowerCase();
  const customerId = getString(attributes.customer_id) || getString(attributes.customer);
  // Attribution snapshot only when we have a real visitor
  const attribution = hasVisitor ? await getAttributionSnapshot(siteRecord.id, visitorId) : null;
  // Synthetic visitor ID for the raw event row (must be non-empty)
  const rawEventVisitorId = visitorId || `txn_${transactionId || eventId}`;

  const paymentEventType = getPaymentEventType(eventName, attributes);
  const paymentMetadata: Record<string, unknown> = {
    provider: "lemonsqueezy",
    event_type: paymentEventType,
    transaction_id: transactionId || null,
    order_id: getString(data.id) || null,
    order_number: getString(attributes.order_number) || null,
    subscription_id: getString(attributes.subscription_id) || null,
    amount,
    currency: currency || null,
    customer_id: customerId || null,
    event_name: eventName,
  };

  if (sessionId) {
    paymentMetadata.session_id = sessionId;
  }
  if (attribution) {
    paymentMetadata.attribution = attribution;
  }

  const goalMetadata = {
    provider: "lemonsqueezy",
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
        visitorId: visitorId || null,
        eventId: paymentEventId,
        amount: amount ?? 0,
        currency: currency || "usd",
        provider: "lemonsqueezy",
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
      name: "lemonsqueezy_checkout",
      visitorId: rawEventVisitorId,
      sessionId: sessionId || null,
      timestamp: eventTimestamp,
      metadata: sanitizedPaymentMetadata,
    });

    // Goal event + rollups only when we can attribute to a visitor
    if (hasVisitor) {
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
    }

    await upsertRollups({
      db: tx,
      siteId: siteRecord.id,
      timestamp,
      metrics: paymentMetrics,
    });

    if (hasVisitor) {
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
    }

    return false;
  });

  if (shouldSkip) {
    return NextResponse.json({ ok: true, deduped: true });
  }

  return NextResponse.json({ ok: true });
};
