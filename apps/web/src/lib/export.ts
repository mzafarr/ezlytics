/**
 * Export utilities for Ezlytics dashboard data.
 * Supports CSV and JSON downloads directly client-side — no server needed.
 */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    const str = value === null || value === undefined ? "" : String(value);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const headerRow = headers.join(",");
  const dataRows = rows.map((row) =>
    headers.map((h) => escape(row[h])).join(","),
  );
  return [headerRow, ...dataRows].join("\n");
}

export function exportAsCSV(
  rows: Record<string, unknown>[],
  filename: string,
) {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export function exportAsJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  triggerDownload(
    blob,
    filename.endsWith(".json") ? filename : `${filename}.json`,
  );
}

// ── Typed helpers for dashboard data ─────────────────────────────────────────

export type DailyExportRow = {
  date: string;
  visitors: number;
  sessions: number;
  goals: number;
  revenue: number;
  bounced: number;
  avg_session_duration_ms: number;
};

export type DimensionExportRow = {
  dimension: string;
  value: string;
  visitors: number;
  revenue: number;
};

/**
 * Build a flat CSV-ready array from daily time-series entries.
 */
export function buildDailyRows(
  dailyEntries: Array<{
    date: string;
    visitors: number;
    sessions: number;
    goals: number;
    revenue: number;
    bounced: number;
    durationMs: number;
  }>,
): DailyExportRow[] {
  return dailyEntries.map((entry) => ({
    date: entry.date,
    visitors: entry.visitors,
    sessions: entry.sessions,
    goals: entry.goals,
    revenue: entry.revenue,
    bounced: entry.bounced,
    avg_session_duration_ms: entry.durationMs,
  }));
}

/**
 * Flatten all dimension totals (pages, sources, countries, etc.)
 * into a single array of { dimension, value, visitors, revenue } rows.
 */
export function buildDimensionRows(
  dimensionVisitorTotals: Record<string, Record<string, number>>,
  dimensionRevenueTotals: Record<string, Record<string, number>>,
): DimensionExportRow[] {
  const rows: DimensionExportRow[] = [];
  for (const [dimension, values] of Object.entries(dimensionVisitorTotals)) {
    for (const [value, visitors] of Object.entries(values)) {
      rows.push({
        dimension,
        value,
        visitors,
        revenue: dimensionRevenueTotals[dimension]?.[value] ?? 0,
      });
    }
  }
  return rows.sort((a, b) => b.visitors - a.visitors);
}
