"use client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyticsSamples, type AnalyticsSample } from "./analytics-samples";

const storageKeyFunnels = "datafast.funnels";
const storageKeyExclusions = "datafast.exclusions";
const storageKeyRevenueProvider = "datafast.revenueProvider";
const storageKeyDemoVisitorId = "datafast.demoVisitorId";
const defaultDemoVisitorId = "visitor-1";
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
const exclusionSchema = z.object({
  pathPatterns: z.string(),
  ipAddresses: z.string(),
  countries: z.string(),
  hostnames: z.string(),
  excludeSelf: z.boolean(),
});
const revenueProviderSchema = z.object({
  provider: z.enum(["none", "stripe", "lemonsqueezy"]),
  webhookSecret: z.string(),
});

type Funnel = z.infer<typeof funnelSchema>;
type FunnelStep = z.infer<typeof funnelStepSchema>;

const parseExclusionList = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createWildcardMatcher = (pattern: string) => new RegExp(escapeRegExp(pattern).replace(/\\\*/g, ".*"), "i");

const matchesAny = (value: string, matchers: RegExp[]) => {
  if (!value || matchers.length === 0) {
    return false;
  }
  for (let index = 0; index < matchers.length; index += 1) {
    if (matchers[index]?.test(value)) {
      return true;
    }
  }
  return false;
};

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

type VisitorSummary = {
  visitorId: string;
  firstSeen: string;
  firstSeenAt: number;
  lastSeen: string;
  lastSeenAt: number;
  lastPath: string;
  lastReferrer: string;
  source: string;
  campaign: string;
  country: string;
  device: string;
  browser: string;
  os: string;
  pageviews: number;
  goals: number;
  revenue: number;
};

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

