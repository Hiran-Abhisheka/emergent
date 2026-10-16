import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type SimConfig } from "@/simulation/config";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/simulation/constants";
import { createRuntime, createWorld, population } from "@/simulation/engine/world";
import { stepWorld } from "@/simulation/engine/step";
import { hashState } from "@/simulation/engine/hash";

const SMALL: SimConfig = {
  ...DEFAULT_CONFIG,
  seed: 4242,
  initialPopulation: 40,
  maxPopulation: 80,
  initialFood: 150,
};

describe("engine integration (short deterministic runs)", () => {
  it("advances exactly one tick per step and never on its own", () => {
    const world = createWorld(SMALL);
    const runtime = createRuntime(world);
    const before = hashState(world);
    expect(world.tick).toBe(0);
    // Merely holding a world must not advance it.
    expect(hashState(world)).toBe(before);
    stepWorld(world, runtime);
    expect(world.tick).toBe(1);
  });

  it("keeps population within the cap at all times", () => {
    const world = createWorld(SMALL);
    const runtime = createRuntime(world);
    for (let t = 0; t < 400; t++) {
      stepWorld(world, runtime);
      expect(population(world)).toBeLessThanOrEqual(SMALL.maxPopulation);
    }
  });

  it("keeps energy in [0, maxEnergy] and positions inside bounds", () => {
    const world = createWorld(SMALL);
    const runtime = createRuntime(world);
    for (let t = 0; t < 400; t++) {
      stepWorld(world, runtime);
      for (const c of world.creatures) {
        expect(c.energy).toBeGreaterThanOrEqual(0);
        expect(c.energy).toBeLessThanOrEqual(SMALL.maxEnergy + 1e-9);
        expect(c.x).toBeGreaterThanOrEqual(SMALL.creatureRadius - 1e-6);
        expect(c.x).toBeLessThanOrEqual(WORLD_WIDTH - SMALL.creatureRadius + 1e-6);
        expect(c.y).toBeGreaterThanOrEqual(SMALL.creatureRadius - 1e-6);
        expect(c.y).toBeLessThanOrEqual(WORLD_HEIGHT - SMALL.creatureRadius + 1e-6);
      }
    }
  });

  it("keeps every genome and trait finite throughout a run", () => {
    const world = createWorld(SMALL);
    const runtime = createRuntime(world);
    for (let t = 0; t < 300; t++) {
      stepWorld(world, runtime);
      for (const c of world.creatures) {
        for (const v of c.genome) expect(Number.isFinite(v)).toBe(true);
        expect(Number.isFinite(c.energy)).toBe(true);
        expect(Number.isFinite(c.heading)).toBe(true);
      }
    }
  });

  it("never lets dead creatures reproduce", () => {
    const world = createWorld(SMALL);
    const runtime = createRuntime(world);
    const birthsBefore = world.births;
    for (const c of world.creatures) {
      c.alive = false;
      c.energy = 0;
    }
    for (let t = 0; t < 5; t++) stepWorld(world, runtime);
    expect(world.births).toBe(birthsBefore);
    expect(world.creatures.length).toBe(0);
  });

  it("gives newborns a higher generation than their parent and a valid parentId", () => {
    const world = createWorld(SMALL);
    const runtime = createRuntime(world);
    const genById = new Map<number, number>();
    for (const c of world.creatures) genById.set(c.id, c.generation);

    let foundBaby = false;
    for (let t = 0; t < 600 && !foundBaby; t++) {
      const beforeIds = new Set(world.creatures.map((c) => c.id));
      stepWorld(world, runtime);
      for (const c of world.creatures) {
        if (!beforeIds.has(c.id)) {
          foundBaby = true;
          expect(c.generation).toBeGreaterThanOrEqual(1);
          expect(c.parentId).toBeGreaterThanOrEqual(0);
          expect(c.genome.length).toBe(160);
        }
      }
    }
    expect(foundBaby).toBe(true);
  });

  it("is deterministic across two independent worlds", () => {
    const a = createWorld(SMALL);
    const b = createWorld(SMALL);
    const ra = createRuntime(a);
    const rb = createRuntime(b);
    for (let t = 0; t < 250; t++) {
      stepWorld(a, ra);
      stepWorld(b, rb);
    }
    expect(hashState(a)).toBe(hashState(b));
  });
});
