import { auth } from "@my-better-t-app/auth";
import { db } from "@my-better-t-app/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const siteRecord = await db.query.site.findFirst({
    columns: { id: true },
    where: (sites, { eq }) => eq(sites.userId, session.user.id),
  });

  if (!siteRecord) {
    redirect("/dashboard/new");
  }

  return <Dashboard />;
}
