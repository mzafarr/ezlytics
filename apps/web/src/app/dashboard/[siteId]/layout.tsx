import Link from "next/link";
import { type Route } from "next";
import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import SiteSwitcher from "@/components/dashboard/site-switcher";
import { cn } from "@/lib/utils";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
};

export default async function SiteDashboardLayout({
  children,
  params,
}: LayoutProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { siteId } = await params;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">
              Site dashboard
            </h1>
            <p className="text-sm text-muted-foreground">Site ID: {siteId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SiteSwitcher siteId={siteId} />
            <Link
              href={"/dashboard" as Route}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              All sites
            </Link>
          </div>
        </div>
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/dashboard/${siteId}` as Route}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Overview
          </Link>
          <Link
            href={`/dashboard/${siteId}/funnels` as Route}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Funnels
          </Link>
          <Link
            href={`/dashboard/${siteId}/settings` as Route}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Settings
          </Link>
          <Link
            href={"/docs" as Route}
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            Docs
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
