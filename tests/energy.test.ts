import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/simulation/config";
import { createCreature } from "@/simulation/engine/world";
import { addEnergy, applyMetabolicCost, metabolicCost } from "@/simulation/engine/energy";
import type { Traits } from "@/simulation/types";

const CONFIG = {
  ...DEFAULT_CONFIG,
  basalCost: 0.02,
  moveCost: 0.06,
  visionCost: 0.02,
  baseMaxSpeed: 1.5,
  baseVisionRange: 120,
  maxEnergy: 100,
};

function makeCreature(speed: number, traits: Partial<Traits> = {}) {
  const t: Traits = {
    maxSpeed: 1.5,
    visionRange: 120,
    metabolicMultiplier: 1,
    mutationRate: 0.02,
    ...traits,
  };
  const creature = createCreature(0, 100, 100, 0, new Float32Array(160), t, 50, 0, -1, 0);
  creature.speed = speed;
  return creature;
}

describe("metabolic cost", () => {
  it("charges basal + vision at rest with baseline vision", () => {
    const c = makeCreature(0);
    expect(metabolicCost(c, CONFIG)).toBeCloseTo(0.02 + 0.02, 10);
  });

  it("charges the full move term at base max speed", () => {
    const c = makeCreature(CONFIG.baseMaxSpeed);
    expect(metabolicCost(c, CONFIG)).toBeCloseTo(0.02 + 0.06 + 0.02, 10);
  });

  it("grows the movement term with speed squared", () => {
    const slow = metabolicCost(makeCreature(0.75), CONFIG) - 0.04;
    const fast = metabolicCost(makeCreature(1.5), CONFIG) - 0.04;
    expect(fast).toBeCloseTo(slow * 4, 10);
  });

  it("scales linearly with the vision trait", () => {
    const base = metabolicCost(makeCreature(0, { visionRange: 120 }), CONFIG);
    const wide = metabolicCost(makeCreature(0, { visionRange: 240 }), CONFIG);
    expect(wide - base).toBeCloseTo(0.02, 10); // one extra visionCost unit
  });

  it("is multiplied by metabolicMultiplier", () => {
    const c = makeCreature(0, { metabolicMultiplier: 2 });
    expect(metabolicCost(c, CONFIG)).toBeCloseTo((0.02 + 0.02) * 2, 10);
  });

  it("makes faster creatures pay more than slower ones (real trait cost)", () => {
    const slow = makeCreature(0.5, { maxSpeed: 0.5 });
    const fast = makeCreature(3, { maxSpeed: 3 });
    expect(metabolicCost(fast, CONFIG)).toBeGreaterThan(metabolicCost(slow, CONFIG));
  });

  it("clamps energy at zero", () => {
    const c = makeCreature(1.5);
    c.energy = 0.001;
    applyMetabolicCost(c, CONFIG);
    expect(c.energy).toBe(0);
  });

  it("clamps added energy at maxEnergy", () => {
    const c = makeCreature(0);
    c.energy = 95;
    addEnergy(c, 30, CONFIG);
    expect(c.energy).toBe(100);
  });
});
