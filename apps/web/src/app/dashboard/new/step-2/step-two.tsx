"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Route } from "next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";

type InstallScriptStepProps = {
  siteId?: string;
};

const buildSnippet = (site: { websiteId: string; domain: string; apiKey: string }) =>
  `<script\n  defer\n  data-website-id="${site.websiteId}"\n  data-domain="${site.domain}"\n  data-api-key="${site.apiKey}"\n  src="https://your-analytics-domain.com/js/script.js"\n></script>`;

export default function InstallScriptStep({ siteId }: InstallScriptStepProps) {
  const router = useRouter();
  const sitesQuery = useQuery(trpc.sites.list.queryOptions());
  const sites = sitesQuery.data ?? [];
  const selectedSite = siteId ? sites.find((site) => site.id === siteId) : sites[0];

  const installSnippet = selectedSite ? buildSnippet(selectedSite) : "";

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Install tracking</CardTitle>
          <CardDescription>Step 2 of 3 · Add the script to your site.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {sitesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading site details...</p>
          ) : selectedSite ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add this snippet to the <span className="font-medium text-foreground">head</span> of{" "}
                <span className="font-medium text-foreground">{selectedSite.domain}</span>.
              </p>
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
                  Copy snippet
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              We could not find a site for this step. Create a site first to get your snippet.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <Link href={"/dashboard/new" as Route} className="text-sm text-muted-foreground">
            Back to site details
          </Link>
          <div className="flex items-center gap-2">
            <Link href={"/dashboard" as Route}>
              <Button variant="outline">Return to dashboard</Button>
            </Link>
            <Button
              onClick={() => {
                router.push("/dashboard/new/step-3" as Route);
              }}
              disabled={!selectedSite}
            >
              I&apos;ve installed the script
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
