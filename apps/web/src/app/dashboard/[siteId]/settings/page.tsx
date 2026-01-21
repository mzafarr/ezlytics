import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Dashboard from "../../dashboard";

type PageProps = {
  params: Promise<{ siteId: string }>;
};

export default async function SiteSettingsPage({ params }: PageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { siteId } = await params;

  return <Dashboard siteId={siteId} view="settings" />;
}
