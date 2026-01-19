"use client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const funnelSteps = [
    {
      label: "Landing page (/)",
      count: pageviews.filter((event) => event.path === "/").length,
      filter: { key: "pagePath" as const, value: "/" },
    },
    {
      label: "Pricing page (/pricing)",
      count: pageviews.filter((event) => event.path === "/pricing").length,
      filter: { key: "pagePath" as const, value: "/pricing" },
    },
    {
      label: "Goal: signup",
      count: goals.filter((event) => event.goal === "signup").length,
      filter: { key: "goalName" as const, value: "signup" },
    },
  ];
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
              <CardDescription>Filter-aware step counts for a sample funnel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {funnelSteps.map((step) => {
                const content = (
                  <>
                    <span>{step.label}</span>
                    <span className="font-medium">{step.count}</span>
                  </>
                );
                return step.filter ? (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => applyFilter(step.filter.key, step.filter.value)}
                    className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                  >
                    {content}
                  </button>
                ) : (
                  <div key={step.label} className="flex items-center justify-between text-xs">
                    {content}
                  </div>
                );
              })}
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
