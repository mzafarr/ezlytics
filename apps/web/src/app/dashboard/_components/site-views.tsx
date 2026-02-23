"use client";

import Link from "next/link";
import { type Route } from "next";
import { useState, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { env } from "@my-better-t-app/env/web";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { queryClient, trpc } from "@/utils/trpc";

type SiteSummary = {
  id: string;
  name: string;
  domain: string;
  websiteId: string;
  apiKey: string;
  revenueProvider?: string | null;
  revenueProviderKeyUpdatedAt?: string | Date | null;
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
  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
  const installSnippet = `<script\n  defer\n  data-website-id="${site.websiteId}"\n  data-domain="${site.domain}"\n  data-api-key="${site.apiKey}"\n  src="${appUrl}/js/script.js"\n></script>`;

  const sitesQueryOptions = trpc.sites.list.queryOptions();

  // ── API key rotation ──
  const rotateApiKey = useMutation(
    trpc.sites.rotateApiKey.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        toast.success("API key rotated");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  // ── Revenue provider ──
  const [provider, setProvider] = useState<"none" | "stripe" | "lemonsqueezy">(
    (site.revenueProvider as any) ?? "none",
  );
  const [webhookSecret, setWebhookSecret] = useState("");

  useEffect(() => {
    setProvider((site.revenueProvider as any) ?? "none");
  }, [site.revenueProvider]);

  const updateRevenueProvider = useMutation(
    trpc.sites.updateRevenueProvider.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        setWebhookSecret("");
        toast.success("Revenue settings saved");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const revenueLastUpdatedLabel = useMemo(() => {
    if (!site.revenueProviderKeyUpdatedAt) return "Not connected";
    const date = new Date(site.revenueProviderKeyUpdatedAt as string);
    if (Number.isNaN(date.getTime())) return "Connected";
    return `Connected ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }, [site.revenueProviderKeyUpdatedAt]);

  const canSaveRevenue = provider === "none" || webhookSecret.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* ── Installation ── */}
      <Card>
        <CardHeader>
          <CardTitle>Installation</CardTitle>
          <CardDescription>
            {site.name} · {site.domain}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tracking Snippet</Label>
            <div className="relative rounded-md bg-muted p-4 font-mono text-xs">
              <pre className="overflow-x-auto pr-16">{installSnippet}</pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute right-2 top-2 h-7"
                onClick={() => {
                  navigator.clipboard.writeText(installSnippet);
                  toast.success("Snippet copied");
                }}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this into the <code>&lt;head&gt;</code> of every page you
              want to track.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── API Key ── */}
      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>
            Used to authenticate events from your site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={site.apiKey} readOnly className="font-mono" />
            <Button
              variant="outline"
              onClick={() => rotateApiKey.mutate({ siteId: site.id })}
              disabled={rotateApiKey.isPending}
            >
              {rotateApiKey.isPending ? "Rotating…" : "Rotate"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Rotating generates a new key immediately — update your snippet
            afterwards.
          </p>
        </CardContent>
      </Card>

      {/* ── Revenue Integration ── */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Integration</CardTitle>
          <CardDescription>
            Connect a payment provider to track revenue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={provider}
              onChange={(e) => setProvider(e.target.value as any)}
            >
              <option value="none">None</option>
              <option value="stripe">Stripe</option>
              <option value="lemonsqueezy">LemonSqueezy</option>
            </select>
          </div>

          {provider !== "none" && (
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <Input
                type="password"
                placeholder="Enter webhook secret…"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {revenueLastUpdatedLabel}
              </p>
            </div>
          )}

          <Button
            onClick={() =>
              updateRevenueProvider.mutate({
                siteId: site.id,
                provider,
                webhookSecret,
              })
            }
            disabled={updateRevenueProvider.isPending || !canSaveRevenue}
          >
            {updateRevenueProvider.isPending ? "Saving…" : "Save"}
          </Button>
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
