"use client";

import { useMemo } from "react";
import Link from "next/link";
import { type Route } from "next";
import { useQuery } from "@tanstack/react-query";
import { queryClient, trpc } from "@/utils/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RollupTotals = Record<string, number>;

const formatVisitors = (count: number) =>
  `${count.toLocaleString()} visitor${count === 1 ? "" : "s"}`;

export default function Dashboard() {
  const sitesQuery = useQuery(trpc.sites.list.queryOptions());
  const sites = sitesQuery.data ?? [];
  const siteIds = useMemo(() => sites.map((site) => site.id), [sites]);

  const rollupQueries = useQuery({
    queryKey: ["dashboard-rollups", siteIds],
    queryFn: async () => {
      if (siteIds.length === 0) {
        return {};
      }
      const results = await Promise.all(
        siteIds.map((siteId) =>
          queryClient.fetchQuery(trpc.analytics.rollups.queryOptions({ siteId })).then((rollup) => ({
            siteId,
            rollup,
          })),
        ),
      );
      return results.reduce<Record<string, RollupTotals>>((accumulator, entry) => {
        const totals = entry.rollup.daily.reduce(
          (summary, day) => ({
            visitors: summary.visitors + day.visitors,
          }),
          { visitors: 0 },
        );
        accumulator[entry.siteId] = totals;
        return accumulator;
      }, {});
    },
    enabled: siteIds.length > 0,
  });

  const isLoading = sitesQuery.isLoading || rollupQueries.isLoading;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your sites</h1>
          <p className="text-sm text-muted-foreground">
            Pick a site to view analytics and settings.
          </p>
        </div>
        <Link href={"/dashboard/new" as Route} className={cn(buttonVariants({ size: "sm" }))}>
          + Website
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Loading sites...
          </CardContent>
        </Card>
      ) : sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sites yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Create your first website to start tracking analytics.
            </p>
            <Link href={"/dashboard/new" as Route} className={cn(buttonVariants({ size: "sm" }))}>
              Create a site
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => {
            const totals = rollupQueries.data?.[site.id];
            const visitors = totals?.visitors ?? 0;
            return (
              <Card key={site.id}>
                <CardHeader>
                  <CardTitle>{site.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="text-sm text-muted-foreground">{site.domain}</div>
                  <div className="text-base font-medium">{formatVisitors(visitors)}</div>
                  <Link
                    href={`/dashboard/${site.id}` as Route}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    View dashboard
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
