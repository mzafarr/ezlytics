import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Dashboard from "../dashboard";

type PageProps = {
  params: { siteId: string };
};

export default async function SiteDashboardPage({ params }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <Dashboard siteId={params.siteId} />;
}
