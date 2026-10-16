import { describe, expect, it } from "vitest";
import { TRAIT_RANGES } from "@/simulation/constants";
import {
  colorValueT,
  creatureColor,
  energyColor,
  generationColor,
  speedColor,
} from "@/simulation/renderer/colors";

describe("renderer colours", () => {
  it("produces valid rgb/hsl strings across the ramp", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      expect(energyColor(t)).toMatch(/^rgb\(/);
      expect(speedColor(t)).toMatch(/^hsl\(/);
    }
    expect(generationColor(0, 10)).toMatch(/^hsl\(/);
    expect(generationColor(10, 10)).toMatch(/^hsl\(/);
  });

  it("distinguishes starving from full energy", () => {
    expect(energyColor(0)).not.toBe(energyColor(1));
  });

  it("normalises the speed trait to [0,1] over its range", () => {
    const { min, max } = TRAIT_RANGES.maxSpeed;
    expect(colorValueT("speed", min, 1)).toBeCloseTo(0, 10);
    expect(colorValueT("speed", max, 1)).toBeCloseTo(1, 10);
    expect(colorValueT("speed", (min + max) / 2, 1)).toBeCloseTo(0.5, 10);
  });

  it("normalises generation against the observed maximum", () => {
    expect(colorValueT("generation", 5, 10)).toBeCloseTo(0.5, 10);
    expect(colorValueT("generation", 5, 0)).toBe(0);
  });

  it("normalises energy by the configured maximum", () => {
    expect(creatureColor("energy", 50, 10, 100)).toBe(energyColor(0.5));
    expect(creatureColor("generation", 5, 10, 100)).toBe(generationColor(5, 10));
  });

  it("never divides by zero for an empty population", () => {
    expect(() => creatureColor("generation", 0, 0, 0)).not.toThrow();
    expect(() => creatureColor("energy", 0, 0, 0)).not.toThrow();
  });
});
