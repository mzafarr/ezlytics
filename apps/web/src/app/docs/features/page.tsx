import { CodeBlock } from "@/components/docs/code-block";

export default function FeaturesPage() {
  return (
    <div>
      <h1>Platform Features</h1>
      <p className="text-lg text-muted-foreground">
        Understand what you can track and analyze right out of the box with zero
        configuration.
      </p>

      <hr className="my-8 border-foreground/20" />

      <h2>Core Tracking</h2>
      <ul>
        <li>
          <strong>Pageviews &amp; Unique Visitors:</strong> Total page views,
          visits, and unique visitors are tracked automatically. All data is
          anonymized — no cookies required for basic tracking.
        </li>
        <li>
          <strong>Bounce Rate:</strong> Automatically calculated for sessions
          where the user viewed only one page.
        </li>
        <li>
          <strong>Average Visit Duration:</strong> Measured via a heartbeat
          signal sent every 30 seconds while the page is visible.
        </li>
      </ul>

      <h2>Referrers &amp; UTM Tags</h2>
      <p>
        The script automatically parses UTM tags (<code>utm_source</code>,{" "}
        <code>utm_medium</code>, <code>utm_campaign</code>,{" "}
        <code>utm_term</code>, <code>utm_content</code>) and HTTP referer
        strings. It also supports the short aliases <code>ref</code>,{" "}
        <code>source</code>, and <code>via</code>.
      </p>

      <h2>Custom Event Tracking</h2>
      <p>
        Track any user interaction by adding a <code>data-ezlytics-goal</code>{" "}
        attribute to an element, or by calling the JS API for programmatic
        events.
      </p>

      <CodeBlock
        language="html"
        code={`<!-- HTML attribute approach (simplest) -->
<button data-ezlytics-goal="signup-clicked">Sign Up</button>

<!-- With extra metadata (max 10 properties) -->
<button
  data-ezlytics-goal="upgrade-clicked"
  data-ezlytics-goal-plan="pro"
  data-ezlytics-goal-source="banner"
>
  Upgrade
</button>`}
      />

      <h2>Scroll Depth Tracking</h2>
      <p>
        Fire events when users scroll to specific sections using the{" "}
        <code>data-ezlytics-scroll</code> attribute. Uses{" "}
        <code>IntersectionObserver</code> under the hood — no performance
        impact.
      </p>

      <CodeBlock
        language="html"
        code={`<section
  data-ezlytics-scroll="reached-pricing"
  data-ezlytics-scroll-threshold="0.5"
  data-ezlytics-scroll-delay="500"
>
  <h2>Pricing</h2>
</section>`}
      />

      <h2>User Identification</h2>
      <p>
        Associate events with a specific logged-in user using the{" "}
        <code>identify</code> command. This links all future events in that
        session to the user.
      </p>

      <CodeBlock
        language="javascript"
        code={`window.ezlytics("identify", {
  user_id: "user_abc123",  // required
  name: "Jane Doe",        // optional
  plan: "pro",             // any extra keys become metadata
  company: "Acme Inc",
});`}
      />

      <h2>Funnel Analysis</h2>
      <p>
        Define a sequence of custom events (e.g., &quot;Visited Pricing&quot; →
        &quot;Clicked Signup&quot; → &quot;Completed Registration&quot;) to
        visualize drop-off rates at each step. Access this from the{" "}
        <strong>Funnels</strong> tab on your dashboard.
      </p>

      <h2>Revenue Tracking</h2>
      <p>
        Revenue events are captured automatically via webhook integration (e.g.,
        LemonSqueezy). Your revenue dashboard is updated in real time and broken
        down by traffic source, UTM campaign, and referrer.
      </p>

      <h2>Script Configuration Options</h2>
      <p>
        The script supports several optional attributes for advanced setups:
      </p>

      <div className="overflow-x-auto not-prose my-6">
        <table className="w-full text-sm border-2 border-foreground">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-3 border-b-2 border-r-2 border-foreground font-bold">
                Attribute
              </th>
              <th className="text-left p-3 border-b-2 border-foreground font-bold">
                Effect
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                "data-allow-localhost",
                "Enable tracking on localhost (useful during development)",
              ],
              [
                "data-disable-console",
                "Suppress all [Ezlytics] console warnings",
              ],
              [
                "data-allowed-hostnames",
                "Whitelist specific hostnames (comma-separated)",
              ],
              [
                "data-api-url",
                "Override the tracking endpoint URL (for self-hosted setups)",
              ],
              ["data-allow-file-protocol", "Enable tracking on file:// pages"],
            ].map(([attr, desc]) => (
              <tr key={attr} className="border-b border-foreground/20">
                <td className="p-3 border-r-2 border-foreground font-mono text-xs">
                  {attr}
                </td>
                <td className="p-3 text-muted-foreground">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-100 dark:bg-blue-900/30 border-2 border-foreground p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] my-8">
        <h4 className="font-bold flex items-center gap-2 m-0 text-blue-900 dark:text-blue-200">
          <span className="text-xl">🔒</span> Do Not Track
        </h4>
        <p className="m-0 mt-2 text-blue-800 dark:text-blue-100">
          The script automatically respects the browser&apos;s{" "}
          <code>navigator.doNotTrack</code> flag. If a visitor has DNT enabled,
          all tracking is silently disabled — no data is sent.
        </p>
      </div>
    </div>
  );
}
