import type { StatsSample } from "../types";

/**
 * Column order for the stats CSV. Kept as a literal tuple so the header and
 * the rows cannot drift apart.
 */
export const STATS_CSV_COLUMNS = [
  "tick",
  "population",
  "births",
  "deaths",
  "foodRemaining",
  "meanEnergy",
  "meanSpeedTrait",
  "meanVisionTrait",
  "meanGeneration",
  "maxGeneration",
  "genomeDispersion",
] as const;

/** RFC-4180-ish escaping: quote when the value contains a comma, quote or newline. */
function escapeCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialises a stats series to CSV. Numbers are written at full precision so
 * the export can be re-analysed without rounding loss.
 */
export function statsToCsv(history: readonly StatsSample[]): string {
  const lines: string[] = [STATS_CSV_COLUMNS.join(",")];
  for (const sample of history) {
    lines.push(
      STATS_CSV_COLUMNS.map((column) => escapeCell(String(sample[column]))).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** A filesystem-safe stem from a run name (used for export file names). */
export function safeFileStem(name: string): string {
  const stem = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return stem === "" ? "run" : stem.slice(0, 48);
}
