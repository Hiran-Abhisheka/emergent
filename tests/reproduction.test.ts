import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type SimConfig } from "@/simulation/config";
import { attemptReproduction, canReproduce } from "@/simulation/engine/reproduction";
import { createCreature, createRuntime, createWorld, rebuildGrids } from "@/simulation/engine/world";
import { Rng } from "@/simulation/engine/prng";
import { isGenomeFinite } from "@/simulation/neural/genome";

const CONFIG: SimConfig = {
  ...DEFAULT_CONFIG,
  seed: 321,
  initialPopulation: 10,
  maxPopulation: 10,
  initialFood: 0,
  foodRegenPerTick: 0,
};

function makeReadyParent(energy: number, cooldown = 0) {
  const genome = new Float32Array(160);
  for (let i = 0; i < genome.length; i++) genome[i] = (i % 7) / 7 - 0.5;
  const parent = createCreature(0, 300, 300, 0, genome, {
    maxSpeed: 1.5,
    visionRange: 120,
    metabolicMultiplier: 1,
    mutationRate: 0.5,
  }, energy, 3, -1, 0);
  parent.cooldown = cooldown;
  return parent;
}

describe("canReproduce", () => {
  const base = createWorld(CONFIG);

  it("requires threshold energy and zero cooldown", () => {
    const c = makeReadyParent(90);
    expect(canReproduce(base, c, 1)).toBe(true);
    expect(canReproduce(base, { ...c, cooldown: 5 }, 1)).toBe(false);
    expect(canReproduce(base, { ...c, energy: 89 }, 1)).toBe(false);
  });

  it("requires population below the cap", () => {
    const c = makeReadyParent(95);
    expect(canReproduce(base, c, CONFIG.maxPopulation)).toBe(false);
    expect(canReproduce(base, c, CONFIG.maxPopulation - 1)).toBe(true);
  });

  it("requires being able to pay the cost", () => {
    const world = createWorld({ ...CONFIG, reproductionCost: 95, reproductionThreshold: 90 });
    const c = makeReadyParent(90);
    expect(canReproduce(world, c, 1)).toBe(false);
    const rich = makeReadyParent(95);
    expect(canReproduce(world, rich, 1)).toBe(true);
  });

  it("refuses reproduction for a dead creature", () => {
    const c = makeReadyParent(95);
    c.alive = false;
    expect(canReproduce(base, c, 1)).toBe(false);
  });
});

describe("attemptReproduction", () => {
  function setup() {
    const world = createWorld(CONFIG);
    const runtime = createRuntime(world);
    rebuildGrids(world, runtime);
    const parent = makeReadyParent(90);
    world.creatures = [parent];
    world.nextCreatureId = 1;
    return { world, runtime, parent };
  }

  it("creates a mutated child with correct lineage and transfers energy", () => {
    const { world, runtime, parent } = setup();
    const child = attemptReproduction(world, runtime, parent, 0, 1, Rng.fromSeed(7));

    expect(child).not.toBeNull();
    if (child === null) return;

    expect(child.generation).toBe(parent.generation + 1);
    expect(child.parentId).toBe(parent.id);
    expect(child.id).toBe(1);
    expect(child.energy).toBe(CONFIG.offspringEnergy);
    expect(child.genome.length).toBe(160);
    expect(isGenomeFinite(child.genome)).toBe(true);
    expect(child.traits.mutationRate).toBeGreaterThan(0);

    // Reproduction never creates energy: 50 paid, 40 handed over.
    expect(parent.energy).toBe(90 - CONFIG.reproductionCost);
    expect(child.energy).toBeLessThan(CONFIG.reproductionCost);
    expect(parent.cooldown).toBe(CONFIG.reproductionCooldown);
    expect(world.births).toBe(1);
  });

  it("mutates the child genome (it is not a copy of the parent)", () => {
    const { world, runtime, parent } = setup();
    const child = attemptReproduction(world, runtime, parent, 0, 1, Rng.fromSeed(7));
    expect(child).not.toBeNull();
    if (child === null) return;
    const identical = child.genome.every((v, i) => v === parent.genome[i]);
    expect(identical).toBe(false);
  });

  it("refuses when the population is at the cap", () => {
    const { world, runtime, parent } = setup();
    const child = attemptReproduction(world, runtime, parent, 0, CONFIG.maxPopulation, Rng.fromSeed(1));
    expect(child).toBeNull();
    expect(world.births).toBe(0);
    expect(parent.energy).toBe(90);
  });

  it("refuses while on cooldown", () => {
    const { world, runtime } = setup();
    const parent = makeReadyParent(90, 100);
    world.creatures = [parent];
    const child = attemptReproduction(world, runtime, parent, 0, 1, Rng.fromSeed(1));
    expect(child).toBeNull();
  });

  it("places the child inside the world", () => {
    const { world, runtime, parent } = setup();
    const child = attemptReproduction(world, runtime, parent, 0, 1, Rng.fromSeed(3));
    if (child === null) throw new Error("expected a child");
    expect(child.x).toBeGreaterThanOrEqual(CONFIG.creatureRadius);
    expect(child.y).toBeGreaterThanOrEqual(CONFIG.creatureRadius);
  });
});
