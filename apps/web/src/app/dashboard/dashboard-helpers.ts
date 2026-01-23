export type RollupTotals = Record<string, number>;

export type DailyEntry = {
  date: string;
  visitors: number;
  sessions: number;
  goals: number;
  revenue: number;
  bounced: number;
  durationMs: number;
  revenueByType?: { new?: number; renewal?: number; refund?: number } | null;
};

export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 420;
export const MAP_LAT_LINES = [-60, -30, 0, 30, 60];
export const MAP_LNG_LINES = [-120, -60, 0, 60, 120];

const countryOverrides: Record<string, string> = {
  "United States of America": "United States",
  "United States": "United States",
  "Dem. Rep. Congo": "Congo - Kinshasa",
  "Congo - Kinshasa": "Congo - Kinshasa",
  "Congo - Brazzaville": "Congo - Brazzaville",
  "Congo": "Congo - Brazzaville",
  "Côte d'Ivoire": "Cote d'Ivoire",
  "Côte d’Ivoire": "Cote d'Ivoire",
  "Cote d'Ivoire": "Cote d'Ivoire",
  "South Korea": "South Korea",
  "North Korea": "North Korea",
  "Myanmar (Burma)": "Myanmar",
  "Myanmar": "Myanmar",
  "Viet Nam": "Vietnam",
  "Vietnam": "Vietnam",
  "Lao People's Democratic Republic": "Laos",
  "Laos": "Laos",
  "Bolivia, Plurinational State of": "Bolivia",
  "Bolivia": "Bolivia",
  "Tanzania, United Republic of": "Tanzania",
  "Tanzania": "Tanzania",
  "Iran, Islamic Republic of": "Iran",
  "Iran": "Iran",
  "Syrian Arab Republic": "Syria",
  "Syria": "Syria",
  "Venezuela, Bolivarian Republic of": "Venezuela",
  "Venezuela": "Venezuela",
  "Brunei Darussalam": "Brunei",
  "Brunei": "Brunei",
  "Russia": "Russia",
  "United Kingdom": "United Kingdom",
  "Germany": "Germany",
  "Canada": "Canada",
  "France": "France",
};

const formatCountryName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "unknown") {
    return "Unknown";
  }
  return countryOverrides[trimmed] ?? trimmed;
};

export const formatDimensionLabel = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "unknown") {
    return "Unknown";
  }
  if (trimmed === "direct") {
    return "Direct";
  }
  if (trimmed === "not set") {
    return "Not set";
  }
  return trimmed;
};

const isUnknownLabel = (value: string) =>
  value.trim().toLowerCase() === "unknown";

export const filterUnknownEntries = (entries: Array<[string, number]>) => {
  const known = entries.filter(([label]) => !isUnknownLabel(label));
  return known.length > 0 ? known : [];
};

export const parseDateKey = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDateKey = (value: Date) => value.toISOString().slice(0, 10);

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const projectGeoPoint = (latitude: number, longitude: number) => {
  const x = ((longitude + 180) / 360) * MAP_WIDTH;
  const y = ((90 - latitude) / 180) * MAP_HEIGHT;
  return { x, y };
};

export const formatVisitors = (count: number) =>
  `${count.toLocaleString()} visitor${count === 1 ? "" : "s"}`;

export const normalizeCountryName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return "";
  }
  if (trimmed.length === 2 && /^[a-z]{2}$/i.test(trimmed)) {
    try {
      const label = new Intl.DisplayNames(["en"], { type: "region" }).of(
        trimmed.toUpperCase(),
      );
      return label ? formatCountryName(label) : "";
    } catch {
      return "";
    }
  }
  return formatCountryName(trimmed);
};

export const formatGeoLabel = (value: string) => {
  const normalized = normalizeCountryName(value);
  return normalized || "Unknown";
};

export const slugifyLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export const getCountryLookupKey = (value: string) => slugifyLabel(value);

export const toNumber = (value: unknown) => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};
