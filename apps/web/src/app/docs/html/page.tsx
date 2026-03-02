import { CodeBlock } from "@/components/docs/code-block";

export default function HtmlIntegrationPage() {
  return (
    <div>
      <h1>HTML / Script Tag Integration</h1>
      <p className="text-lg text-muted-foreground">
        The fastest way to add analytics to any website — static sites,
        WordPress, Webflow, or anything that lets you edit HTML.
      </p>

      <hr className="my-8 border-foreground/20" />

      <h2>Step 1: Get your snippet</h2>
      <p>
        After creating a project in your dashboard, copy your unique snippet. It
        will include your <code>data-website-id</code>, <code>data-domain</code>
        , and <code>data-api-key</code> — all three are required for tracking to
        work.
      </p>

      <CodeBlock
        language="html"
        code={`<script
  defer
  data-website-id="YOUR_WEBSITE_ID"
  data-domain="YOUR_DOMAIN"
  data-api-key="YOUR_API_KEY"
  src="https://your-analytics-domain.com/js/script.js">
</script>`}
      />

      <h2>Step 2: Add it to your HTML</h2>
      <p>
        Paste the snippet into the <code>&lt;head&gt;</code> of your HTML
        document. That&apos;s it! Pageviews will immediately start flowing into
        your dashboard.
      </p>

      <CodeBlock
        language="html"
        code={`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>My Awesome Website</title>

    <!-- Paste your analytics snippet here -->
    <script
      defer
      data-website-id="YOUR_WEBSITE_ID"
      data-domain="YOUR_DOMAIN"
      data-api-key="YOUR_API_KEY"
      src="https://your-analytics-domain.com/js/script.js">
    </script>

  </head>
  <body>
    <h1>Hello, World!</h1>
  </body>
</html>`}
      />

      <div className="bg-blue-100 dark:bg-blue-900/30 border-2 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] my-8">
        <h4 className="font-bold flex items-center gap-2 m-0 text-blue-900 dark:text-blue-200">
          <span className="text-xl">ℹ️</span> Note
        </h4>
        <p className="m-0 mt-2 text-blue-800 dark:text-blue-100">
          The script uses the <code>defer</code> attribute, meaning it
          won&apos;t block the rendering of your page. It&apos;s incredibly
          lightweight — around ~6kb gzipped.
        </p>
      </div>

      <h2>Tracking Custom Events (Click)</h2>
      <p>
        Track button clicks or any element interactions by adding a{" "}
        <code>data-ezlytics-goal</code> attribute. No JavaScript required — the
        script handles it automatically.
      </p>

      <CodeBlock
        language="html"
        code={`<!-- Track a button click -->
<button data-ezlytics-goal="signup-clicked">
  Sign Up
</button>

<!-- Track a link click with extra metadata -->
<a
  href="/pricing"
  data-ezlytics-goal="pricing-clicked"
  data-ezlytics-goal-plan="pro"
>
  View Pro Plan
</a>`}
      />

      <div className="bg-amber-100 dark:bg-amber-900/30 border-2 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] my-8">
        <h4 className="font-bold flex items-center gap-2 m-0 text-amber-900 dark:text-amber-200">
          <span className="text-xl">💡</span> Goal name format
        </h4>
        <p className="m-0 mt-2 text-amber-800 dark:text-amber-100">
          Goal names must be lowercase letters, numbers, hyphens, or underscores
          — max 64 characters. Example: <code>signup-clicked</code>,{" "}
          <code>lead_captured</code>.
        </p>
      </div>

      <h2>Tracking Scroll Depth</h2>
      <p>
        Fire an event when a user scrolls to a specific section of your page
        using the <code>data-ezlytics-scroll</code> attribute.
      </p>

      <CodeBlock
        language="html"
        code={`<!-- Fire "reached-pricing" when this section enters the viewport -->
<section
  data-ezlytics-scroll="reached-pricing"
  data-ezlytics-scroll-threshold="0.5"
  data-ezlytics-scroll-delay="500"
>
  <h2>Pricing</h2>
  ...
</section>`}
      />

      <p>
        <code>data-ezlytics-scroll-threshold</code> (0–1, default{" "}
        <code>0.5</code>) controls how much of the element must be visible
        before firing. <code>data-ezlytics-scroll-delay</code> adds a
        millisecond delay before the event fires.
      </p>
    </div>
  );
}
