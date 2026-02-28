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
  const [providerForConnect, setProviderForConnect] = useState<
    "stripe" | "lemonsqueezy"
  >("stripe");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    setIsReconnecting(false);
    setProviderApiKey("");
    setSyncApiKey("");
    setSyncFromDate("");
    setSyncResult(null);
  }, [site.id]);

  // ── Historical sync ──
  const [syncApiKey, setSyncApiKey] = useState("");
  const [syncFromDate, setSyncFromDate] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number } | null>(null);

  const handleHistoricalSync = async () => {
    const key = syncApiKey.trim();
    if (!key) {
      toast.error("Enter your API key to sync");
      return;
    }
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/revenue/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          provider: site.revenueProvider,
          apiKey: key,
          fromDate: syncFromDate || undefined,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        toast.error(
          typeof data.error === "string" ? data.error : "Sync failed",
        );
      } else {
        const count = typeof data.synced === "number" ? data.synced : 0;
        setSyncResult({ synced: count });
        setSyncApiKey("");
        toast.success(
          `Synced ${count} historical order${count !== 1 ? "s" : ""}`,
        );
      }
    } catch {
      toast.error("Sync failed — check your connection");
    } finally {
      setIsSyncing(false);
    }
  };

  const createRevenueWebhook = useMutation(
    trpc.sites.createRevenueWebhook.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        setProviderApiKey("");
        setIsReconnecting(false);
        toast.success("Revenue provider connected!");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const updateRevenueProvider = useMutation(
    trpc.sites.updateRevenueProvider.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        toast.success("Revenue settings saved");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const isConnected =
    !!site.revenueProvider &&
    site.revenueProvider !== "none" &&
    !!site.revenueProviderKeyUpdatedAt;

  const connectedProviderLabel =
    site.revenueProvider === "stripe"
      ? "Stripe"
      : site.revenueProvider === "lemonsqueezy"
        ? "LemonSqueezy"
        : "";

  const revenueLastUpdatedLabel = useMemo(() => {
    if (!site.revenueProviderKeyUpdatedAt) return "Not connected";
    const date = new Date(site.revenueProviderKeyUpdatedAt as string);
    if (Number.isNaN(date.getTime())) return "Connected";
    return `Connected ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }, [site.revenueProviderKeyUpdatedAt]);

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
            Paste your API key — we&apos;ll register the webhook automatically
            and discard the key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Connected state */}
          {isConnected && !isReconnecting && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-sm font-semibold">
                    Connected via {connectedProviderLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {revenueLastUpdatedLabel}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReconnecting(true)}
                >
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateRevenueProvider.mutate({
                      siteId: site.id,
                      provider: "none",
                      webhookSecret: "",
                    })
                  }
                  disabled={updateRevenueProvider.isPending}
                >
                  Disconnect
                </Button>
              </div>

              {/* ── Historical sync ── */}
              <div className="rounded-md border bg-muted/50 p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold">
                    Sync historical orders
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Import past {connectedProviderLabel} orders into your
                    revenue dashboard. Your API key is used once and never
                    stored.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="sync-from-date" className="text-xs">
                      From date (optional)
                    </Label>
                    <Input
                      id="sync-from-date"
                      type="date"
                      value={syncFromDate}
                      onChange={(e) => setSyncFromDate(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sync-api-key" className="text-xs">
                      {site.revenueProvider === "stripe"
                        ? "Stripe Secret Key"
                        : "LemonSqueezy API Key"}
                    </Label>
                    <Input
                      id="sync-api-key"
                      type="password"
                      placeholder={
                        site.revenueProvider === "stripe"
                          ? "sk_live_..."
                          : "eyJ0..."
                      }
                      value={syncApiKey}
                      onChange={(e) => setSyncApiKey(e.target.value)}
                      autoComplete="off"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleHistoricalSync}
                    disabled={isSyncing || !syncApiKey.trim()}
                  >
                    {isSyncing ? "Syncing…" : "Sync orders"}
                  </Button>
                  {syncResult !== null && (
                    <span className="text-xs text-muted-foreground">
                      ✓ {syncResult.synced} order
                      {syncResult.synced !== 1 ? "s" : ""} imported
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Setup form */}
          {(!isConnected || isReconnecting) && (
            <div className="space-y-5">
              {/* Provider toggle */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <div className="flex gap-2">
                  {(["stripe", "lemonsqueezy"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`px-4 py-1.5 text-sm font-semibold border-2 border-foreground transition-colors ${
                        providerForConnect === p
                          ? "bg-foreground text-background shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-transparent hover:bg-muted"
                      }`}
                      onClick={() => {
                        setProviderForConnect(p);
                        setProviderApiKey("");
                      }}
                    >
                      {p === "stripe" ? "Stripe" : "LemonSqueezy"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stripe instructions */}
              {providerForConnect === "stripe" && (
                <div className="rounded-md border bg-muted p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    How to get your Stripe secret key
                  </p>
                  <ol className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center rounded-sm">
                        1
                      </span>
                      <span>
                        Go to{" "}
                        <a
                          href="https://dashboard.stripe.com/apikeys"
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-semibold"
                        >
                          dashboard.stripe.com → Developers → API keys
                        </a>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center rounded-sm">
                        2
                      </span>
                      <span>
                        Copy your <strong>Secret key</strong> — starts with{" "}
                        <code className="bg-background px-1 text-xs">
                          sk_live_…
                        </code>{" "}
                        or{" "}
                        <code className="bg-background px-1 text-xs">
                          sk_test_…
                        </code>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center rounded-sm">
                        3
                      </span>
                      <span>
                        Paste it below. We&apos;ll create the webhook in your
                        Stripe account and store only the signing secret.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              {/* LemonSqueezy instructions */}
              {providerForConnect === "lemonsqueezy" && (
                <div className="rounded-md border bg-muted p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    How to get your LemonSqueezy API key
                  </p>
                  <ol className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center rounded-sm">
                        1
                      </span>
                      <span>
                        Go to{" "}
                        <a
                          href="https://app.lemonsqueezy.com/settings/api"
                          target="_blank"
                          rel="noreferrer"
                          className="underline font-semibold"
                        >
                          app.lemonsqueezy.com → Settings → API
                        </a>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center rounded-sm">
                        2
                      </span>
                      <span>
                        Click <strong>+ New API key</strong>, give it a name,
                        and copy the key
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center rounded-sm">
                        3
                      </span>
                      <span>
                        Paste it below. We&apos;ll create the webhook and
                        generate a signing secret automatically.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              {/* API key input */}
              <div className="space-y-2">
                <Label htmlFor="site-provider-api-key">
                  {providerForConnect === "stripe"
                    ? "Stripe Secret Key"
                    : "LemonSqueezy API Key"}
                </Label>
                <Input
                  id="site-provider-api-key"
                  type="password"
                  placeholder={
                    providerForConnect === "stripe" ? "sk_live_..." : "eyJ0..."
                  }
                  value={providerApiKey}
                  onChange={(e) => setProviderApiKey(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() =>
                    createRevenueWebhook.mutate({
                      siteId: site.id,
                      provider: providerForConnect,
                      apiKey: providerApiKey.trim(),
                    })
                  }
                  disabled={
                    createRevenueWebhook.isPending || !providerApiKey.trim()
                  }
                >
                  {createRevenueWebhook.isPending
                    ? "Connecting..."
                    : `Connect ${providerForConnect === "stripe" ? "Stripe" : "LemonSqueezy"}`}
                </Button>
                {isReconnecting && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsReconnecting(false);
                      setProviderApiKey("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
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
