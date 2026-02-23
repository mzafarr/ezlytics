import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  analyticsSession,
  and,
  db,
  desc,
  eq,
  gte,
  isNotNull,
  lte,
  rawEvent,
  rollupDaily,
  rollupDimensionDaily,
  site,
  sql,
} from "@my-better-t-app/db";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, publicProcedure, router } from "../index";
import { encryptRevenueKey } from "../revenue-keys";

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
    .refine(
      (value) => value.length <= 100,
      "Site name must be 100 characters or less",
    ),
  domain: z
    .string()
    .transform((value) => normalizeDomain(value))
    .refine((value) => value.length > 0, "Root domain is required")
    .refine(
      (value) => value.length <= 255,
      "Root domain must be 255 characters or less",
    )
    .refine(
      (value) => /^[a-z0-9.-]+$/.test(value),
      "Root domain should only include letters, numbers, dots, or hyphens",
    ),
  timezone: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, "Timezone is required")
    .refine(
      (value) => value.length <= 64,
      "Timezone must be 64 characters or less",
    ),
});

const revenueSettingsSchema = z
  .object({
    siteId: z.string().min(1, "Site id is required"),
    provider: z.enum(["none", "stripe", "lemonsqueezy"]),
    webhookSecret: z.string().trim(),
  })
  .superRefine((value, ctx) => {
    if (value.provider !== "none" && value.webhookSecret.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Webhook secret is required",
        path: ["webhookSecret"],
      });
    }
  });

const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_DIMENSION_LIMIT = 12;
const MAX_DIMENSION_LIMIT = 24;
const DEFAULT_GEO_POINTS_LIMIT = 300;
const MAX_GEO_POINTS_LIMIT = 600;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatUtcDate = (value: Date) => value.toISOString().slice(0, 10);

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getTodayUtcDate = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

const resolveBoundedDateRange = (startDate?: string, endDate?: string) => {
  const today = getTodayUtcDate();
  const resolvedEndDate = endDate ?? formatUtcDate(today);
  if (startDate) {
    return { startDate, endDate: resolvedEndDate };
  }
  const resolvedEnd = new Date(`${resolvedEndDate}T00:00:00.000Z`);
  return {
    startDate: formatUtcDate(
      addUtcDays(resolvedEnd, -(DEFAULT_RANGE_DAYS - 1)),
    ),
    endDate: resolvedEndDate,
  };
};

const toTimestampRange = (startDate: string, endDate: string) => ({
  start: new Date(`${startDate}T00:00:00.000Z`).getTime(),
  end: new Date(`${endDate}T23:59:59.999Z`).getTime(),
});

const roundMs = (value: number) => Math.round(value * 100) / 100;

const measure = async <T>(
  timings: Record<string, number>,
  key: string,
  run: () => Promise<T>,
) => {
  const startedAt = performance.now();
  const result = await run();
  timings[key] = roundMs(performance.now() - startedAt);
  return result;
};

const logPerformance = (
  endpoint: string,
  durationMs: number,
  details: Record<string, unknown>,
  timings: Record<string, number> = {},
) => {
  console.info(
    JSON.stringify({
      scope: "analytics-perf",
      endpoint,
      durationMs: roundMs(durationMs),
      timings,
      ...details,
    }),
  );
};

