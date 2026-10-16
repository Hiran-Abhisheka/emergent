import { TRAIT_RANGES } from "../constants";
import type { ColorMode } from "../worker-messages";

/** Restrained instrument palette (matches the CSS theme tokens). */
export const PALETTE = {
  void: "#070b12",
  abyss: "#0a0f18",
  surface: "#0d1420",
  gridLine: "#16233a",
  gridLineStrong: "#20304d",
  wall: "#3a4a63",
  obstacle: "#243349",
  obstacleEdge: "#3d5271",
  food: "#6ee7a0",
  foodDim: "#2f7a52",
  selection: "#f0b429",
  sensorFood: "#4fd1c5",
  sensorObstacle: "#e05c5c",
  vision: "#4fd1c5",
  label: "#8fa1b8",
  lowEnergy: "#e05c5c",
  midEnergy: "#f0b429",
  highEnergy: "#6ee7a0",
} as const;

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function rgbString(c: RGB): string {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const LOW = hexToRgb(PALETTE.lowEnergy);
const MID = hexToRgb(PALETTE.midEnergy);
const HIGH = hexToRgb(PALETTE.highEnergy);

/** Energy ramp: red (starving) → amber → green (full). t in [0,1]. */
export function energyColor(t: number): string {
  const x = Math.min(Math.max(t, 0), 1);
  return x < 0.5 ? rgbString(mix(LOW, MID, x / 0.5)) : rgbString(mix(MID, HIGH, (x - 0.5) / 0.5));
}

/** Generation ramp: cyan → amber as generation rises. g/maxG in [0,1]. */
export function generationColor(g: number, maxG: number): string {
  const t = maxG > 0 ? Math.min(Math.max(g / maxG, 0), 1) : 0;
  const hue = 190 - 150 * t; // 190 (cyan) → 40 (amber)
  return `hsl(${hue.toFixed(0)}, 62%, 60%)`;
}

/** Speed-trait ramp: muted blue → bright cyan. t in [0,1] over the trait range. */
export function speedColor(t: number): string {
  const x = Math.min(Math.max(t, 0), 1);
  const hue = 210 - 30 * x;
  return `hsl(${hue.toFixed(0)}, ${(45 + 35 * x).toFixed(0)}%, ${(50 + 12 * x).toFixed(0)}%)`;
}

/** Normalises a raw colour-value according to the mode. */
export function colorValueT(mode: ColorMode, value: number, maxGeneration: number): number {
  switch (mode) {
    case "energy":
      return value;
    case "generation":
      return maxGeneration > 0 ? value / maxGeneration : 0;
    case "speed": {
      const { min, max } = TRAIT_RANGES.maxSpeed;
      return (value - min) / (max - min);
    }
  }
}

/** Fill colour for a creature given the mode and its raw colour value. */
export function creatureColor(
  mode: ColorMode,
  value: number,
  maxGeneration: number,
  maxEnergy: number,
): string {
  switch (mode) {
    case "energy":
      return energyColor(maxEnergy > 0 ? value / maxEnergy : 0);
    case "generation":
      return generationColor(value, maxGeneration);
    case "speed":
      return speedColor(colorValueT("speed", value, maxGeneration));
  }
}
