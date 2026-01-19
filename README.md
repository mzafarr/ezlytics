<!--
This file is generated from README.template.md.
Run `bun run sync-readme` after changing packages/config/src/brand.ts.
-->

# my-better-t-app

my-better-t-app — Web analytics MVP built with Better-T-Stack.

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **tRPC** - End-to-end type-safe APIs
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/web/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the fullstack application.

## Project Structure

```
app/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Proxy guide (Next.js)

To reduce adblocker impact, proxy the script and events endpoints on your own domain.

1. Update your snippet to point at `/js/script.js` and send events to `/api/events`:

```html
<script
  defer
  data-website-id="dfid_xxx"
  data-domain="example.com"
  data-api-url="/api/events"
  src="https://your-site.com/js/script.js"
></script>
```

2. Create `app/js/script.js/route.ts` to serve the script from your analytics origin:

```ts
import { NextResponse } from "next/server";

const ANALYTICS_ORIGIN = "https://your-analytics-domain.com";

export async function GET() {
  const response = await fetch(`${ANALYTICS_ORIGIN}/script.js`, {
    cache: "no-store",
  });
  const body = await response.text();

  return new NextResponse(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
```

3. Create `app/api/events/route.ts` to forward events to `/api/v1/ingest`:

```ts
import { NextResponse } from "next/server";

const ANALYTICS_ORIGIN = "https://your-analytics-domain.com";

export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(`${ANALYTICS_ORIGIN}/api/v1/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const responseBody = await response.text();

  return new NextResponse(responseBody, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
```

## Stripe Checkout revenue attribution (webhooks)

Stripe Checkout can pass the analytics cookies into Checkout session metadata so revenue is attributed.

### Next.js App Router webhook

Create a webhook route (example uses `/api/webhooks/stripe/[websiteId]` from this repo):

```ts
import { headers } from "next/headers";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(
  request: Request,
  context: { params: Promise<{ websiteId: string }> },
) {
  const { websiteId } = await context.params;
  const body = await request.text();
  const signature = headers().get("stripe-signature") ?? "";
  const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = session.metadata ?? {};
  const visitorId = metadata.datafast_visitor_id;
  const sessionId = metadata.datafast_session_id;

  // Forward to your analytics ingestion endpoint or use the built-in handler.
  await fetch(`${process.env.ANALYTICS_ORIGIN}/api/webhooks/stripe/${websiteId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: event.type,
      data: { object: session },
    }),
  });

  return Response.json({ ok: true });
}
```

### Generic Node webhook

```ts
import express from "express";
import Stripe from "stripe";

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

app.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature!, webhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${(error as Error).message}`);
  }

  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const { datafast_visitor_id, datafast_session_id } = session.metadata ?? {};

  await fetch(`${process.env.ANALYTICS_ORIGIN}/api/webhooks/stripe/${process.env.DATAFAST_WEBSITE_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: event.type,
      data: { object: session },
    }),
  });

  return res.json({ ok: true, visitorId: datafast_visitor_id, sessionId: datafast_session_id });
});
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:studio`: Open database studio UI
