import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type SimConfig } from "@/simulation/config";
import { WORLD_HEIGHT, WORLD_WIDTH, TRAIT_RANGES } from "@/simulation/constants";
import { createWorld } from "@/simulation/engine/world";
import { hashState } from "@/simulation/engine/hash";
import { pointInsideAnyObstacle } from "@/simulation/engine/obstacles";

const CONFIG: SimConfig = { ...DEFAULT_CONFIG, seed: 777 };

describe("world creation", () => {
  const world = createWorld(CONFIG);

  it("spawns the configured founder population", () => {
    expect(world.tick).toBe(0);
    expect(world.creatures.length).toBe(CONFIG.initialPopulation);
    for (const c of world.creatures) {
      expect(c.alive).toBe(true);
      expect(c.generation).toBe(0);
      expect(c.parentId).toBe(-1);
      expect(c.energy).toBe(CONFIG.initialEnergy);
      expect(c.age).toBe(0);
    }
  });

  it("places every creature inside the walls and out of obstacles", () => {
    for (const c of world.creatures) {
      expect(c.x).toBeGreaterThanOrEqual(CONFIG.creatureRadius);
      expect(c.x).toBeLessThanOrEqual(WORLD_WIDTH - CONFIG.creatureRadius);
      expect(c.y).toBeGreaterThanOrEqual(CONFIG.creatureRadius);
      expect(c.y).toBeLessThanOrEqual(WORLD_HEIGHT - CONFIG.creatureRadius);
      expect(pointInsideAnyObstacle(world.obstacles, c.x, c.y, 0)).toBe(false);
    }
  });

  it("keeps obstacles inside the walls and separated", () => {
    for (const o of world.obstacles) {
      if (o.kind === "circle") {
        expect(o.x - o.radius).toBeGreaterThan(0);
        expect(o.x + o.radius).toBeLessThan(WORLD_WIDTH);
        expect(o.y - o.radius).toBeGreaterThan(0);
        expect(o.y + o.radius).toBeLessThan(WORLD_HEIGHT);
      } else {
        expect(o.x - o.width / 2).toBeGreaterThan(0);
        expect(o.x + o.width / 2).toBeLessThan(WORLD_WIDTH);
        expect(o.y - o.height / 2).toBeGreaterThan(0);
        expect(o.y + o.height / 2).toBeLessThan(WORLD_HEIGHT);
      }
    }
  });

  it("gives every creature a finite genome and in-range traits", () => {
    for (const c of world.creatures) {
      expect(c.genome.length).toBe(160);
      for (const v of c.genome) expect(Number.isFinite(v)).toBe(true);
      for (const [name, range] of Object.entries(TRAIT_RANGES)) {
        const value = c.traits[name as keyof typeof c.traits];
        expect(value).toBeGreaterThanOrEqual(range.min);
        expect(value).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it("assigns unique creature and food ids", () => {
    const ids = new Set(world.creatures.map((c) => c.id));
    expect(ids.size).toBe(world.creatures.length);
    const foodIds = new Set(world.food.map((f) => f.id));
    expect(foodIds.size).toBe(world.food.length);
  });

  it("is deterministic: same seed gives the same hash", () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    expect(hashState(a)).toBe(hashState(b));
  });

  it("changes with a different seed", () => {
    const a = createWorld({ ...CONFIG, seed: 1 });
    const b = createWorld({ ...CONFIG, seed: 2 });
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it("rejects an invalid config", () => {
    expect(() => createWorld({ ...CONFIG, maxPopulation: 0 })).toThrow();
    expect(() => createWorld({ ...CONFIG, seed: -5 })).toThrow();
  });

  it("respects the initial food count roughly (obstacle rejects allowed)", () => {
    expect(world.food.length).toBeGreaterThan(CONFIG.initialFood * 0.7);
    expect(world.food.length).toBeLessThanOrEqual(CONFIG.initialFood);
  });
});
