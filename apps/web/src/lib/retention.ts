import {
  db,
  analyticsSession,
  rawEvent,
  rollupDaily,
  rollupDimensionDaily,
  rollupDimensionHourly,
  rollupHourly,
  sql,
  visitorDaily,
} from "@my-better-t-app/db";
import { env } from "@my-better-t-app/env/server";

const DEFAULT_RAW_EVENT_RETENTION_DAYS = 90;
const DEFAULT_ROLLUP_DAILY_RETENTION_DAYS = 1095;
const DEFAULT_ROLLUP_HOURLY_RETENTION_DAYS = 30;
const DEFAULT_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const RAW_EVENT_RETENTION_DAYS = env.RAW_EVENT_RETENTION_DAYS ?? DEFAULT_RAW_EVENT_RETENTION_DAYS;
const ROLLUP_DAILY_RETENTION_DAYS =
  env.ROLLUP_DAILY_RETENTION_DAYS ?? DEFAULT_ROLLUP_DAILY_RETENTION_DAYS;
const ROLLUP_HOURLY_RETENTION_DAYS =
  env.ROLLUP_HOURLY_RETENTION_DAYS ?? DEFAULT_ROLLUP_HOURLY_RETENTION_DAYS;
const CLEANUP_INTERVAL_MS =
  env.RETENTION_CLEANUP_INTERVAL_MINUTES != null
    ? env.RETENTION_CLEANUP_INTERVAL_MINUTES * 60 * 1000
    : DEFAULT_CLEANUP_INTERVAL_MS;

const getRetentionStore = () => {
  const scope = globalThis as typeof globalThis & { __retentionCleanupAt?: number };
  if (!scope.__retentionCleanupAt) {
    scope.__retentionCleanupAt = 0;
  }
  return scope;
};

const daysAgo = (days: number) => {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const runRetentionCleanup = async () => {
  const store = getRetentionStore();
  const now = Date.now();
  if (now - store.__retentionCleanupAt! < CLEANUP_INTERVAL_MS) {
    return;
  }
  store.__retentionCleanupAt = now;

  const rawEventCutoff = daysAgo(RAW_EVENT_RETENTION_DAYS);
  const rollupDailyCutoff = daysAgo(ROLLUP_DAILY_RETENTION_DAYS);
  const rollupHourlyCutoff = daysAgo(ROLLUP_HOURLY_RETENTION_DAYS);
  const sessionCutoffTimestamp = rawEventCutoff.getTime();

  await db.delete(rawEvent).where(sql`${rawEvent.createdAt} < ${rawEventCutoff}`);
  await db
    .delete(analyticsSession)
    .where(sql`${analyticsSession.lastTimestamp} < ${sessionCutoffTimestamp}`);
  await db.delete(visitorDaily).where(sql`${visitorDaily.date} < ${rollupDailyCutoff}`);
  await db.delete(rollupDaily).where(sql`${rollupDaily.date} < ${rollupDailyCutoff}`);
  await db
    .delete(rollupDimensionDaily)
    .where(sql`${rollupDimensionDaily.date} < ${rollupDailyCutoff}`);
  await db.delete(rollupHourly).where(sql`${rollupHourly.date} < ${rollupHourlyCutoff}`);
  await db
    .delete(rollupDimensionHourly)
    .where(sql`${rollupDimensionHourly.date} < ${rollupHourlyCutoff}`);
};
