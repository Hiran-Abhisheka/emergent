/** Shared chart styling so every Recharts figure matches the instrument theme. */

export const CHART_COLORS = {
  population: "#4fd1c5",
  births: "#6ee7a0",
  deaths: "#e05c5c",
  energy: "#f0b429",
  generation: "#56b6f0",
  maxGeneration: "#7aa7d8",
  speed: "#6ee7a0",
  vision: "#4fd1c5",
  dispersion: "#b98cf0",
  food: "#6ee7a0",
  lifespan: "#f0b429",
  grid: "#1e2a3d",
  axis: "#5a6a80",
  accent: "#4fd1c5",
} as const;

export const CHART_MARGIN = { top: 6, right: 10, bottom: 4, left: 0 } as const;

export const TOOLTIP_STYLE = {
  background: "#111a28",
  border: "1px solid #2c3b52",
  fontSize: 10,
  padding: "4px 6px",
  color: "#d7e2f0",
} as const;

/** Recharts tick label for the x axis (tick number, compact). */
export function axisTick(value: number): string {
  return String(value);
}

/** Distinct series colours, in order, for overlay charts. */
export const SERIES_PALETTE: readonly string[] = [
  "#4fd1c5",
  "#f0b429",
  "#6ee7a0",
  "#56b6f0",
  "#e05c5c",
  "#b98cf0",
  "#e58fd2",
  "#8fa1b8",
];