const rollupsInputSchema = z.object({
  siteId: z.string().min(1, "Site id is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  includeDaily: z.boolean().optional(),
  includeDimensions: z.boolean().optional(),
  includeGeoPoints: z.boolean().optional(),
  includeRangeVisitors: z.boolean().optional(),
  dimensionLimit: z.number().int().min(1).max(MAX_DIMENSION_LIMIT).optional(),
  geoPointLimit: z.number().int().min(1).max(MAX_GEO_POINTS_LIMIT).optional(),
});

const kpiSnapshotInputSchema = z
  .object({
    siteId: z.string().min(1, "Site id is required"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    rangePreset: z.enum(["last24Hours"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.rangePreset && (value.startDate || value.endDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rangePreset"],
        message: "rangePreset cannot be combined with startDate or endDate",
      });
    }
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
          revenueProvider: true,
          revenueProviderKeyUpdatedAt: true,
          createdAt: true,
        },
        where: (sites, { eq }) => eq(sites.userId, ctx.session.user.id),
        orderBy: (sites, { desc }) => [desc(sites.createdAt)],
      });
    }),
    summary: protectedProcedure.query(async ({ ctx }) => {
      const startedAt = performance.now();
      const timings: Record<string, number> = {};

      const rows = await measure(timings, "summaryQueryMs", async () =>
        db
          .select({
            siteId: site.id,
            visitors: sql<number>`coalesce(sum(${rollupDaily.visitors}), 0)`,
          })
          .from(site)
          .leftJoin(rollupDaily, eq(rollupDaily.siteId, site.id))
          .where(eq(site.userId, ctx.session.user.id))
          .groupBy(site.id),
      );

      const totalsBySiteId = rows.reduce<
        Record<string, Record<string, number>>
      >((accumulator, row) => {
        accumulator[row.siteId] = { visitors: Number(row.visitors ?? 0) };
        return accumulator;
      }, {});

      logPerformance(
        "sites.summary",
        performance.now() - startedAt,
        { siteCount: rows.length },
        timings,
      );

      return totalsBySiteId;
    }),
    create: protectedProcedure
      .input(siteInputSchema)
      .mutation(async ({ input, ctx }) => {
        const websiteId = `web_${randomUUID()}`;
        const apiKey = `key_${randomUUID()}`;
        const id = randomUUID();

        await db.insert(site).values({
          id,
          userId: ctx.session.user.id,
          name: input.name,
          domain: input.domain,
          timezone: input.timezone,
          websiteId,
          apiKey,
        });

        return {
          id,
          name: input.name,
          domain: input.domain,
          timezone: input.timezone,
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
          .where(
            and(
              eq(site.id, input.siteId),
              eq(site.userId, ctx.session.user.id),
            ),
          )
          .returning({ id: site.id, apiKey: site.apiKey });

        if (!updated.length) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Site not found",
          });
        }

        return updated[0];
      }),
    updateRevenueProvider: protectedProcedure
      .input(revenueSettingsSchema)
      .mutation(async ({ input, ctx }) => {
        const encryptedSecret =
          input.provider === "none" || input.webhookSecret.length === 0
            ? null
            : encryptRevenueKey(input.webhookSecret);

        const updated = await db
          .update(site)
          .set({
            revenueProvider: input.provider,
            revenueProviderKeyEncrypted: encryptedSecret,
            revenueProviderKeyUpdatedAt:
              input.provider === "none" || !encryptedSecret ? null : new Date(),
          })
          .where(
            and(
              eq(site.id, input.siteId),
              eq(site.userId, ctx.session.user.id),
            ),
          )
          .returning({
            id: site.id,
            revenueProvider: site.revenueProvider,
            revenueProviderKeyUpdatedAt: site.revenueProviderKeyUpdatedAt,
          });

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
    kpiSnapshot: protectedProcedure
      .input(kpiSnapshotInputSchema)
      .query(async ({ ctx, input }) => {
        const startedAt = performance.now();
        const timings: Record<string, number> = {};

        const siteRecord = await measure(timings, "siteLookupMs", async () =>
          db.query.site.findFirst({
            columns: { id: true },
            where: (sites, { eq }) =>
              and(
                eq(sites.id, input.siteId),
                eq(sites.userId, ctx.session.user.id),
              ),
          }),
        );

        if (!siteRecord) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        const nowTimestamp = Date.now();
        const visitorsNowCutoff = nowTimestamp - 1 * 60 * 1000;
        const isRollingLast24Hours = input.rangePreset === "last24Hours";
        const boundedDateRange = resolveBoundedDateRange(
          input.startDate,
          input.endDate,
        );
        const boundedTimestampRange = toTimestampRange(
          boundedDateRange.startDate,
          boundedDateRange.endDate,
        );
        const range = isRollingLast24Hours
          ? {
              start: nowTimestamp - DAY_MS,
              end: nowTimestamp,
            }
          : boundedTimestampRange;
        const startDate = isRollingLast24Hours
          ? formatUtcDate(new Date(range.start))
          : boundedDateRange.startDate;
        const endDate = isRollingLast24Hours
          ? formatUtcDate(new Date(range.end))
          : boundedDateRange.endDate;
        const sessionsPromise = isRollingLast24Hours
          ? measure(timings, "sessionsRangeQueryMs", async () =>
              db
                .select({
                  sessions: sql<number>`count(*)`,
                })
                .from(analyticsSession)
                .where(
                  and(
                    eq(analyticsSession.siteId, siteRecord.id),
                    gte(analyticsSession.firstTimestamp, range.start),
                    lte(analyticsSession.firstTimestamp, range.end),
                  ),
                ),
            )
          : measure(timings, "sessionsRollupQueryMs", async () =>
              db
                .select({
                  sessions: sql<number>`coalesce(sum(${rollupDaily.sessions}), 0)`,
                })
                .from(rollupDaily)
                .where(
                  and(
                    eq(rollupDaily.siteId, siteRecord.id),
                    gte(rollupDaily.date, startDate),
                    lte(rollupDaily.date, endDate),
                  ),
                ),
            );

        const [rangeVisitorsRows, visitorsNowRows, pageviewRows, sessionRows] =
          await Promise.all([
            measure(timings, "rangeVisitorsQueryMs", async () =>
              db
                .select({
                  count: sql<number>`count(distinct ${rawEvent.visitorId})`,
                })
                .from(rawEvent)
                .where(
                  and(
                    eq(rawEvent.siteId, siteRecord.id),
                    eq(rawEvent.type, "pageview"),
                    gte(rawEvent.timestamp, range.start),
                    lte(rawEvent.timestamp, range.end),
                    sql`coalesce(${rawEvent.normalized}->>'bot', 'false') != 'true'`,
                  ),
                ),
            ),
            measure(timings, "visitorsNowQueryMs", async () =>
              db
                .select({
                  count: sql<number>`count(distinct ${rawEvent.visitorId})`,
                })
                .from(rawEvent)
                .where(
                  and(
                    eq(rawEvent.siteId, siteRecord.id),
                    sql`${rawEvent.type} in ('pageview', 'heartbeat')`,
                    gte(rawEvent.timestamp, visitorsNowCutoff),
                    lte(rawEvent.timestamp, nowTimestamp),
                    sql`coalesce(${rawEvent.normalized}->>'bot', 'false') != 'true'`,
                  ),
                ),
            ),
            measure(timings, "pageviewsQueryMs", async () =>
              db
                .select({
                  count: sql<number>`count(*)`,
                })
                .from(rawEvent)
                .where(
                  and(
                    eq(rawEvent.siteId, siteRecord.id),
                    eq(rawEvent.type, "pageview"),
                    gte(rawEvent.timestamp, range.start),
                    lte(rawEvent.timestamp, range.end),
                    sql`coalesce(${rawEvent.normalized}->>'bot', 'false') != 'true'`,
                  ),
                ),
            ),
            sessionsPromise,
          ]);

        const visitors = Number(rangeVisitorsRows[0]?.count ?? 0);
        const visitorsNow = Number(visitorsNowRows[0]?.count ?? 0);
        const pageviews = Number(pageviewRows[0]?.count ?? 0);
        const sessions = Number(sessionRows[0]?.sessions ?? 0);
        const snapshotAt = new Date(nowTimestamp).toISOString();

        logPerformance(
          "analytics.kpiSnapshot",
          performance.now() - startedAt,
          {
            siteId: input.siteId,
            startDate,
            endDate,
            rangePreset: input.rangePreset ?? null,
            rangeStartTimestamp: range.start,
            rangeEndTimestamp: range.end,
            snapshotAt,
            visitors,
            visitorsNow,
            pageviews,
            sessions,
          },
          timings,
        );

        return {
          startDate,
          endDate,
          snapshotAt,
          visitors,
          visitorsNow,
          pageviews,
          sessions,
        };
      }),
    rollups: protectedProcedure
      .input(rollupsInputSchema)
      .query(async ({ ctx, input }) => {
        const startedAt = performance.now();
        const timings: Record<string, number> = {};

        const siteRecord = await measure(timings, "siteLookupMs", async () =>
          db.query.site.findFirst({
            columns: { id: true },
            where: (sites, { eq }) =>
              and(
                eq(sites.id, input.siteId),
                eq(sites.userId, ctx.session.user.id),
              ),
          }),
        );

        if (!siteRecord) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        const includeDaily = input.includeDaily ?? true;
        const includeDimensions = input.includeDimensions ?? true;
        const includeGeoPoints = input.includeGeoPoints ?? true;
        const includeRangeVisitors = input.includeRangeVisitors ?? true;
        const dimensionLimit = input.dimensionLimit ?? DEFAULT_DIMENSION_LIMIT;
        const geoPointLimit = input.geoPointLimit ?? DEFAULT_GEO_POINTS_LIMIT;
        const { startDate, endDate } = resolveBoundedDateRange(
          input.startDate,
          input.endDate,
        );
        const timestampRange = toTimestampRange(startDate, endDate);

        const dailyPromise = includeDaily
          ? measure(timings, "dailyQueryMs", async () =>
              db.query.rollupDaily.findMany({
                where: (rollups, { and, eq, gte, lte }) =>
                  and(
                    eq(rollups.siteId, siteRecord.id),
                    gte(rollups.date, startDate),
                    lte(rollups.date, endDate),
                  ),
              }),
            )
          : Promise.resolve([]);

        const dimensionsPromise = includeDimensions
          ? measure(timings, "dimensionsQueryMs", async () =>
              db
                .select({
                  dimension: rollupDimensionDaily.dimension,
                  dimensionValue: rollupDimensionDaily.dimensionValue,
                  visitors: sql<number>`sum(${rollupDimensionDaily.visitors})`,
                  sessions: sql<number>`sum(${rollupDimensionDaily.sessions})`,
                  goals: sql<number>`sum(${rollupDimensionDaily.goals})`,
                  pageviews: sql<number>`sum(${rollupDimensionDaily.pageviews})`,
                  revenue: sql<number>`sum(${rollupDimensionDaily.revenue})`,
                })
                .from(rollupDimensionDaily)
                .where(
                  and(
                    eq(rollupDimensionDaily.siteId, siteRecord.id),
                    gte(rollupDimensionDaily.date, startDate),
                    lte(rollupDimensionDaily.date, endDate),
                  ),
                )
                .groupBy(
                  rollupDimensionDaily.dimension,
                  rollupDimensionDaily.dimensionValue,
                ),
            )
          : Promise.resolve([]);

        const geoPointsPromise = includeGeoPoints
          ? measure(timings, "geoPointsQueryMs", async () =>
              db.query.rawEvent.findMany({
                columns: {
                  country: true,
                  latitude: true,
                  longitude: true,
                },
                where: (events, { and, eq, gte, lte, isNotNull }) =>
                  and(
                    eq(events.siteId, siteRecord.id),
                    eq(events.type, "pageview"),
                    isNotNull(events.latitude),
                    isNotNull(events.longitude),
                    sql`coalesce(${events.normalized}->>'bot', 'false') != 'true'`,
                    gte(events.timestamp, timestampRange.start),
                    lte(events.timestamp, timestampRange.end),
                  ),
                orderBy: (events, { desc }) => [desc(events.timestamp)],
                limit: geoPointLimit,
              }),
            )
          : Promise.resolve([]);

        const rangeVisitorsPromise = includeRangeVisitors
          ? measure(timings, "rangeVisitorsQueryMs", async () =>
              db
                .select({
                  count: sql<number>`count(distinct ${rawEvent.visitorId})`,
                })
                .from(rawEvent)
                .where(
                  and(
                    eq(rawEvent.siteId, siteRecord.id),
                    eq(rawEvent.type, "pageview"),
                    gte(rawEvent.timestamp, timestampRange.start),
                    lte(rawEvent.timestamp, timestampRange.end),
                    sql`coalesce(${rawEvent.normalized}->>'bot', 'false') != 'true'`,
                  ),
                ),
            )
          : Promise.resolve([{ count: 0 }]);

        const [daily, dimensionRows, geoPoints, rangeVisitorsRows] =
          await Promise.all([
            dailyPromise,
            dimensionsPromise,
            geoPointsPromise,
            rangeVisitorsPromise,
          ]);

        const dimensionsByType = new Map<string, typeof dimensionRows>();
        for (const row of dimensionRows) {
          const existing = dimensionsByType.get(row.dimension) ?? [];
          existing.push(row);
          dimensionsByType.set(row.dimension, existing);
        }
        const dimensions = Array.from(dimensionsByType.values()).flatMap(
          (rows) =>
            rows
              .sort(
                (left, right) =>
                  Number(right.pageviews ?? 0) - Number(left.pageviews ?? 0) ||
                  Number(right.visitors ?? 0) - Number(left.visitors ?? 0),
              )
              .slice(0, dimensionLimit),
        );

        logPerformance(
          "analytics.rollups",
          performance.now() - startedAt,
          {
            siteId: input.siteId,
            startDate,
            endDate,
            includeDaily,
            includeDimensions,
            includeGeoPoints,
            includeRangeVisitors,
            dimensionLimit,
            geoPointLimit,
            dailyRows: daily.length,
            dimensionRows: dimensions.length,
            geoPointsRows: geoPoints.length,
          },
          timings,
        );

        return {
          daily,
          dimensions,
          geoPoints,
          rangeVisitors: Number(rangeVisitorsRows[0]?.count ?? 0),
        };
      }),
    visitorsNow: protectedProcedure
      .input(
        z.object({
          siteId: z.string().min(1, "Site id is required"),
        }),
      )
      .query(async ({ ctx, input }) => {
        const startedAt = performance.now();
        const timings: Record<string, number> = {};

        const siteRecord = await measure(timings, "siteLookupMs", async () =>
          db.query.site.findFirst({
            columns: { id: true },
            where: (sites, { eq }) =>
              and(
                eq(sites.id, input.siteId),
                eq(sites.userId, ctx.session.user.id),
              ),
          }),
        );

        if (!siteRecord) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Site not found" });
        }

        const cutoff = Date.now() - 1 * 60 * 1000;
        const nowTimestamp = Date.now();
        const [result] = await measure(timings, "countQueryMs", async () =>
          db
            .select({
              count: sql<number>`count(distinct ${rawEvent.visitorId})`,
            })
            .from(rawEvent)
            .where(
              and(
                eq(rawEvent.siteId, siteRecord.id),
                sql`${rawEvent.type} in ('pageview', 'heartbeat')`,
                gte(rawEvent.timestamp, cutoff),
                lte(rawEvent.timestamp, nowTimestamp),
                sql`coalesce(${rawEvent.normalized}->>'bot', 'false') != 'true'`,
              ),
            ),
        );

        const count = Number(result?.count ?? 0);
        logPerformance(
          "analytics.visitorsNow",
          performance.now() - startedAt,
          { siteId: input.siteId, count },
          timings,
        );

        return { count };
      }),
  }),
});
export type AppRouter = typeof appRouter;
