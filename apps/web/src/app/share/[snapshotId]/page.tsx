import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsSamples } from "@/app/dashboard/analytics-samples";

type SnapshotParams = {
  snapshotId: string;
};

type SnapshotSearchParams = {
  start?: string;
  end?: string;
};

const normalizeDate = (value: Date) => value.toISOString().slice(0, 10);

const parseDate = (value?: string) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildDefaultRange = () => {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 6);
  return { start: normalizeDate(startDate), end: normalizeDate(endDate), label: "Last 7 days" };
};

const buildRangeLabel = (start: string, end: string) => `${start} → ${end}`;

export default function ShareSnapshotPage({
  params,
  searchParams,
}: {
  params: SnapshotParams;
  searchParams: SnapshotSearchParams;
}) {
  const requestedStart = parseDate(searchParams.start);
  const requestedEnd = parseDate(searchParams.end);
  const defaultRange = buildDefaultRange();
  const rangeStart = normalizeDate(requestedStart ?? new Date(defaultRange.start));
  const rangeEnd = normalizeDate(requestedEnd ?? new Date(defaultRange.end));
  const rangeLabel =
    requestedStart || requestedEnd ? buildRangeLabel(rangeStart, rangeEnd) : defaultRange.label;

  const filteredEvents = analyticsSamples.filter((event) => {
    const eventDate = new Date(event.date);
    const startDate = new Date(rangeStart);
    const endDate = new Date(rangeEnd);
    endDate.setHours(23, 59, 59, 999);
    if (eventDate < startDate) {
      return false;
    }
    if (eventDate > endDate) {
      return false;
    }
    return true;
  });

  const revenueEvents = filteredEvents.filter((event) => event.revenue > 0);
  const totalRevenue = revenueEvents.reduce((sum, event) => sum + event.revenue, 0);
  const visitorIds = new Set(filteredEvents.map((event) => event.visitorId));
  const visitorCount = visitorIds.size;
  const revenuePerVisitor = visitorCount === 0 ? 0 : totalRevenue / visitorCount;

  const sourceTotals = filteredEvents.reduce<Record<string, number>>((accumulator, event) => {
    const key = event.source.trim() || "(not set)";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

  const topSources = Object.entries(sourceTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Shareable insight card</div>
        <div className="text-base font-semibold text-foreground">Snapshot {params.snapshotId}</div>
        <div>{rangeLabel}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue per visitor</CardTitle>
            <CardDescription>Attributed revenue across the snapshot range.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">${revenuePerVisitor.toFixed(2)}</div>
            <div className="mt-2 text-xs text-muted-foreground">
              ${totalRevenue.toFixed(2)} total · {visitorCount} visitor{visitorCount === 1 ? "" : "s"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top sources</CardTitle>
            <CardDescription>Revenue leaders for the snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources recorded in this range.</p>
            ) : (
              topSources.map(([source, count]) => (
                <div key={source} className="flex items-center justify-between">
                  <span>{source}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Share details</CardTitle>
          <CardDescription>This snapshot is read-only and safe to share publicly.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>Range: {rangeLabel}</span>
          <span>Sources shown: {topSources.length}</span>
          <Link href="/dashboard">
            <Button size="sm" variant="secondary">
              Back to dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
