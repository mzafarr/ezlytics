"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type Route } from "next";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/utils/trpc";

type SiteSwitcherProps = {
  siteId: string;
};

export default function SiteSwitcher({ siteId }: SiteSwitcherProps) {
  const router = useRouter();
  const sitesQuery = useQuery(trpc.sites.list.queryOptions());
  const sites = sitesQuery.data ?? [];
  const activeSite = sites.find((site) => site.id === siteId);

  if (sitesQuery.isLoading) {
    return <Skeleton className="h-9 w-40" />;
  }

  if (sites.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="min-w-40 justify-between"
          />
        }
      >
        {activeSite?.name ?? "Select site"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card">
        {sites.map((site) => (
          <DropdownMenuItem
            key={site.id}
            onClick={() => {
              router.push(`/dashboard/${site.id}` as Route);
            }}
          >
            {site.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
