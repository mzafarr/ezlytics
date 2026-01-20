"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import z from "zod";
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
import {
  revenueProviderSchema,
  defaultRevenueProvider,
  type Exclusions,
} from "../schema";

import { useEffect, useRef, useState } from "react";

const storageKeyRevenueProvider = "datafast.revenueProvider";

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
  const [revenueProviderSettings, setRevenueProviderSettings] = useState<
    z.infer<typeof revenueProviderSchema>
  >(defaultRevenueProvider);
  const revenueStorageErrorRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKeyRevenueProvider);
      if (stored) {
        const parsed = revenueProviderSchema.safeParse(JSON.parse(stored));
        if (parsed.success) {
          setRevenueProviderSettings(parsed.data);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKeyRevenueProvider,
        JSON.stringify(revenueProviderSettings),
      );
    } catch {
      if (!revenueStorageErrorRef.current) {
        revenueStorageErrorRef.current = true;
        toast.error("Failed to save revenue settings locally");
      }
    }
  }, [revenueProviderSettings]);

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

  const siteForm = useForm({
    defaultValues: {
      name: "",
      domain: "",
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
      }),
    },
    onSubmit: async ({ value }) => {
      await createSite.mutateAsync({
        name: value.name,
        domain: value.domain,
      });
    },
  });

  const installSnippet = latestSite
    ? `<script\n  defer\n  data-website-id="${latestSite.websiteId}"\n  data-domain="${latestSite.domain}"\n  data-api-key="${latestSite.apiKey}"\n  src="https://your-analytics-domain.com/js/script.js"\n></script>`
    : "";
  const apiKey = latestSite?.apiKey ?? "";

  const revenueProviderLabel =
    revenueProviderSettings.provider === "stripe"
      ? "Stripe"
      : revenueProviderSettings.provider === "lemonsqueezy"
        ? "LemonSqueezy"
        : "No provider";
  const revenueConnectionReady =
    revenueProviderSettings.provider !== "none" &&
    revenueProviderSettings.webhookSecret.trim().length > 0;
  const revenueStatusLabel =
    revenueProviderSettings.provider === "none"
      ? "Not connected"
      : revenueConnectionReady
        ? `${revenueProviderLabel} connected`
        : `${revenueProviderLabel} disconnected`;

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
              <Button type="submit" disabled={createSite.isPending}>
                Create Site
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Installation Snippet</Label>
                <div className="relative rounded-md bg-muted p-4 font-mono text-xs">
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
            Connect a payment provider to track revenue
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              value={revenueProviderSettings.provider}
              onChange={(e) =>
                setRevenueProviderSettings((prev) => ({
                  ...prev,
                  provider: e.target.value as any,
                }))
              }
            >
              <option value="none">None</option>
              <option value="stripe">Stripe</option>
              <option value="lemonsqueezy">LemonSqueezy</option>
            </select>
          </div>
          {revenueProviderSettings.provider !== "none" && (
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <Input
                type="password"
                value={revenueProviderSettings.webhookSecret}
                onChange={(e) =>
                  setRevenueProviderSettings((prev) => ({
                    ...prev,
                    webhookSecret: e.target.value,
                  }))
                }
              />
              <div className="flex items-center gap-2 pt-2">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${revenueConnectionReady ? "bg-emerald-500" : "bg-red-500"}`}
                />
                <span className="text-xs text-muted-foreground">
                  {revenueStatusLabel}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
