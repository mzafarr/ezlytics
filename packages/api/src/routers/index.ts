import { randomUUID } from "node:crypto";

import { z } from "zod";

import { and, db, eq, gte, lte, site } from "@my-better-t-app/db";
import { TRPCError } from "@trpc/server";

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
          apiKey: true,
          createdAt: true,
        },
        where: (sites, { eq }) => eq(sites.userId, ctx.session.user.id),
        orderBy: (sites, { desc }) => [desc(sites.createdAt)],
      });
    }),
    create: protectedProcedure.input(siteInputSchema).mutation(async ({ input, ctx }) => {
      const websiteId = `web_${randomUUID()}`;
      const apiKey = `key_${randomUUID()}`;
      const id = randomUUID();

      await db.insert(site).values({
        id,
        userId: ctx.session.user.id,
        name: input.name,
        domain: input.domain,
        websiteId,
        apiKey,
      });

      return {
        id,
        name: input.name,
        domain: input.domain,
        websiteId,
        apiKey,
      };
    }),
    rotateApiKey: protectedProcedure
      .input(
        z.object({
          siteId: z.string().min(1, "Site id is required"),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const apiKey = `key_${randomUUID()}`;

        const updated = await db
          .update(site)
          .set({ apiKey })
          .where(and(eq(site.id, input.siteId), eq(site.userId, ctx.session.user.id)))
          .returning({ id: site.id, apiKey: site.apiKey });

        if (!updated.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Site not found",
          });
        }

        return updated[0];
      }),
  }),
  analytics: router({
    rollups: protectedProcedure
      .input(
        z.object({
          siteId: z.string().min(1, "Site id is required"),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const siteRecord = await db.query.site.findFirst({
          columns: { id: true },
          where: (sites, { eq }) => and(eq(sites.id, input.siteId), eq(sites.userId, ctx.session.user.id)),
        });

        if (!siteRecord) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        const startDate = input.startDate ? input.startDate : null;
        const endDate = input.endDate ? input.endDate : null;

        const daily = await db.query.rollupDaily.findMany({
          where: (rollups, { and, eq, gte, lte }) => {
            const clauses = [eq(rollups.siteId, siteRecord.id)];
            if (startDate) {
              clauses.push(gte(rollups.date, startDate));
            }
            if (endDate) {
              clauses.push(lte(rollups.date, endDate));
            }
            return and(...clauses);
          },
        });

        const dimensions = await db.query.rollupDimensionDaily.findMany({
          where: (rollups, { and, eq, gte, lte }) => {
            const clauses = [eq(rollups.siteId, siteRecord.id)];
            if (startDate) {
              clauses.push(gte(rollups.date, startDate));
            }
            if (endDate) {
              clauses.push(lte(rollups.date, endDate));
            }
            return and(...clauses);
          },
        });

        return {
          daily,
          dimensions,
        };
      }),
  }),
});
export type AppRouter = typeof appRouter;
