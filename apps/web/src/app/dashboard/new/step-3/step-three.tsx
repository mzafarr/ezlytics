"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { revenueProviderSchema } from "@/components/dashboard/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, trpc } from "@/utils/trpc";

const providerOptions = ["stripe", "lemonsqueezy"] as const;
type ProviderOption = (typeof providerOptions)[number];

export default function RevenueAttributionStep() {
  const router = useRouter();
  const sitesQueryOptions = trpc.sites.list.queryOptions();
  const sitesQuery = useQuery(sitesQueryOptions);
  const updateRevenueProvider = useMutation(
    trpc.sites.updateRevenueProvider.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
      },
    }),
  );
  const [provider, setProvider] = useState<ProviderOption>(providerOptions[0]);
  const [apiKey, setApiKey] = useState("");

  const connectDisabled = apiKey.trim().length === 0 || updateRevenueProvider.isPending;

  const handleConnect = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      toast.error("API key is required");
      return;
    }
    const targetSite = sitesQuery.data?.[0];
    if (!targetSite) {
      toast.error("Create a site before connecting revenue");
      return;
    }
    const parsed = revenueProviderSchema.safeParse({
      provider,
      webhookSecret: trimmedKey,
    });
    if (!parsed.success) {
      toast.error("Invalid revenue settings");
      return;
    }
    try {
      await updateRevenueProvider.mutateAsync({
        siteId: targetSite.id,
        provider: parsed.data.provider,
        webhookSecret: parsed.data.webhookSecret,
      });
      toast.success("Revenue provider connected");
      router.push("/dashboard" as Route);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save revenue settings",
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Connect revenue attribution</CardTitle>
          <CardDescription>Step 3 of 3 · Connect Stripe or LemonSqueezy to track revenue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="revenue-provider">Provider</Label>
            <select
              id="revenue-provider"
              value={provider}
              onChange={(event) => {
                const nextProvider = providerOptions.find(
                  (option) => option === event.target.value,
                );
                if (nextProvider) {
                  setProvider(nextProvider);
                }
              }}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            >
              <option value="stripe">Stripe</option>
              <option value="lemonsqueezy">LemonSqueezy</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="revenue-api-key">API Key</Label>
            <Input
              id="revenue-api-key"
              type="password"
              placeholder="sk_live_..."
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Paste your provider secret key to connect revenue attribution.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/dashboard" as Route)}
          >
            Skip for now
          </Button>
          <Button type="button" onClick={handleConnect} disabled={connectDisabled}>
            Connect
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
