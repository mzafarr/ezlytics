"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type Route } from "next";
import { useMemo } from "react";
import { toast } from "sonner";
import z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, trpc } from "@/utils/trpc";

const timeZones = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

const domainSchema = z
  .string()
  .trim()
  .min(1, "Domain is required")
  .max(255, "Domain must be 255 characters or less")
  .regex(/^[a-z0-9.-]+$/i, "Domain should only include letters, numbers, dots, or hyphens");

export default function NewSiteStepOne() {
  const router = useRouter();
  const sitesQueryOptions = trpc.sites.list.queryOptions();

  const timezoneOptions = useMemo(() => timeZones, []);

  const createSite = useMutation(
    trpc.sites.create.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: sitesQueryOptions.queryKey });
        toast.success("Site created");
        router.push(`/dashboard/new/step-2?siteId=${data.id}` as Route);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

  const form = useForm({
    defaultValues: {
      domain: "",
      timezone: timeZones[0],
    },
    validators: {
      onSubmit: z.object({
        domain: domainSchema,
        timezone: z
          .string()
          .trim()
          .min(1, "Timezone is required")
          .max(64, "Timezone must be 64 characters or less"),
      }),
    },
    onSubmit: async ({ value }) => {
      await createSite.mutateAsync({
        name: value.domain,
        domain: value.domain,
        timezone: value.timezone,
      });
    },
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create your first site</CardTitle>
          <CardDescription>Add your domain and choose a reporting timezone.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <form.Field name="domain">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="site-domain">Domain</Label>
                  <Input
                    id="site-domain"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder="example.com"
                  />
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
            <form.Field name="timezone">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor="site-timezone">Timezone</Label>
                  <select
                    id="site-timezone"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    {timezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                  {field.state.meta.errors.map((error) => (
                    <p key={error?.message} className="text-sm text-destructive">
                      {error?.message}
                    </p>
                  ))}
                </div>
              )}
            </form.Field>
            <Button type="submit" disabled={createSite.isPending}>
              {createSite.isPending ? "Creating..." : "Create site"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
