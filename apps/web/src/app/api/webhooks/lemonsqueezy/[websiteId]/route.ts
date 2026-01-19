import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { and, db, eq, rawEvent } from "@my-better-t-app/db";

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

export const POST = async (
  request: NextRequest,
  context: { params: Promise<{ websiteId: string }> },
) => {
  const { websiteId: rawWebsiteId } = await context.params;
  const websiteId = getString(rawWebsiteId);
  if (!websiteId) {
    return NextResponse.json({ error: "Website id is required" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRecord(payload)) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  const meta = isRecord(payload.meta) ? payload.meta : null;
  const eventName = getString(meta?.event_name ?? payload.event_name);
  const data = isRecord(payload.data) ? payload.data : null;
  const attributes = data && isRecord(data.attributes) ? data.attributes : null;

  if (!eventName || !data || !attributes) {
    return NextResponse.json({ error: "Invalid event payload" }, { status: 400 });
  }

  if (!SUPPORTED_EVENTS.has(eventName)) {
    return NextResponse.json({ received: true });
  }

  const customData =
    parseCustomData(meta?.custom_data) ??
    parseCustomData(meta?.custom) ??
    parseCustomData(attributes.custom_data) ??
    parseCustomData(attributes.custom) ??
    parseCustomData(attributes.custom_fields) ??
    parseCustomData(payload.custom_data) ??
    parseCustomData(payload.custom);

  const visitorId = customData ? getString(customData.datafast_visitor_id) : "";
  if (!visitorId) {
    return NextResponse.json(
      { error: "datafast_visitor_id is required in LemonSqueezy custom fields" },
      { status: 400 },
    );
  }

  const siteRecord = await db.query.site.findFirst({
    columns: { id: true },
    where: (sites, { eq }) => eq(sites.websiteId, websiteId),
  });

  if (!siteRecord) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const sessionId = customData ? getString(customData.datafast_session_id) : "";
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
  const attribution = await getAttributionSnapshot(siteRecord.id, visitorId);

  const paymentMetadata: Record<string, unknown> = {
    provider: "lemonsqueezy",
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

  await db.insert(rawEvent).values({
    id: randomUUID(),
    siteId: siteRecord.id,
    type: "payment",
    name: "lemonsqueezy_checkout",
    visitorId,
    sessionId: sessionId || null,
    metadata: paymentMetadata,
  });

  return NextResponse.json({ ok: true });
};
