"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { type Route } from "next";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, trpc } from "@/utils/trpc";

const PROVIDERS = [
  { value: "stripe", label: "Stripe" },
  { value: "lemonsqueezy", label: "LemonSqueezy" },
] as const;

type ProviderValue = (typeof PROVIDERS)[number]["value"];

const INSTRUCTIONS: Record<
  ProviderValue,
  { title: string; steps: string[]; placeholder: string; inputLabel: string }
> = {
  stripe: {
    title: "How to get your Stripe secret key",
    steps: [
      "Go to dashboard.stripe.com → Developers → API keys",
      "Copy your Secret key — starts with sk_live_… or sk_test_…",
      "Paste it below. We'll register the webhook endpoint in Stripe and store only the signing secret.",
    ],
    inputLabel: "Stripe Secret Key",
    placeholder: "sk_live_...",
  },
  lemonsqueezy: {
    title: "How to get your LemonSqueezy API key",
    steps: [
      "Go to app.lemonsqueezy.com → Settings → API",
      "Click + New API key, give it a name, and copy the key",
      "Paste it below. We'll create the webhook and generate a signing secret automatically.",
    ],
    inputLabel: "LemonSqueezy API Key",
    placeholder: "eyJ0...",
  },
};

export default function RevenueAttributionStep() {
  const router = useRouter();
  const sitesQueryOptions = trpc.sites.list.queryOptions();
  const sitesQuery = useQuery(sitesQueryOptions);

  const [provider, setProvider] = useState<ProviderValue>("stripe");
  const [apiKey, setApiKey] = useState("");

  const createRevenueWebhook = useMutation(
    trpc.sites.createRevenueWebhook.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        toast.success("Revenue provider connected!");
        router.push("/dashboard" as Route);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const handleConnect = () => {
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
    createRevenueWebhook.mutate({
      siteId: targetSite.id,
      provider,
      apiKey: trimmedKey,
    });
  };

  const instructions = INSTRUCTIONS[provider];

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Connect revenue attribution</CardTitle>
          <CardDescription>
            Step 3 of 3 · Paste your API key and we&apos;ll register the webhook
            automatically — no manual setup needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Provider toggle */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <div className="flex gap-2">
              {PROVIDERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`px-4 py-1.5 text-sm font-semibold border-2 border-input transition-colors rounded-md ${
                    provider === value
                      ? "bg-foreground text-background"
                      : "bg-transparent hover:bg-muted"
                  }`}
                  onClick={() => {
                    setProvider(value);
                    setApiKey("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-md border bg-muted p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider">
              {instructions.title}
            </p>
            <ol className="space-y-2 text-sm">
              {instructions.steps.map((step, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-none font-black text-xs bg-foreground text-background w-5 h-5 flex items-center justify-center rounded-sm">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* API key input */}
          <div className="space-y-2">
            <Label htmlFor="revenue-api-key">{instructions.inputLabel}</Label>
            <Input
              id="revenue-api-key"
              type="password"
              placeholder={instructions.placeholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
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
          <Button
            type="button"
            onClick={handleConnect}
            disabled={createRevenueWebhook.isPending || !apiKey.trim()}
          >
            {createRevenueWebhook.isPending
              ? "Connecting..."
              : `Connect ${provider === "stripe" ? "Stripe" : "LemonSqueezy"}`}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
