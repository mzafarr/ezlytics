"use client";

import Link from "next/link";
import { type Route } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SiteSummary = {
  id: string;
  name: string;
  domain: string;
  websiteId: string;
  apiKey: string;
};

export function DashboardLoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Loading analytics...</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Fetching site details and rollups.
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardSettingsView({ site }: { site: SiteSummary }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site Settings</CardTitle>
          <CardDescription>
            {site.name} · {site.domain}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Installation Snippet</div>
            <div className="relative rounded-md bg-muted p-4 font-mono text-xs">
              <pre className="overflow-x-auto">{`<script
  defer
  data-website-id="${site.websiteId}"
  data-domain="${site.domain}"
  data-api-key="${site.apiKey}"
  data-allow-localhost
  src="/js/script.js"
></script>`}</pre>
            </div>
            <p className="text-xs text-muted-foreground">
              Add this snippet to the &lt;head&gt; of your website. For
              production, use your full domain URL for src.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Site ID</div>
            <div className="rounded-md bg-muted p-3 font-mono text-sm">
              {site.id}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardFunnelsView({
  site,
}: {
  site: Pick<SiteSummary, "name" | "domain">;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Funnels</CardTitle>
          <CardDescription>
            {site.name} · {site.domain}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Create and view conversion funnels for your site.</p>
          <p className="mt-4">Funnel analytics coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardEmptyState({
  site,
  siteId,
}: {
  site: Pick<SiteSummary, "name" | "domain">;
  siteId: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Awaiting first event...</CardTitle>
          <CardDescription>
            {site.name} · {site.domain}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-4">
            <li>Install the tracking script from Settings.</li>
            <li>Visit your site to trigger a pageview.</li>
            <li>Refresh this dashboard after a minute.</li>
            <li>Contact support if events still do not appear.</li>
          </ol>
          <Link
            href={`/dashboard/${siteId}/settings` as Route}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Install script
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {["Visitors", "Revenue", "Top pages", "Goal conversions"].map(
          (title) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                No data yet
              </CardContent>
            </Card>
          ),
        )}
      </div>
    </div>
  );
}
