"use client";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { queryClient, trpc } from "@/utils/trpc";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Dashboard({ session }: { session: typeof authClient.$Infer.Session }) {
  const privateData = useQuery(trpc.privateData.queryOptions());
  const sitesQueryOptions = trpc.sites.list.queryOptions();
  const sites = useQuery(sitesQueryOptions);
  const [hasCopied, setHasCopied] = useState(false);

  const createSite = useMutation(
    trpc.sites.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        toast.success("Site created");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const siteForm = useForm({
    defaultValues: {
      name: "",
      domain: "",
    },
    validators: {
      onSubmit: z.object({
        name: z.string().trim().min(1, "Site name is required").max(100, "Max 100 characters"),
        domain: z.string().trim().min(1, "Root domain is required").max(255, "Max 255 characters"),
      }),
    },
    onSubmit: async ({ value }) => {
      await createSite.mutateAsync({
        name: value.name,
        domain: value.domain,
      });
    },
  });

  const latestSite = sites.data?.[0];
  const installSnippet = latestSite
    ? `<script\n  defer\n  data-website-id=\"${latestSite.websiteId}\"\n  data-domain=\"${latestSite.domain}\"\n  src=\"https://your-analytics-domain.com/script.js\"\n></script>`
    : "";

  const handleCopy = async () => {
    if (!installSnippet) {
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(installSnippet);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = installSnippet;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setHasCopied(true);
      toast.success("Snippet copied to clipboard");
      setTimeout(() => setHasCopied(false), 2000);
    } catch {
      toast.error("Failed to copy snippet");
    }
  };

  return (
    <>
      <p>API: {privateData.data?.message}</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create a site</CardTitle>
            <CardDescription>Register your website to generate an install snippet.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                siteForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <siteForm.Field name="name">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Site name</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder="Marketing site"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-red-500">
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </siteForm.Field>

              <siteForm.Field name="domain">
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Root domain</Label>
                    <Input
                      id={field.name}
                      name={field.name}
                      placeholder="example.com"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => field.handleChange(event.target.value)}
                    />
                    {field.state.meta.errors.map((error) => (
                      <p key={error?.message} className="text-red-500">
                        {error?.message}
                      </p>
                    ))}
                  </div>
                )}
              </siteForm.Field>

              <siteForm.Subscribe>
                {(state) => (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!state.canSubmit || state.isSubmitting || createSite.isPending}
                  >
                    {createSite.isPending ? "Creating..." : "Create site"}
                  </Button>
                )}
              </siteForm.Subscribe>
            </form>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Enter the root domain only (no https://, paths, or query params).
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Install snippet</CardTitle>
            <CardDescription>Copy and paste this snippet into your site.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestSite ? (
              <>
                <div className="text-xs text-muted-foreground">
                  {latestSite.name} · {latestSite.domain}
                </div>
                <textarea
                  className="w-full min-h-[140px] rounded-md border bg-background px-3 py-2 font-mono text-xs"
                  readOnly
                  value={installSnippet}
                />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Create a site to generate your install snippet.
              </p>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            <Button type="button" onClick={handleCopy} disabled={!latestSite}>
              {hasCopied ? "Copied!" : "Copy snippet"}
            </Button>
            {sites.isLoading && <span className="text-xs text-muted-foreground">Loading…</span>}
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
