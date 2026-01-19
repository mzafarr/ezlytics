"use client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const storageKeyFunnels = "datafast.funnels";
const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const funnelStepSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("page"),
    urlContains: z.string(),
  }),
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("goal"),
    goalName: z.string(),
  }),
]);

const funnelSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(funnelStepSchema),
});

const funnelsSchema = z.array(funnelSchema);

type Funnel = z.infer<typeof funnelSchema>;
type FunnelStep = z.infer<typeof funnelStepSchema>;

const createSampleFunnel = (): Funnel => ({
  id: createId(),
  name: "Sample funnel",
  steps: [
    { id: createId(), name: "Landing page", type: "page", urlContains: "/" },
    { id: createId(), name: "Pricing page", type: "page", urlContains: "/pricing" },
    { id: createId(), name: "Signup", type: "goal", goalName: "signup" },
  ],
});

const createEmptyFunnel = (): Funnel => ({
  id: createId(),
  name: "",
  steps: [{ id: createId(), name: "", type: "page", urlContains: "/" }],
});

const analyticsSamples = [
  {
    date: "2026-01-16",
    referrer: "https://google.com",
    source: "google",
    campaign: "winter-launch",
    country: "US",
    device: "desktop",
    browser: "chrome",
    os: "macos",
    path: "/",
    goal: "signup",
    revenue: 0,
    eventType: "pageview",
  },
  {
    date: "2026-01-16",
    referrer: "https://google.com",
    source: "google",
    campaign: "winter-launch",
    country: "US",
    device: "desktop",
    browser: "chrome",
    os: "macos",
    path: "/pricing",
    goal: "signup",
    revenue: 120,
    eventType: "goal",
  },
  {
    date: "2026-01-17",
    referrer: "https://twitter.com",
    source: "twitter",
    campaign: "launch-week",
    country: "GB",
    device: "mobile",
    browser: "safari",
    os: "ios",
    path: "/",
    goal: "",
    revenue: 0,
    eventType: "pageview",
  },
  {
    date: "2026-01-17",
    referrer: "https://twitter.com",
    source: "twitter",
    campaign: "launch-week",
    country: "GB",
    device: "mobile",
    browser: "safari",
    os: "ios",
    path: "/features",
    goal: "",
    revenue: 0,
    eventType: "pageview",
  },
  {
    date: "2026-01-18",
    referrer: "https://news.ycombinator.com",
    source: "hn",
    campaign: "show-hn",
    country: "DE",
    device: "desktop",
    browser: "firefox",
    os: "linux",
    path: "/blog/launch",
    goal: "demo_request",
    revenue: 0,
    eventType: "goal",
  },
  {
    date: "2026-01-18",
    referrer: "https://news.ycombinator.com",
    source: "hn",
    campaign: "show-hn",
    country: "DE",
    device: "desktop",
    browser: "firefox",
    os: "linux",
    path: "/pricing",
    goal: "",
    revenue: 0,
    eventType: "pageview",
  },
  {
    date: "2026-01-19",
    referrer: "https://newsletter.example.com",
    source: "newsletter",
    campaign: "jan-recap",
    country: "CA",
    device: "desktop",
    browser: "edge",
    os: "windows",
    path: "/",
    goal: "",
    revenue: 0,
    eventType: "pageview",
  },
  {
    date: "2026-01-19",
    referrer: "https://newsletter.example.com",
    source: "newsletter",
    campaign: "jan-recap",
    country: "CA",
    device: "desktop",
    browser: "edge",
    os: "windows",
    path: "/pricing",
    goal: "purchase",
    revenue: 240,
    eventType: "goal",
  },
] as const;

const defaultFilters = {
  startDate: "",
  endDate: "",
  referrer: "",
  source: "",
  campaign: "",
  country: "",
  device: "",
  browser: "",
  os: "",
  pagePath: "",
  goalName: "",
};

