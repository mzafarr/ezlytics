"use client";

import Link from "next/link";
import { type Route } from "next";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatVisitors, type RollupTotals } from "../dashboard-helpers";

type SiteSummary = {
  id: string;
  name: string;
  domain: string;
};

type DashboardSitesListProps = {
  sites: SiteSummary[];
  rollupTotals?: Record<string, RollupTotals>;
  isLoading: boolean;
};

export function DashboardSitesList({
  sites,
  rollupTotals,
  isLoading,
}: DashboardSitesListProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your sites</h1>
          <p className="text-sm text-muted-foreground">
            Pick a site to view analytics and settings.
          </p>
        </div>
        <Link
          href={"/dashboard/new" as Route}
          className={cn(buttonVariants({ size: "sm" }))}
        >
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
            <Link
              href={"/dashboard/new" as Route}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Create a site
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sites.map((site) => {
            const totals = rollupTotals?.[site.id];
            const visitors = totals?.visitors ?? 0;
            return (
              <Card key={site.id}>
                <CardHeader>
                  <CardTitle>{site.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="text-sm text-muted-foreground">
                    {site.domain}
                  </div>
                  <div className="text-base font-medium">
                    {formatVisitors(visitors)}
                  </div>
                  <Link
                    href={`/dashboard/${site.id}` as Route}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                    )}
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