const defaultExclusions = {
  pathPatterns: "",
  ipAddresses: "",
  countries: "",
  hostnames: "",
  excludeSelf: false,
};
const defaultRevenueProvider = {
  provider: "none",
  webhookSecret: "",
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
  const [chartMetric, setChartMetric] = useState<"pageviews" | "visitors" | "revenue">("pageviews");
  const [exclusions, setExclusions] = useState(defaultExclusions);
  const [revenueProviderSettings, setRevenueProviderSettings] = useState(defaultRevenueProvider);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [activeFunnelId, setActiveFunnelId] = useState<string | null>(null);
  const [funnelDraft, setFunnelDraft] = useState<Funnel>(() => createEmptyFunnel());
  const storageErrorRef = useRef(false);
  const exclusionStorageErrorRef = useRef(false);
  const revenueStorageErrorRef = useRef(false);
  const [currentVisitorId, setCurrentVisitorId] = useState(defaultDemoVisitorId);

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
    ? `<script\n  defer\n  data-website-id=\"${latestSite.websiteId}\"\n  data-domain=\"${latestSite.domain}\"\n  src=\"https://your-analytics-domain.com/js/script.js\"\n></script>`
    : "";
  const apiKey = latestSite?.apiKey ?? "";
  const revenueProviderLabel =
    revenueProviderSettings.provider === "stripe"
      ? "Stripe"
      : revenueProviderSettings.provider === "lemonsqueezy"
        ? "LemonSqueezy"
        : "No provider";
  const revenueConnectionReady =
    revenueProviderSettings.provider !== "none" && revenueProviderSettings.webhookSecret.trim().length > 0;
  const revenueStatusLabel =
    revenueProviderSettings.provider === "none"
      ? "Not connected"
      : revenueConnectionReady
        ? `${revenueProviderLabel} connected`
        : `${revenueProviderLabel} disconnected`;
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
    const pathMatchers = parseExclusionList(exclusions.pathPatterns).map(createWildcardMatcher);
    const countryMatchers = parseExclusionList(exclusions.countries).map(createWildcardMatcher);
    const hostnameMatchers = parseExclusionList(exclusions.hostnames).map(createWildcardMatcher);
    const excludedIps = parseExclusionList(exclusions.ipAddresses);
    const excludeSelf = exclusions.excludeSelf && currentVisitorId;
    const startDate = filters.startDate ? new Date(filters.startDate) : null;
    const endDate = filters.endDate ? new Date(filters.endDate) : null;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }

    return analyticsSamples.filter((event) => {
      if (excludeSelf && event.visitorId === currentVisitorId) {
        return false;
      }
      if (pathMatchers.length > 0 && matchesAny(event.path, pathMatchers)) {
        return false;
      }
      if (excludedIps.length > 0 && excludedIps.includes(event.ip)) {
        return false;
      }
      if (countryMatchers.length > 0 && matchesAny(event.country, countryMatchers)) {
        return false;
      }
      if (hostnameMatchers.length > 0 && matchesAny(event.hostname, hostnameMatchers)) {
        return false;
      }
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
  }, [filters, exclusions, currentVisitorId]);

  const pageviews = filteredEvents.filter((event) => event.eventType === "pageview");
  const goals = filteredEvents.filter((event) => event.eventType === "goal");
  const pageviewsByDate = pageviews.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.date] = (accumulator[event.date] ?? 0) + 1;
    return accumulator;
  }, {});
  const visitorSetsByDate = pageviews.reduce<Record<string, Set<string>>>((accumulator, event) => {
    const existing = accumulator[event.date] ?? new Set<string>();
    existing.add(event.visitorId);
    accumulator[event.date] = existing;
    return accumulator;
  }, {});
  const visitorsByDate = Object.entries(visitorSetsByDate).reduce<Record<string, number>>((accumulator, [date, set]) => {
    accumulator[date] = set.size;
    return accumulator;
  }, {});
  const pageviewsByPath = pageviews.reduce<Record<string, number>>((accumulator, event) => {
    accumulator[event.path] = (accumulator[event.path] ?? 0) + 1;
    return accumulator;
  }, {});
  const visitorsById = filteredEvents.reduce<Record<string, VisitorSummary>>((accumulator, event) => {
    const eventDate = new Date(event.date);
    const eventTimestamp = eventDate.getTime();
    const existing = accumulator[event.visitorId];
    if (!existing) {
      accumulator[event.visitorId] = {
        visitorId: event.visitorId,
        firstSeen: event.date,
        firstSeenAt: eventTimestamp,
        lastSeen: event.date,
        lastSeenAt: eventTimestamp,
        lastPath: event.path,
        lastReferrer: event.referrer,
        source: event.source,
        campaign: event.campaign,
        country: event.country,
        device: event.device,
        browser: event.browser,
        os: event.os,
        pageviews: event.eventType === "pageview" ? 1 : 0,
        goals: event.eventType === "goal" ? 1 : 0,
        revenue: event.revenue,
      };
      return accumulator;
    }
    if (eventTimestamp < existing.firstSeenAt) {
      existing.firstSeenAt = eventTimestamp;
      existing.firstSeen = event.date;
    }
    if (eventTimestamp > existing.lastSeenAt) {
      existing.lastSeenAt = eventTimestamp;
      existing.lastSeen = event.date;
      existing.lastPath = event.path;
      existing.lastReferrer = event.referrer;
      existing.source = event.source;
      existing.campaign = event.campaign;
      existing.country = event.country;
      existing.device = event.device;
      existing.browser = event.browser;
      existing.os = event.os;
    }
    if (event.eventType === "pageview") {
      existing.pageviews += 1;
    }
    if (event.eventType === "goal") {
      existing.goals += 1;
    }
    if (event.revenue) {
      existing.revenue += event.revenue;
    }
    return accumulator;
  }, {});
  const visitorsList = Object.values(visitorsById).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  const visitorCountLabel = `${visitorsList.length} visitor${visitorsList.length === 1 ? "" : "s"}`;
  const sessionKeys = pageviews.reduce((accumulator, event) => {
    accumulator.add(`${event.visitorId}-${event.date}`);
    return accumulator;
  }, new Set<string>());
  const sessionCount = sessionKeys.size;
  const conversionCount = goals.filter((event) => event.goal).length;
  const conversionRate = sessionCount === 0 ? 0 : (conversionCount / sessionCount) * 100;
  const goalCounts = goals.reduce<Record<string, number>>((accumulator, event) => {
    if (!event.goal) {
      return accumulator;
    }
    accumulator[event.goal] = (accumulator[event.goal] ?? 0) + 1;
    return accumulator;
  }, {});
  const totalRevenue = filteredEvents.reduce((sum, event) => sum + event.revenue, 0);
  const revenuePerVisitor = visitorsList.length === 0 ? 0 : totalRevenue / visitorsList.length;
  const revenueByDate = filteredEvents.reduce<Record<string, number>>((accumulator, event) => {
    if (!event.revenue) {
      return accumulator;
    }
    accumulator[event.date] = (accumulator[event.date] ?? 0) + event.revenue;
    return accumulator;
  }, {});
  const revenueBySource = filteredEvents.reduce<Record<string, number>>((accumulator, event) => {
    if (!event.revenue) {
      return accumulator;
    }
    accumulator[event.source] = (accumulator[event.source] ?? 0) + event.revenue;
    return accumulator;
  }, {});
  const topRevenueSources = Object.entries(revenueBySource).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const chartSeries =
    chartMetric === "pageviews" ? pageviewsByDate : chartMetric === "visitors" ? visitorsByDate : revenueByDate;

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
    try {
      const stored = localStorage.getItem(storageKeyExclusions);
      if (stored) {
        const parsed = exclusionSchema.safeParse(JSON.parse(stored));
        if (parsed.success) {
          setExclusions(parsed.data);
        }
      }
    } catch (error) {
      if (!exclusionStorageErrorRef.current) {
        toast.error("Unable to load exclusion settings.");
        exclusionStorageErrorRef.current = true;
      }
    }

    try {
      const storedVisitor = localStorage.getItem(storageKeyDemoVisitorId);
      if (storedVisitor) {
        setCurrentVisitorId(storedVisitor);
        return;
      }
      localStorage.setItem(storageKeyDemoVisitorId, defaultDemoVisitorId);
      setCurrentVisitorId(defaultDemoVisitorId);
    } catch (error) {
      if (!exclusionStorageErrorRef.current) {
        toast.error("Unable to persist browser exclusion settings.");
        exclusionStorageErrorRef.current = true;
      }
      setCurrentVisitorId(defaultDemoVisitorId);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKeyRevenueProvider);
      if (stored) {
        const parsed = revenueProviderSchema.safeParse(JSON.parse(stored));
        if (parsed.success) {
          setRevenueProviderSettings(parsed.data);
        }
      }
    } catch (error) {
      if (!revenueStorageErrorRef.current) {
        toast.error("Unable to load revenue provider settings.");
        revenueStorageErrorRef.current = true;
      }
    }
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

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyExclusions, JSON.stringify(exclusions));
    } catch (error) {
      if (!exclusionStorageErrorRef.current) {
        toast.error("Unable to save exclusion settings.");
        exclusionStorageErrorRef.current = true;
      }
    }
  }, [exclusions]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKeyRevenueProvider, JSON.stringify(revenueProviderSettings));
    } catch (error) {
      if (!revenueStorageErrorRef.current) {
        toast.error("Unable to save revenue provider settings.");
        revenueStorageErrorRef.current = true;
      }
    }
  }, [revenueProviderSettings]);

  const activeFunnel = useMemo(() => {
    if (!activeFunnelId) {
      return null;
    }
    return funnels.find((funnel) => funnel.id === activeFunnelId) ?? null;
  }, [activeFunnelId, funnels]);

  const formatRate = (value: number) => `${value.toFixed(1)}%`;

  const createStepMatcher = (step: FunnelStep) => {
    if (step.type === "page") {
      const condition = step.urlContains.trim().toLowerCase();
      if (!condition) {
        return null;
      }
      return (event: AnalyticsSample) => event.path.toLowerCase().includes(condition);
    }
    const goalCondition = step.goalName.trim().toLowerCase();
    if (!goalCondition) {
      return null;
    }
    return (event: AnalyticsSample) => event.goal.toLowerCase().includes(goalCondition);
  };

  const createStepCount = (step: FunnelStep) => {
    const matcher = createStepMatcher(step);
    if (!matcher) {
      return 0;
    }
    if (step.type === "page") {
      return pageviews.filter((event) => matcher(event)).length;
    }
    return goals.filter((event) => matcher(event)).length;
  };

  const getStepEvents = (step: FunnelStep) => {
    const matcher = createStepMatcher(step);
    if (!matcher) {
      return [] as AnalyticsSample[];
    }
    if (step.type === "page") {
      return pageviews.filter((event) => matcher(event));
    }
    return goals.filter((event) => matcher(event));
  };

  const getFunnelMetrics = (funnel: Funnel) => {
    const stepCounts = funnel.steps.map((step) => createStepCount(step));
    const steps = stepCounts.map((count, index) => {
      const previous = index === 0 ? count : stepCounts[index - 1] ?? 0;
      const dropOff = index === 0 ? 0 : Math.max(previous - count, 0);
      const conversionRate = index === 0 ? 100 : previous === 0 ? 0 : (count / previous) * 100;
      const dropOffRate = index === 0 ? 0 : previous === 0 ? 0 : (dropOff / previous) * 100;
      return {
        index,
        count,
        conversionRate,
        dropOff,
        dropOffRate,
      };
    });
    const entrants = stepCounts[0] ?? 0;
    const completions = stepCounts[stepCounts.length - 1] ?? 0;
    const overallConversion = entrants === 0 ? 0 : (completions / entrants) * 100;
    return { steps, entrants, completions, overallConversion };
  };

  const getBreakdownForFunnel = (funnel: Funnel, dimension: "source" | "country") => {
    if (funnel.steps.length === 0) {
      return [];
    }
    const entrants = getStepEvents(funnel.steps[0]);
    const completions = getStepEvents(funnel.steps[funnel.steps.length - 1]);
    if (entrants.length === 0) {
      return [];
    }
    const completionsByDimension = completions.reduce<Record<string, number>>((accumulator, event) => {
      const key = event[dimension] || "unknown";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});
    const entrantsByDimension = entrants.reduce<Record<string, number>>((accumulator, event) => {
      const key = event[dimension] || "unknown";
      accumulator[key] = (accumulator[key] ?? 0) + 1;
      return accumulator;
    }, {});
    return Object.entries(completionsByDimension)
      .map(([key, value]) => ({
        key,
        completions: value,
        entrants: entrantsByDimension[key] ?? 0,
      }))
      .map((entry) => ({
        ...entry,
        conversionRate: entry.entrants === 0 ? 0 : (entry.completions / entry.entrants) * 100,
      }))
      .sort((a, b) => b.completions - a.completions)
      .slice(0, 5);
  };

  const activeFunnelMetrics = useMemo(() => {
    if (!activeFunnel) {
      return null;
    }
    return getFunnelMetrics(activeFunnel);
  }, [activeFunnel, filteredEvents]);

  const activeFunnelSourceBreakdown = useMemo(() => {
    if (!activeFunnel) {
      return [];
    }
    return getBreakdownForFunnel(activeFunnel, "source");
  }, [activeFunnel, filteredEvents]);

  const activeFunnelCountryBreakdown = useMemo(() => {
    if (!activeFunnel) {
      return [];
    }
    return getBreakdownForFunnel(activeFunnel, "country");
  }, [activeFunnel, filteredEvents]);

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

          <Card>
            <CardHeader>
              <CardTitle>Exclusions</CardTitle>
              <CardDescription>Exclude paths, IPs, countries, hostnames, and your own visits.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exclude-paths">Path patterns</Label>
                <textarea
                  id="exclude-paths"
                  className="min-h-[96px] w-full rounded-none border bg-background px-3 py-2 text-xs"
                  placeholder="/admin*, /internal"
                  value={exclusions.pathPatterns}
                  onChange={(event) =>
                    setExclusions((current) => ({ ...current, pathPatterns: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">One per line or comma-separated, supports * wildcard.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="exclude-ips">IP addresses</Label>
                <Input
                  id="exclude-ips"
                  placeholder="203.0.113.11, 198.51.100.24"
                  value={exclusions.ipAddresses}
                  onChange={(event) =>
                    setExclusions((current) => ({ ...current, ipAddresses: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exclude-countries">Countries</Label>
                <Input
                  id="exclude-countries"
                  placeholder="US, GB, DE"
                  value={exclusions.countries}
                  onChange={(event) =>
                    setExclusions((current) => ({ ...current, countries: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="exclude-hostnames">Hostnames</Label>
                <Input
                  id="exclude-hostnames"
                  placeholder="app.ralph.dev, *.ralph.dev"
                  value={exclusions.hostnames}
                  onChange={(event) =>
                    setExclusions((current) => ({ ...current, hostnames: event.target.value }))
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="exclude-self"
                  checked={exclusions.excludeSelf}
                  onCheckedChange={(checked) =>
                    setExclusions((current) => ({ ...current, excludeSelf: Boolean(checked) }))
                  }
                />
                <Label htmlFor="exclude-self">Exclude this browser</Label>
              </div>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              Exclusions are saved locally and apply to all dashboard views.
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Revenue providers</CardTitle>
              <CardDescription>Connect Stripe or LemonSqueezy to attribute revenue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-none border px-3 py-2 text-xs">
                <div>
                  <div className="text-xs font-medium">Connection status</div>
                  <div className="text-muted-foreground">{revenueStatusLabel}</div>
                </div>
                <div
                  className={`h-2.5 w-2.5 rounded-full ${
                    revenueConnectionReady ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  aria-label={revenueConnectionReady ? "Revenue provider connected" : "Revenue provider disconnected"}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue-provider">Provider</Label>
                <select
                  id="revenue-provider"
                  className="border-input h-8 w-full rounded-none border bg-transparent px-2.5 text-xs text-foreground"
                  value={revenueProviderSettings.provider}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    if (nextValue !== "none" && nextValue !== "stripe" && nextValue !== "lemonsqueezy") {
                      return;
                    }
                    setRevenueProviderSettings((current) => ({ ...current, provider: nextValue }));
                  }}
                >
                  <option value="none">Not connected</option>
                  <option value="stripe">Stripe</option>
                  <option value="lemonsqueezy">LemonSqueezy</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenue-webhook-secret">Webhook signing secret</Label>
                <Input
                  id="revenue-webhook-secret"
                  type="password"
                  placeholder="whsec_..."
                  value={revenueProviderSettings.webhookSecret}
                  onChange={(event) =>
                    setRevenueProviderSettings((current) => ({ ...current, webhookSecret: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Used to verify incoming webhooks. Secrets are stored locally in this browser.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (revenueProviderSettings.provider === "none") {
                      toast.error("Select a revenue provider first.");
                      return;
                    }
                    if (!revenueProviderSettings.webhookSecret.trim()) {
                      toast.error("Enter a webhook signing secret to connect.");
                      return;
                    }
                    toast.success(`${revenueProviderLabel} connected`);
                  }}
                >
                  Save connection
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setRevenueProviderSettings(defaultRevenueProvider);
                    toast.success("Revenue provider disconnected");
                  }}
                >
                  Disconnect
                </Button>
              </div>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              Connection details are stored locally and will be synced once server settings are available.
            </CardFooter>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Overview KPIs</CardTitle>
              <CardDescription>Headline metrics scoped to the active filters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Visitors</div>
                  <div className="text-lg font-semibold">{visitorsList.length}</div>
                </div>
                <div className="rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Sessions</div>
                  <div className="text-lg font-semibold">{sessionCount}</div>
                </div>
                <div className="rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Pageviews</div>
                  <div className="text-lg font-semibold">{pageviews.length}</div>
                </div>
                <div className="rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Conversions</div>
                  <div className="text-lg font-semibold">{conversionCount}</div>
                </div>
                <div className="rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Conversion rate</div>
                  <div className="text-lg font-semibold">{formatRate(conversionRate)}</div>
                </div>
                <div className="rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Revenue</div>
                  <div className="text-lg font-semibold">${totalRevenue.toFixed(2)}</div>
                </div>
                <div className="rounded-md border px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Revenue per visitor</div>
                  <div className="text-lg font-semibold">${revenuePerVisitor.toFixed(2)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time series</CardTitle>
              <CardDescription>Toggle between pageviews, visitors, and revenue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                {(["pageviews", "visitors", "revenue"] as const).map((metric) => (
                  <Button
                    key={metric}
                    type="button"
                    size="xs"
                    variant={chartMetric === metric ? "default" : "secondary"}
                    onClick={() => setChartMetric(metric)}
                  >
                    {metric === "pageviews" ? "Pageviews" : metric === "visitors" ? "Visitors" : "Revenue"}
                  </Button>
                ))}
              </div>
              {Object.keys(chartSeries).length === 0 ? (
                <p className="text-sm text-muted-foreground">No data available for the selected range.</p>
              ) : (
                Object.entries(chartSeries)
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([date, count]) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() => applyDateFilter(date)}
                      className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                    >
                      <span>{date}</span>
                      <span className="font-medium">
                        {chartMetric === "revenue" ? `$${count.toFixed(2)}` : count}
                      </span>
                    </button>
                  ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visitors</CardTitle>
              <CardDescription>Recent visitors based on the active filters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{visitorCountLabel}</span>
                <span>Sorted by most recent</span>
              </div>
              {visitorsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No visitors match the current filters.</p>
              ) : (
                <div className="space-y-2">
                  {visitorsList.map((visitor) => (
                    <Link
                      key={visitor.visitorId}
                      href={{ pathname: "/dashboard/visitors/[visitorId]", query: { visitorId: visitor.visitorId } }}
                      className="block rounded-none border px-3 py-2 text-xs transition hover:border-foreground"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="text-xs font-medium">{visitor.visitorId}</div>
                          <div className="text-xs text-muted-foreground">
                            {visitor.country} · {visitor.device} · {visitor.browser}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>Last seen {visitor.lastSeen}</div>
                          <div>{visitor.lastPath}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        <span>
                          Referrer: <span className="text-foreground">{visitor.lastReferrer || "direct"}</span>
                        </span>
                        <span>
                          Source: <span className="text-foreground">{visitor.source || "unknown"}</span>
                        </span>
                        <span>
                          Campaign: <span className="text-foreground">{visitor.campaign || "none"}</span>
                        </span>
                        <span>
                          Pageviews: <span className="text-foreground">{visitor.pageviews}</span>
                        </span>
                        <span>
                          Goals: <span className="text-foreground">{visitor.goals}</span>
                        </span>
                        <span>
                          Revenue: <span className="text-foreground">${visitor.revenue.toFixed(2)}</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              Click a visitor to view the detailed profile.
            </CardFooter>
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

                {activeFunnel && activeFunnelMetrics && (
                  <div className="space-y-3">
                    <div className="text-xs font-medium">Funnel analytics</div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border px-3 py-2 text-xs">
                        <div className="text-muted-foreground">Entrants</div>
                        <div className="font-medium">{activeFunnelMetrics.entrants}</div>
                      </div>
                      <div className="rounded-md border px-3 py-2 text-xs">
                        <div className="text-muted-foreground">Completions</div>
                        <div className="font-medium">{activeFunnelMetrics.completions}</div>
                      </div>
                      <div className="rounded-md border px-3 py-2 text-xs">
                        <div className="text-muted-foreground">Overall conversion</div>
                        <div className="font-medium">{formatRate(activeFunnelMetrics.overallConversion)}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {activeFunnelMetrics.steps.map((stepMetric) => {
                        const step = activeFunnel.steps[stepMetric.index];
                        const filterKey = step.type === "page" ? ("pagePath" as const) : ("goalName" as const);
                        const filterValue = step.type === "page" ? step.urlContains : step.goalName;
                        return (
                          <button
                            key={step.id}
                            type="button"
                            onClick={() => applyFilter(filterKey, filterValue)}
                            className="flex w-full items-center justify-between gap-2 text-left text-xs transition hover:text-foreground"
                          >
                            <span className="min-w-0">
                              {stepMetric.index + 1}. {step.name.trim() || "Untitled step"}
                            </span>
                            <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <span>
                                {stepMetric.count} {stepMetric.count === 1 ? "completion" : "completions"}
                              </span>
                              <span>{formatRate(stepMetric.conversionRate)} conv</span>
                              {stepMetric.index > 0 && (
                                <span>
                                  {stepMetric.dropOff} drop · {formatRate(stepMetric.dropOffRate)}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="text-xs font-medium">Top sources</div>
                        {activeFunnelSourceBreakdown.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No funnel conversions yet.</p>
                        ) : (
                          activeFunnelSourceBreakdown.map((entry) => (
                            <button
                              key={entry.key}
                              type="button"
                              onClick={() => applyFilter("source", entry.key)}
                              className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                            >
                              <span>{entry.key}</span>
                              <span className="font-medium">{formatRate(entry.conversionRate)}</span>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs font-medium">Top countries</div>
                        {activeFunnelCountryBreakdown.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No funnel conversions yet.</p>
                        ) : (
                          activeFunnelCountryBreakdown.map((entry) => (
                            <button
                              key={entry.key}
                              type="button"
                              onClick={() => applyFilter("country", entry.key)}
                              className="flex w-full items-center justify-between text-left text-xs transition hover:text-foreground"
                            >
                              <span>{entry.key}</span>
                              <span className="font-medium">{formatRate(entry.conversionRate)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
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
