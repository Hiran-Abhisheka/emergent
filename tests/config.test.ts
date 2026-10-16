import { describe, expect, it } from "vitest";
import {
  CONFIG_LIMITS,
  DEFAULT_CONFIG,
  LIVE_CONFIG_KEYS,
  cloneConfig,
  configKeyAppliesLive,
  isValidConfig,
  validateConfig,
  type SimConfig,
} from "@/simulation/config";

describe("config validation", () => {
  it("accepts the default config", () => {
    const result = validateConfig(DEFAULT_CONFIG);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
    expect(isValidConfig(DEFAULT_CONFIG)).toBe(true);
  });

  it("rejects out-of-range values with a message per field", () => {
    const bad: SimConfig = {
      ...DEFAULT_CONFIG,
      initialPopulation: 0,
      baseMaxSpeed: 999,
      mutationProbability: 2,
    };
    const result = validateConfig(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.initialPopulation).toBeTruthy();
    expect(result.errors.baseMaxSpeed).toBeTruthy();
    expect(result.errors.mutationProbability).toBeTruthy();
  });

  it("rejects a non-integer or negative seed", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, seed: -1 }).valid).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, seed: 1.5 }).valid).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, seed: Number.NaN }).valid).toBe(false);
  });

  it("rejects NaN / Infinity", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, moveCost: Number.NaN }).valid).toBe(false);
    expect(validateConfig({ ...DEFAULT_CONFIG, moveCost: Number.POSITIVE_INFINITY }).valid).toBe(false);
  });

  it("catches cross-field inconsistencies", () => {
    expect(validateConfig({ ...DEFAULT_CONFIG, maxPopulation: 10, initialPopulation: 100 }).valid).toBe(
      false,
    );
    expect(validateConfig({ ...DEFAULT_CONFIG, maxEnergy: 50, initialEnergy: 70 }).valid).toBe(false);
    expect(
      validateConfig({ ...DEFAULT_CONFIG, offspringEnergy: 200, maxEnergy: 100 }).valid,
    ).toBe(false);
  });

  it("cloneConfig produces an equal but independent object", () => {
    const c = cloneConfig(DEFAULT_CONFIG);
    expect(c).toEqual(DEFAULT_CONFIG);
    c.moveCost = c.moveCost + 1;
    expect(c.moveCost).not.toBe(DEFAULT_CONFIG.moveCost);
  });

  it("every live key is a real config key and reset keys are the complement", () => {
    for (const key of LIVE_CONFIG_KEYS) {
      expect(DEFAULT_CONFIG).toHaveProperty(key);
      expect(configKeyAppliesLive(key)).toBe(true);
    }
    expect(configKeyAppliesLive("seed")).toBe(false);
    expect(configKeyAppliesLive("initialPopulation")).toBe(false);
  });

  it("limits are well-formed (min < max)", () => {
    for (const key of Object.keys(CONFIG_LIMITS) as (keyof typeof CONFIG_LIMITS)[]) {
      expect(CONFIG_LIMITS[key].min).toBeLessThan(CONFIG_LIMITS[key].max);
    }
  });
});
