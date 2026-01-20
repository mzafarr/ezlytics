import { auth } from "@my-better-t-app/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import InstallScriptStep from "./step-two";

type StepTwoSearchParams = {
  siteId?: string | string[];
};

export default async function InstallScriptPage({
  searchParams,
}: {
  searchParams?: StepTwoSearchParams;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const siteIdParam = searchParams?.siteId;
  const siteId = Array.isArray(siteIdParam) ? siteIdParam[0] : siteIdParam;

  return <InstallScriptStep siteId={siteId} />;
}
