/** Number/text formatting used across the instrument UI. Pure and total. */

const GROUP = new Intl.NumberFormat("en-US");

/** Integer with thousands separators (rounds first). */
export function formatInt(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return GROUP.format(Math.round(value));
}

/** Fixed decimal places; en-dash for non-finite values. */
export function formatFixed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

/**
 * Compact form for chart ticks and dense readouts: 1 234 → "1.2k",
 * 2 400 000 → "2.4M". Keeps small values exact.
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}k`;
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

/** Wall-clock duration for a number of simulation ticks. */
export function formatDuration(ticks: number, ticksPerSecond: number): string {
  if (!Number.isFinite(ticks) || !Number.isFinite(ticksPerSecond) || ticksPerSecond <= 0) {
    return "—";
  }
  const totalSeconds = Math.floor(ticks / ticksPerSecond);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

/** Byte size for export/import readouts. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A short, sortable timestamp for saved records. */
export function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}