const filterLabels = {
  startDate: "Start date",
  endDate: "End date",
  referrer: "Referrer",
  source: "Source",
  campaign: "Campaign",
  country: "Country",
  device: "Device",
  browser: "Browser",
  os: "OS",
  pagePath: "Page path",
  goalName: "Goal name",
} as const;

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const privateData = useQuery(trpc.privateData.queryOptions());
  const sitesQueryOptions = trpc.sites.list.queryOptions();
  const sites = useQuery(sitesQueryOptions);
  const [hasCopied, setHasCopied] = useState(false);
  const [hasCopiedKey, setHasCopiedKey] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [funnelDraft, setFunnelDraft] = useState<Funnel>(() => createEmptyFunnel());
  const storageErrorRef = useRef(false);

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
        name: z.string().trim().min(1, "Site name is required").max(100, "Max 100 characters"),
        domain: z.string().trim().min(1, "Root domain is required").max(255, "Max 255 characters"),
      }),
    },
    onSubmit: async ({ value }) => {
      await createSite.mutateAsync({
        name: value.name,
        domain: value.domain,
      });
    },
  });

  const latestSite = sites.data?.[0];
  const installSnippet = latestSite
    ? `<script\n  defer\n  data-website-id=\"${latestSite.websiteId}\"\n  data-domain=\"${latestSite.domain}\"\n  src=\"https://your-analytics-domain.com/script.js\"\n></script>`
    : "";
  const apiKey = latestSite?.apiKey ?? "";
  const activeFilters = (Object.entries(filters) as Array<[keyof typeof defaultFilters, string]>)
    .map(([key, value]) => ({ key, label: filterLabels[key], value: value.trim() }))
    .filter(({ value }) => value.length > 0);
  const activeFilterCount = activeFilters.length;

  const filteredEvents = useMemo(() => {
    const normalized = {
      referrer: filters.referrer.trim().toLowerCase(),
      source: filters.source.trim().toLowerCase(),
      campaign: filters.campaign.trim().toLowerCase(),
      country: filters.country.trim().toLowerCase(),
      device: filters.device.trim().toLowerCase(),
      browser: filters.browser.trim().toLowerCase(),
      os: filters.os.trim().toLowerCase(),
      pagePath: filters.pagePath.trim().toLowerCase(),
      goalName: filters.goalName.trim().toLowerCase(),
    };
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    return analyticsSamples.filter((event) => {
      const eventDate = new Date(event.date);
      if (startDate && eventDate < startDate) {
        return false;
      }
      if (endDate && eventDate > endDate) {
        return false;
      }
      if (normalized.referrer && !event.referrer.toLowerCase().includes(normalized.referrer)) {
        return false;
      }
      if (normalized.source && !event.source.toLowerCase().includes(normalized.source)) {
        return false;
      }
      if (normalized.campaign && !event.campaign.toLowerCase().includes(normalized.campaign)) {
        return false;
      }
      if (normalized.country && !event.country.toLowerCase().includes(normalized.country)) {
        return false;
      }
      if (normalized.device && !event.device.toLowerCase().includes(normalized.device)) {
        return false;
      }
      if (normalized.browser && !event.browser.toLowerCase().includes(normalized.browser)) {
        return false;
      }
      if (normalized.os && !event.os.toLowerCase().includes(normalized.os)) {
        return false;
      }
      if (normalized.pagePath && !event.path.toLowerCase().includes(normalized.pagePath)) {
        return false;
      }
      if (normalized.goalName && !event.goal.toLowerCase().includes(normalized.goalName)) {
        return false;
      }
      return true;
    });
  }, [filters]);

  const pageviews = filteredEvents.filter((event) => event.eventType === "pageview");
  const goals = filteredEvents.filter((event) => event.eventType === "goal");
  const pageviewsByDate = pageviews.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.date] = (accumulator[event.date] ?? 0) + 1;
    return accumulator;
  }, {});
  const pageviewsByPath = pageviews.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.path] = (accumulator[event.path] ?? 0) + 1;
    return accumulator;
  }, {});
  const goalCounts = goals.reduce<Record<string, number>>((accumulator, event) => {
    if (!event.goal) {
      return accumulator;
    }
    accumulator[event.goal] = (accumulator[event.goal] ?? 0) + 1;
    return accumulator;
  }, {});
  const totalRevenue = filteredEvents.reduce((sum, event) => sum + event.revenue, 0);
  const revenueBySource = filteredEvents.reduce<Record<string, number>>((accumulator, event) => {
    if (!event.revenue) {
      return accumulator;
    }
    accumulator[event.source] = (accumulator[event.source] ?? 0) + event.revenue;
    return accumulator;
  }, {});
  const topRevenueSources = Object.entries(revenueBySource).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const applyFilter = (key: keyof typeof defaultFilters, value: string) => {
    if (!value.trim()) {
      return;
    }
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyDateFilter = (date: string) => {
    if (!date.trim()) {
      return;
    }
    setFilters((current) => ({ ...current, startDate: date, endDate: date }));
  };

  const clearFilter = (key: keyof typeof defaultFilters) => {
    setFilters((current) => ({ ...current, [key]: "" }));
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKeyFunnels);
      if (stored) {
        const parsed = funnelsSchema.safeParse(JSON.parse(stored));
        if (parsed.success && parsed.data.length > 0) {
          setFunnels(parsed.data);
          setActiveFunnelId(parsed.data[0].id);
          setFunnelDraft(parsed.data[0]);
          return;
        }
      }
    } catch (error) {
      if (!storageErrorRef.current) {
        toast.error("Unable to load saved funnels. Starting fresh.");
        storageErrorRef.current = true;
      }
    }

    const sample = createSampleFunnel();
    setFunnels([sample]);
    setActiveFunnelId(sample.id);
    setFunnelDraft(sample);
  }, []);

  useEffect(() => {
    if (funnels.length === 0) {
      return;
    }
    try {
      localStorage.setItem(storageKeyFunnels, JSON.stringify(funnels));
    } catch (error) {
      if (!storageErrorRef.current) {
        toast.error("Unable to save funnels in this browser.");
        storageErrorRef.current = true;
      }
    }
  }, [funnels]);

  const activeFunnel = useMemo(() => {
    if (!activeFunnelId) {
      return null;
    }
    return funnels.find((funnel) => funnel.id === activeFunnelId) ?? null;
  }, [activeFunnelId, funnels]);

  const createStepCount = (step: FunnelStep) => {
    if (step.type === "page") {
      const condition = step.urlContains.trim().toLowerCase();
      if (!condition) {
        return 0;
      }
      return pageviews.filter((event) => event.path.toLowerCase().includes(condition)).length;
    }
    const goalCondition = step.goalName.trim().toLowerCase();
    if (!goalCondition) {
      return 0;
    }
    return goals.filter((event) => event.goal.toLowerCase().includes(goalCondition)).length;
  };

  const saveFunnelDraft = () => {
    const name = funnelDraft.name.trim();
    if (!name) {
      toast.error("Funnel name is required");
      return;
    }
    if (funnelDraft.steps.length === 0) {
      toast.error("Add at least one step");
      return;
    }

    const updated: Funnel = { ...funnelDraft, name };
    setFunnels((current) => {
      const existingIndex = current.findIndex((funnel) => funnel.id === updated.id);
      if (existingIndex === -1) {
        return [...current, updated];
      }
      return current.map((funnel) => (funnel.id === updated.id ? updated : funnel));
    });
    setActiveFunnelId(updated.id);
    toast.success("Funnel saved");
  };

  const addDraftStep = () => {
    setFunnelDraft((current) => ({
      ...current,
      steps: [...current.steps, { id: createId(), name: "", type: "page", urlContains: "/" }],
    }));
  };

  const removeDraftStep = (stepId: string) => {
    setFunnelDraft((current) => ({ ...current, steps: current.steps.filter((step) => step.id !== stepId) }));
  };

  const moveDraftStep = (index: number, direction: -1 | 1) => {
    setFunnelDraft((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.steps.length) {
        return current;
      }
      const nextSteps = [...current.steps];
      const [moved] = nextSteps.splice(index, 1);
      nextSteps.splice(nextIndex, 0, moved);
      return { ...current, steps: nextSteps };
    });
  };

  const handleCopy = async () => {
    if (!installSnippet) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(installSnippet);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = installSnippet;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setHasCopied(true);
      toast.success("Snippet copied to clipboard");
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy snippet");
    }
  };
  const handleCopyApiKey = async () => {
    if (!apiKey) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(apiKey);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = apiKey;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setHasCopiedKey(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setHasCopiedKey(false), 2000);
    } catch {
      toast.error("Failed to copy API key");
    }
  };

  return (
    <>
      <p>API: {privateData.data?.message}</p>
      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Global filters</CardTitle>
            <CardDescription>Apply filters across charts, tables, funnels, and revenue summaries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="filter-start-date">Start date</Label>
                <Input
                  id="filter-start-date"
                  type="date"
                  value={filters.startDate}
                  onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-end-date">End date</Label>
                <Input
                  id="filter-end-date"
                  type="date"
                  value={filters.endDate}
                  onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-referrer">Referrer</Label>
                <Input
                  id="filter-referrer"
                  placeholder="google.com"
                  value={filters.referrer}
                  onChange={(event) => setFilters((current) => ({ ...current, referrer: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-source">Source</Label>
                <Input
                  id="filter-source"
                  placeholder="newsletter"
                  value={filters.source}
                  onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-campaign">Campaign</Label>
                <Input
                  id="filter-campaign"
                  placeholder="winter-launch"
                  value={filters.campaign}
                  onChange={(event) => setFilters((current) => ({ ...current, campaign: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-country">Country</Label>
                <Input
                  id="filter-country"
                  placeholder="US"
                  value={filters.country}
                  onChange={(event) => setFilters((current) => ({ ...current, country: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-device">Device</Label>
                <Input
                  id="filter-device"
                  placeholder="desktop"
                  value={filters.device}
                  onChange={(event) => setFilters((current) => ({ ...current, device: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-browser">Browser</Label>
                <Input
                  id="filter-browser"
                  placeholder="chrome"
                  value={filters.browser}
                  onChange={(event) => setFilters((current) => ({ ...current, browser: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-os">OS</Label>
                <Input
                  id="filter-os"
                  placeholder="macos"
                  value={filters.os}
                  onChange={(event) => setFilters((current) => ({ ...current, os: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-page">Page path</Label>
                <Input
                  id="filter-page"
                  placeholder="/pricing"
                  value={filters.pagePath}
                  onChange={(event) => setFilters((current) => ({ ...current, pagePath: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter-goal">Goal name</Label>
                <Input
                  id="filter-goal"
                  placeholder="signup"
                  value={filters.goalName}
                  onChange={(event) => setFilters((current) => ({ ...current, goalName: event.target.value }))}
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {activeFilterCount === 0
                ? "No filters applied."
                : `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied.`}
            </div>
            {activeFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {activeFilters.map(({ key, label, value }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => clearFilter(key)}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground"
                    aria-label={`Remove ${label} filter`}
                  >
                    <span className="font-medium text-foreground">{label}:</span>
                    <span>{value}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFilters(defaultFilters)}
              disabled={activeFilterCount === 0}
            >
              Clear filters
            </Button>
            <span className="text-xs text-muted-foreground">{filteredEvents.length} events matched</span>
          </CardFooter>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Create a site</CardTitle>
              <CardDescription>Register your website to generate an install snippet.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  siteForm.handleSubmit();
                }}
                className="space-y-4"
              >
                <siteForm.Field name="name">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Site name</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="Marketing site"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      {field.state.meta.errors.map((error) => (
                        <p key={error?.message} className="text-red-500">
                          {error?.message}
                        </p>
                      ))}
                    </div>
                  )}
                </siteForm.Field>

                <siteForm.Field name="domain">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Root domain</Label>
                      <Input
                        id={field.name}
                        name={field.name}
                        placeholder="example.com"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      {field.state.meta.errors.map((error) => (
                        <p key={error?.message} className="text-red-500">
                          {error?.message}
                        </p>
                      ))}
                    </div>
                  )}
                </siteForm.Field>

                <siteForm.Subscribe>
                  {(state) => (
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!state.canSubmit || state.isSubmitting || createSite.isPending}
                    >
                      {createSite.isPending ? "Creating..." : "Create site"}
                    </Button>
                  )}
                </siteForm.Subscribe>
              </form>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              Enter the root domain only (no https://, paths, or query params).
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Install snippet</CardTitle>
              <CardDescription>Copy and paste this snippet into your site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestSite ? (
                <>
                  <div className="text-xs text-muted-foreground">
                    {latestSite.name} · {latestSite.domain}
                  </div>
                  <textarea
                    className="w-full min-h-[140px] rounded-md border bg-background px-3 py-2 font-mono text-xs"
                    readOnly
                    value={installSnippet}
                  />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Create a site to generate your install snippet.
                </p>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="button" onClick={handleCopy} disabled={!latestSite}>
                {hasCopied ? "Copied!" : "Copy snippet"}
              </Button>
              {sites.isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API key</CardTitle>
              <CardDescription>Use this as a Bearer token for /api/v1 requests.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestSite ? (
                <>
                  <div className="text-xs text-muted-foreground">
                    {latestSite.name} · {latestSite.domain}
                  </div>
                  <Input className="font-mono text-xs" readOnly value={apiKey} aria-label="Site API key" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Create a site to generate an API key.
                </p>
              )}
            </CardContent>
            <CardFooter className="gap-2">
              <Button type="button" onClick={handleCopyApiKey} disabled={!latestSite}>
                {hasCopiedKey ? "Copied!" : "Copy key"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!latestSite) {
                    return;
                  }
                  rotateApiKey.mutate({ siteId: latestSite.id });
                }}
                disabled={!latestSite || rotateApiKey.isPending}
              >
                {rotateApiKey.isPending ? "Rotating..." : "Rotate key"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Charts</CardTitle>
              <CardDescription>Pageviews over time.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.keys(pageviewsByDate).length === 0 ? (
                <p className="text-sm text-muted-foreground">No pageviews in the selected range.</p>
              ) : (
                Object.entries(pageviewsByDate)
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([date, count]) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => applyDateFilter(date)}
                      className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                    >
                      <span>{date}</span>
                      <span className="font-medium">{count}</span>
                    </button>
                  ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tables</CardTitle>
              <CardDescription>Top pages and goals based on current filters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-medium">Top pages</div>
                {Object.keys(pageviewsByPath).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pageviews to summarize.</p>
                ) : (
                  Object.entries(pageviewsByPath)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([path, count]) => (
                      <button
                        key={path}
                        type="button"
                        onClick={() => applyFilter("pagePath", path)}
                        className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                      >
                        <span>{path}</span>
                        <span className="font-medium">{count}</span>
                      </button>
                    ))
                )}
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium">Goal conversions</div>
                {Object.keys(goalCounts).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No goals matched.</p>
                ) : (
                  Object.entries(goalCounts).map(([goal, count]) => (
                    <button
                      key={goal}
                      type="button"
                      onClick={() => applyFilter("goalName", goal)}
                      className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                    >
                      <span>{goal}</span>
                      <span className="font-medium">{count}</span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

           <Card>
             <CardHeader>
               <CardTitle>Funnels</CardTitle>
               <CardDescription>Define funnels with page URL conditions or goal completions.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="space-y-2">
                 <div className="text-xs font-medium">Saved funnels</div>
                 {funnels.length === 0 ? (
                   <p className="text-sm text-muted-foreground">No funnels yet.</p>
                 ) : (
                   <div className="flex flex-wrap gap-2">
                     {funnels.map((funnel) => (
                       <button
                         key={funnel.id}
                         type="button"
                         onClick={() => {
                           setActiveFunnelId(funnel.id);
                           setFunnelDraft(funnel);
                         }}
                         className={`rounded-none border px-2 py-1 text-xs transition ${
                           funnel.id === activeFunnelId
                             ? "border-foreground text-foreground"
                             : "text-muted-foreground hover:text-foreground"
                         }`}
                       >
                         {funnel.name}
                       </button>
                     ))}
                     <Button
                       type="button"
                       size="xs"
                       variant="secondary"
                       onClick={() => {
                         const fresh = createEmptyFunnel();
                         setFunnelDraft(fresh);
                         setActiveFunnelId(null);
                       }}
                     >
                       New funnel
                     </Button>
                   </div>
                 )}
               </div>

               <div className="space-y-2">
                 <Label htmlFor="funnel-name">Funnel name</Label>
                 <Input
                   id="funnel-name"
                   placeholder="Signup funnel"
                   value={funnelDraft.name}
                   onChange={(event) => setFunnelDraft((current) => ({ ...current, name: event.target.value }))}
                 />
               </div>

               <div className="space-y-2">
                 <div className="text-xs font-medium">Steps</div>
                 <div className="space-y-3">
                   {funnelDraft.steps.map((step, index) => (
                     <div key={step.id} className="space-y-2 border p-3">
                       <div className="flex flex-wrap gap-2">
                         <Input
                           placeholder={`Step ${index + 1} name`}
                           value={step.name}
                           onChange={(event) => {
                             const value = event.target.value;
                             setFunnelDraft((current) => ({
                               ...current,
                               steps: current.steps.map((existing) =>
                                 existing.id === step.id ? { ...existing, name: value } : existing,
                               ),
                             }));
                           }}
                         />
                         <select
                           className="border-input h-8 w-full rounded-none border bg-transparent px-2.5 text-xs text-foreground"
                           value={step.type}
                           onChange={(event) => {
                       const nextValue = event.target.value;
                       if (nextValue !== "page" && nextValue !== "goal") {
                         return;
                       }
                       const nextType = nextValue;
                             setFunnelDraft((current) => ({
                               ...current,
                               steps: current.steps.map((existing) => {
                                 if (existing.id !== step.id) {
                                   return existing;
                                 }
                                 if (nextType === "page") {
                                   return {
                                     id: existing.id,
                                     name: existing.name,
                                     type: "page",
                                     urlContains: existing.type === "page" ? existing.urlContains : "/",
                                   };
                                 }
                                 return {
                                   id: existing.id,
                                   name: existing.name,
                                   type: "goal",
                                   goalName: existing.type === "goal" ? existing.goalName : "",
                                 };
                               }),
                             }));
                           }}
                         >
                           <option value="page">Page URL contains</option>
                           <option value="goal">Goal completion</option>
                         </select>
                         {step.type === "page" ? (
                           <Input
                             placeholder="/pricing"
                             value={step.urlContains}
                             onChange={(event) => {
                               const value = event.target.value;
                               setFunnelDraft((current) => ({
                                 ...current,
                                 steps: current.steps.map((existing) =>
                                   existing.id === step.id && existing.type === "page"
                                     ? { ...existing, urlContains: value }
                                     : existing,
                                 ),
                               }));
                             }}
                           />
                         ) : (
                           <Input
                             placeholder="signup"
                             value={step.goalName}
                             onChange={(event) => {
                               const value = event.target.value;
                               setFunnelDraft((current) => ({
                                 ...current,
                                 steps: current.steps.map((existing) =>
                                   existing.id === step.id && existing.type === "goal"
                                     ? { ...existing, goalName: value }
                                     : existing,
                                 ),
                               }));
                             }}
                           />
                         )}
                       </div>
                       <div className="flex flex-wrap gap-2">
                         <Button
                           type="button"
                           size="xs"
                           variant="secondary"
                           disabled={index === 0}
                           onClick={() => moveDraftStep(index, -1)}
                         >
                           Up
                         </Button>
                         <Button
                           type="button"
                           size="xs"
                           variant="secondary"
                           disabled={index === funnelDraft.steps.length - 1}
                           onClick={() => moveDraftStep(index, 1)}
                         >
                           Down
                         </Button>
                         <Button type="button" size="xs" variant="destructive" onClick={() => removeDraftStep(step.id)}>
                           Remove
                         </Button>
                       </div>
                     </div>
                   ))}
                 </div>
                 <Button type="button" variant="secondary" onClick={addDraftStep}>
                   Add step
                 </Button>
               </div>

               <div className="flex flex-wrap items-center gap-2">
                 <Button type="button" onClick={saveFunnelDraft}>
                   Save funnel
                 </Button>
                 <span className="text-xs text-muted-foreground">
                   Saved funnels persist locally in this browser.
                 </span>
               </div>

               {activeFunnel && (
                 <div className="space-y-3">
                   <div className="text-xs font-medium">Preview (filter-aware)</div>
                   {activeFunnel.steps.map((step, index) => {
                     const count = createStepCount(step);
                     const filterKey = step.type === "page" ? ("pagePath" as const) : ("goalName" as const);
                     const filterValue = step.type === "page" ? step.urlContains : step.goalName;
                     return (
                       <button
                         key={step.id}
                         type="button"
                         onClick={() => applyFilter(filterKey, filterValue)}
                         className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                       >
                         <span>
                           {index + 1}. {step.name.trim() || "Untitled step"}
                         </span>
                         <span className="font-medium">{count}</span>
                       </button>
                     );
                   })}
                 </div>
               )}
             </CardContent>
           </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue summary</CardTitle>
              <CardDescription>Revenue totals scoped to the active filters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span>Total revenue</span>
                <span className="font-medium">${totalRevenue.toFixed(2)}</span>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium">Top sources</div>
                {topRevenueSources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attributed revenue yet.</p>
                ) : (
                  topRevenueSources.map(([source, value]) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => applyFilter("source", source)}
                      className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                    >
                      <span>{source}</span>
                      <span className="font-medium">${value.toFixed(2)}</span>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
