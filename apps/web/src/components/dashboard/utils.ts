import { type AnalyticsSample } from "@/app/dashboard/analytics-samples";
import { directReferrerLabel, notSetLabel } from "./schema";

export const isNotSetFilter = (value: string) =>
  value === notSetLabel.toLowerCase() || value === "not set";

export const isDirectFilter = (value: string) =>
  value === directReferrerLabel.toLowerCase() || value === "direct";

export const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const parseExclusionList = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

export const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const createWildcardMatcher = (pattern: string) =>
  new RegExp(escapeRegExp(pattern).replace(/\\\*/g, ".*"), "i");

export const matchesAny = (value: string, matchers: RegExp[]) => {
  if (!value || matchers.length === 0) {
    return false;
  }
  for (let index = 0; index < matchers.length; index += 1) {
    if (matchers[index]?.test(value)) {
      return true;
    }
  }
  return false;
};

export const buildDimensionCounts = (
  events: AnalyticsSample[],
  key: keyof AnalyticsSample,
  fallback: string,
) =>
  events.reduce<Record<string, number>>((accumulator, event) => {
    const value = String(event[key]).trim() || fallback;
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
