import { CodeBlock } from "@/components/docs/code-block";

export default function ReactIntegrationPage() {
  return (
    <div>
      <h1>React / Next.js Integration</h1>
      <p className="text-lg text-muted-foreground">
        Integrate seamlessly into your React or Next.js App Router applications
        using the standard script tag — no npm package required.
      </p>

      <hr className="my-8 border-foreground/20" />

      <h2>Next.js (App Router)</h2>
      <p>
        Add the script to your root layout. All three attributes —{" "}
        <code>data-website-id</code>, <code>data-domain</code>, and{" "}
        <code>data-api-key</code> — are required.
      </p>

      <CodeBlock
        language="tsx"
        code={`// app/layout.tsx
import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <Script
          defer
          data-website-id="YOUR_WEBSITE_ID"
          data-domain="yourdomain.com"
          data-api-key="YOUR_API_KEY"
          src="https://your-analytics-domain.com/js/script.js"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}`}
      />

      <div className="bg-emerald-100 dark:bg-emerald-900/30 border-2 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] my-8">
        <h4 className="font-bold flex items-center gap-2 m-0 text-emerald-900 dark:text-emerald-200">
          <span className="text-xl">🚀</span> Automatic Routing
        </h4>
        <p className="m-0 mt-2 text-emerald-800 dark:text-emerald-100">
          Our script automatically hooks into the browser&apos;s History API.
          When a user navigates between pages using Next.js{" "}
          <code>&lt;Link&gt;</code> components, pageviews are logged
          automatically — no extra configuration required!
        </p>
      </div>

      <h2>Tracking Custom Events (Click)</h2>
      <p>
        Add a <code>data-ezlytics-goal</code> attribute to any element to track
        clicks — works in both Server and Client Components since it&apos;s a
        plain HTML attribute.
      </p>

      <CodeBlock
        language="tsx"
        code={`// Works in Server Components too — no "use client" needed
export default function PricingPage() {
  return (
    <div>
      <button
        data-ezlytics-goal="upgrade-clicked"
        data-ezlytics-goal-plan="pro"
      >
        Upgrade to Pro
      </button>
    </div>
  );
}`}
      />

      <h2>Tracking Custom Events (JavaScript)</h2>
      <p>
        If you need to fire an event programmatically (e.g., after an async form
        submission), use the <code>window.ezlytics</code> function. Make sure to
        guard against SSR with a <code>typeof window</code> check.
      </p>

      <div className="bg-amber-100 dark:bg-amber-900/30 border-2 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] my-8">
        <h4 className="font-bold flex items-center gap-2 m-0 text-amber-900 dark:text-amber-200">
          <span className="text-xl">💡</span> Prefer HTML attributes
        </h4>
        <p className="m-0 mt-2 text-amber-800 dark:text-amber-100">
          For click tracking, <code>data-ezlytics-goal</code> is simpler and
          works without a Client Component. Use the JS API only when you need to
          trigger an event from code (e.g., after a fetch completes).
        </p>
      </div>

      <CodeBlock
        language="tsx"
        code={`"use client";

export default function CheckoutForm() {
  const handleSuccess = async () => {
    const res = await submitOrder();

    // Fire event after async action completes
    if (typeof window !== "undefined" && window.ezlytics) {
      window.ezlytics("identify", {
        user_id: res.userId,
        name: res.name,
        plan: "pro",
      });
    }
  };

  return <button onClick={handleSuccess}>Complete Order</button>;
}`}
      />

      <h2>Identifying Users</h2>
      <p>
        Associate analytics events with a specific logged-in user using{" "}
        <code>window.ezlytics(&quot;identify&quot;, ...)</code>. Call this after
        login or on any page where you have the user&apos;s session available.
      </p>

      <CodeBlock
        language="tsx"
        code={`"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react"; // or your auth library

export function AnalyticsIdentify() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user || typeof window === "undefined") return;
    if (!window.ezlytics) return;

    window.ezlytics("identify", {
      user_id: session.user.id,
      name: session.user.name,
      plan: session.user.plan, // any extra keys become metadata
    });
  }, [session]);

  return null;
}`}
      />

      <p>
        Add <code>&lt;AnalyticsIdentify /&gt;</code> to your root layout so it
        runs on every page after the user logs in.
      </p>
    </div>
  );
}
