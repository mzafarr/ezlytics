import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import RevenueAttributionForm from "./step-three";

export default async function RevenueAttributionStep() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <RevenueAttributionForm />;
}
