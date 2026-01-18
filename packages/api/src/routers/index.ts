import { randomUUID } from "node:crypto";

import { z } from "zod";

import { db, site } from "@my-better-t-app/db";

import { protectedProcedure, publicProcedure, router } from "../index";

const normalizeDomain = (input: string) => {
  const trimmed = input.trim().toLowerCase();
  const withoutProtocol = trimmed.replace(/^https?:\/\//, "");
  return withoutProtocol.replace(/\/.*$/, "");
};

const siteInputSchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Site name is required")
    .refine((value) => value.length <= 100, "Site name must be 100 characters or less"),
  domain: z
    .string()
    .transform((value) => normalizeDomain(value))
    .refine((value) => value.length > 0, "Root domain is required")
    .refine((value) => value.length <= 255, "Root domain must be 255 characters or less")
    .refine(
      (value) => /^[a-z0-9.-]+$/.test(value),
      "Root domain should only include letters, numbers, dots, or hyphens",
    ),
});

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  sites: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.query.site.findMany({
        columns: {
          id: true,
          name: true,
          domain: true,
          websiteId: true,
          createdAt: true,
        },
        where: (sites, { eq }) => eq(sites.userId, ctx.session.user.id),
        orderBy: (sites, { desc }) => [desc(sites.createdAt)],
      });
    }),
    create: protectedProcedure.input(siteInputSchema).mutation(async ({ input, ctx }) => {
      const websiteId = `web_${randomUUID()}`;
      const id = randomUUID();

      await db.insert(site).values({
        id,
        userId: ctx.session.user.id,
        name: input.name,
        domain: input.domain,
        websiteId,
      });

      return {
        id,
        name: input.name,
        domain: input.domain,
        websiteId,
      };
    }),
  }),
});
export type AppRouter = typeof appRouter;
