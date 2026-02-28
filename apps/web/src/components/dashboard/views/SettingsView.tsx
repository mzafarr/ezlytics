"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import z from "zod";
import { env } from "@my-better-t-app/env/web";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { queryClient, trpc } from "@/utils/trpc";
import { type Exclusions } from "../schema";

import { useEffect, useMemo, useState } from "react";

export function SettingsView({
  latestSite,
  exclusions,
  setExclusions,
}: {
  latestSite?: any;
  exclusions: Exclusions;
  setExclusions: (
    next: Exclusions | ((current: Exclusions) => Exclusions),
  ) => void;
}) {
  const [providerForConnect, setProviderForConnect] = useState<
    "stripe" | "lemonsqueezy"
  >("stripe");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [isReconnecting, setIsReconnecting] = useState(false);

  const sitesQueryOptions = trpc.sites.list.queryOptions();

  const createSite = useMutation(
    trpc.sites.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        toast.success("Site created");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const rotateApiKey = useMutation(
    trpc.sites.rotateApiKey.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        toast.success("API key rotated");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const createRevenueWebhook = useMutation(
    trpc.sites.createRevenueWebhook.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        setProviderApiKey("");
        setIsReconnecting(false);
        toast.success("Revenue provider connected!");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const updateRevenueProvider = useMutation(
    trpc.sites.updateRevenueProvider.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        toast.success("Revenue settings updated");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  useEffect(() => {
    if (!latestSite) return;
    setIsReconnecting(false);
    setProviderApiKey("");
  }, [latestSite?.id]);

  const siteForm = useForm({
    defaultValues: {
      name: "",
      domain: "",
      timezone: "UTC",
    },
    validators: {
      onSubmit: z.object({
        name: z
          .string()
          .trim()
          .min(1, "Site name is required")
          .max(100, "Max 100 characters"),
        domain: z
          .string()
          .trim()
          .min(1, "Root domain is required")
          .max(255, "Max 255 characters"),
        timezone: z
          .string()
          .trim()
          .min(1, "Timezone is required")
          .max(64, "Max 64 characters"),
      }),
    },
    onSubmit: async ({ value }) => {
      await createSite.mutateAsync({
        name: value.name,
        domain: value.domain,
        timezone: value.timezone,
      });
    },
  });

  const appUrl = env.NEXT_PUBLIC_APP_URL ?? "";
  const installSnippet = latestSite
    ? `<script\n  defer\n  data-website-id="${latestSite.websiteId}"\n  data-domain="${latestSite.domain}"\n  data-api-key="${latestSite.apiKey}"\n  src="${appUrl}/js/script.js"\n></script>`
    : "";
  const apiKey = latestSite?.apiKey ?? "";

  const connectedProvider = latestSite?.revenueProvider;
  const isConnected =
    !!connectedProvider &&
    connectedProvider !== "none" &&
    !!latestSite?.revenueProviderKeyUpdatedAt;
  const connectedProviderLabel =
    connectedProvider === "stripe"
      ? "Stripe"
      : connectedProvider === "lemonsqueezy"
        ? "LemonSqueezy"
        : "";
  const revenueLastUpdatedLabel = useMemo(() => {
    if (!latestSite?.revenueProviderKeyUpdatedAt) return "Not connected";
    const date = new Date(latestSite.revenueProviderKeyUpdatedAt);
    if (Number.isNaN(date.getTime())) return "Connected";
    return `Connected ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }, [latestSite?.revenueProviderKeyUpdatedAt]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site settings</CardTitle>
          <CardDescription>
            Manage your websites and getting started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!latestSite ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                siteForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <siteForm.Field
                name="name"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="site-name">Site Name</Label>
                    <Input
                      id="site-name"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    {field.state.meta.errors ? (
                      <p className="text-sm text-destructive">
                        {field.state.meta.errors.join(", ")}
                      </p>
                    ) : null}
                  </div>
                )}
              />
              <siteForm.Field
                name="domain"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="site-domain">Domain</Label>
                    <Input
                      id="site-domain"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="example.com"
                    />
                    {field.state.meta.errors ? (
                      <p className="text-sm text-destructive">
                        {field.state.meta.errors.join(", ")}
                      </p>
                    ) : null}
                  </div>
                )}
              />
              <siteForm.Field
                name="timezone"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="site-timezone">Timezone</Label>
                    <Input
                      id="site-timezone"
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="UTC"
                    />
                    {field.state.meta.errors ? (
                      <p className="text-sm text-destructive">
                        {field.state.meta.errors.join(", ")}
                      </p>
                    ) : null}
                  </div>
                )}
              />
              <Button type="submit" disabled={createSite.isPending}>
                Create Site
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Installation Snippet</Label>
                <div className="relative rounded-none border-2 border-foreground bg-muted p-4 font-mono text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <pre className="overflow-x-auto">{installSnippet}</pre>
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
                  Add this snippet to the &lt;head&gt; of your website.
                </p>
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex items-center gap-2">
                  <Input value={apiKey} readOnly className="font-mono" />
                  <Button
                    variant="outline"
                    onClick={() => {
                      rotateApiKey.mutate({ siteId: latestSite.id });
                    }}
                    disabled={rotateApiKey.isPending}
                  >
                    Rotate
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Exclusions</CardTitle>
          <CardDescription>
            Filter out unwanted traffic from your analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Exclude IP Addresses or Hostnames</Label>
            <Input
              value={exclusions.hostnames}
              onChange={(e) =>
                setExclusions((prev) => ({
                  ...prev,
                  hostnames: e.target.value,
                }))
              }
              placeholder="localhost, 127.0.0.1, internal-tools"
            />
            <p className="text-xs text-muted-foreground">
              Comma separated. Supports wildcards (*).
            </p>
          </div>
          <div className="space-y-2">
            <Label>Exclude Paths</Label>
            <Input
              value={exclusions.pathPatterns}
              onChange={(e) =>
                setExclusions((prev) => ({
                  ...prev,
                  pathPatterns: e.target.value,
                }))
              }
              placeholder="/admin/*, /staging/*"
            />
          </div>
          <div className="space-y-2">
            <Label>Exclude Countries</Label>
            <Input
              value={exclusions.countries}
              onChange={(e) =>
                setExclusions((prev) => ({
                  ...prev,
                  countries: e.target.value,
                }))
              }
              placeholder="Russia, China"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="exclude-self"
              checked={exclusions.excludeSelf}
              onCheckedChange={(checked) =>
                setExclusions((prev) => ({
                  ...prev,
                  excludeSelf: checked === true,
                }))
              }
            />
            <Label htmlFor="exclude-self">Exclude my own visits</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Revenue integration</CardTitle>
          <CardDescription>
            Paste your payment provider API key — we&apos;ll register the
            webhook automatically and discard the key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Connected state */}
          {isConnected && !isReconnecting && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-2 border-emerald-200 bg-emerald-50 p-4">
                <div className="h-2.5 w-2.5 rounded-none border-2 border-foreground bg-emerald-500" />
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
                  onClick={() => {
                    if (!latestSite?.id) return;
                    updateRevenueProvider.mutate({
                      siteId: latestSite.id,
                      provider: "none",
                      webhookSecret: "",
                    });
                  }}
                  disabled={updateRevenueProvider.isPending}
                >
                  Disconnect
                </Button>
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
                <div className="rounded-none border-2 border-foreground bg-muted p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    How to get your Stripe secret key
                  </p>
                  <ol className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center">
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
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center">
                        2
                      </span>
                      <span>
                        Copy your <strong>Secret key</strong> — starts with{" "}
                        <code className="bg-background px-1 text-xs border border-foreground/20">
                          sk_live_…
                        </code>{" "}
                        or{" "}
                        <code className="bg-background px-1 text-xs border border-foreground/20">
                          sk_test_…
                        </code>
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center">
                        3
                      </span>
                      <span>
                        Paste it below. We&apos;ll create the webhook endpoint
                        in your Stripe account and store only the signing
                        secret.
                      </span>
                    </li>
                  </ol>
                </div>
              )}

              {/* LemonSqueezy instructions */}
              {providerForConnect === "lemonsqueezy" && (
                <div className="rounded-none border-2 border-foreground bg-muted p-4 space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    How to get your LemonSqueezy API key
                  </p>
                  <ol className="space-y-2 text-sm">
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center">
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
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center">
                        2
                      </span>
                      <span>
                        Click <strong>+ New API key</strong>, give it a name,
                        and copy the key
                      </span>
                    </li>
                    <li className="flex gap-2">
                      <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center">
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
                <Label htmlFor="provider-api-key">
                  {providerForConnect === "stripe"
                    ? "Stripe Secret Key"
                    : "LemonSqueezy API Key"}
                </Label>
                <Input
                  id="provider-api-key"
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
                  onClick={() => {
                    if (!latestSite?.id) {
                      toast.error("Select a site first");
                      return;
                    }
                    createRevenueWebhook.mutate({
                      siteId: latestSite.id,
                      provider: providerForConnect,
                      apiKey: providerApiKey.trim(),
                    });
                  }}
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
