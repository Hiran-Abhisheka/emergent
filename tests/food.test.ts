import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/simulation/config";
import { Rng } from "@/simulation/engine/prng";
import { generateInitialFood, regenerateFood } from "@/simulation/engine/food";
import { generateObstacles, pointInsideAnyObstacle } from "@/simulation/engine/obstacles";
import { createCreature, createRuntime, createWorld } from "@/simulation/engine/world";
import { stepWorld } from "@/simulation/engine/step";
import { GENOME_LAYOUT } from "@/simulation/neural/genome";
import type { Creature, Food, WorldState } from "@/simulation/types";
import { seedToRngState } from "@/simulation/engine/prng";

const FOOD_CONFIG = {
  initialFood: 200,
  foodClusterCount: 5,
  foodClusterRadius: 120,
  foodBackgroundFraction: 0.35,
};

describe("initial food", () => {
  it("places roughly the requested amount with unique ids and out of obstacles", () => {
    const rng = Rng.fromSeed(123);
    const obstacles = generateObstacles(Rng.fromSeed(123));
    const food = generateInitialFood(rng, FOOD_CONFIG, obstacles);
    expect(food.length).toBeGreaterThan(FOOD_CONFIG.initialFood * 0.7);
    expect(food.length).toBeLessThanOrEqual(FOOD_CONFIG.initialFood);
    const ids = new Set(food.map((f) => f.id));
    expect(ids.size).toBe(food.length);
    for (const f of food) {
      expect(pointInsideAnyObstacle(obstacles, f.x, f.y, 0)).toBe(false);
    }
  });

  it("is deterministic for a given seed", () => {
    const a = generateInitialFood(Rng.fromSeed(9), FOOD_CONFIG, []);
    const b = generateInitialFood(Rng.fromSeed(9), FOOD_CONFIG, []);
    expect(a.map((f) => [f.id, f.x, f.y])).toEqual(b.map((f) => [f.id, f.x, f.y]));
  });
});

describe("food regeneration", () => {
  it("accumulates fractional regen and respects the cap", () => {
    const food: Food[] = [];
    let acc = 0;
    let nextId = 0;
    const config = { foodRegenPerTick: 0.6, maxFood: 3 };
    for (let i = 0; i < 100; i++) {
      const r = regenerateFood(Rng.fromSeed(1), food, nextId, acc, config, []);
      nextId = r.nextFoodId;
      acc = r.accumulator;
      food.length = Math.min(food.length, config.maxFood);
      expect(food.length).toBeLessThanOrEqual(config.maxFood);
    }
    expect(food.length).toBe(config.maxFood);
  });

  it("does nothing when the cap is reached", () => {
    const food: Food[] = [{ id: 0, x: 10, y: 10, eaten: false }];
    const r = regenerateFood(Rng.fromSeed(1), food, 1, 5, { foodRegenPerTick: 1, maxFood: 1 }, []);
    expect(food.length).toBe(1);
    expect(r.spawned).toBe(0);
  });
});

function makeStillCreature(id: number, x: number, y: number, energy: number): Creature {
  const genome = new Float32Array(160);
  genome[GENOME_LAYOUT.b2Offset + 2] = -1; // thrust < 0 keeps speed at 0
  genome[GENOME_LAYOUT.b2Offset + 3] = -1; // no reproduction
  return createCreature(id, x, y, 0, genome, {
    maxSpeed: 1.5,
    visionRange: 120,
    metabolicMultiplier: 1,
    mutationRate: 0.02,
  }, energy, 0, -1, 0);
}

function makeWorldWith(food: Food[], creatures: Creature[]): WorldState {
  return {
    tick: 0,
    config: { ...DEFAULT_CONFIG, foodRegenPerTick: 0, maxLifespan: 100000 },
    rng: seedToRngState(1),
    creatures,
    food,
    obstacles: [],
    nextCreatureId: 100,
    nextFoodId: food.length,
    births: 0,
    deaths: 0,
    foodEatenTotal: 0,
    foodRegenAccumulator: 0,
    lifetimeFoodByGeneration: [],
    lifetimeCountByGeneration: [],
    lifetimeAgeByGeneration: [],
  };
}

describe("food collection", () => {
  it("removes a contested item exactly once and gives it to the lowest id", () => {
    const c0 = makeStillCreature(0, 100, 100, 50);
    const c1 = makeStillCreature(1, 100, 100, 50);
    const world = makeWorldWith([{ id: 0, x: 100, y: 100, eaten: false }], [c0, c1]);
    const runtime = createRuntime(world);

    stepWorld(world, runtime);

    expect(world.foodEatenTotal).toBe(1);
    // c0 out-competes c1 because it has the lower id.
    expect(c0.foodEaten).toBe(1);
    expect(c1.foodEaten).toBe(0);
    expect(c0.energy).toBeGreaterThan(c1.energy);
    expect(world.food.length).toBe(0);
  });

  it("does not collect food that is out of reach", () => {
    const c0 = makeStillCreature(0, 100, 100, 50);
    const world = makeWorldWith([{ id: 0, x: 200, y: 200, eaten: false }], [c0]);
    const runtime = createRuntime(world);
    stepWorld(world, runtime);
    expect(world.foodEatenTotal).toBe(0);
    expect(world.food.length).toBe(1);
  });

  it("caps energy gained from food at maxEnergy", () => {
    const c0 = makeStillCreature(0, 100, 100, 99);
    const world = makeWorldWith([{ id: 0, x: 100, y: 100, eaten: false }], [c0]);
    const runtime = createRuntime(world);
    stepWorld(world, runtime);
    expect(c0.energy).toBeLessThanOrEqual(world.config.maxEnergy);
  });
});

describe("population and deaths", () => {
  it("counts a death when energy runs out", () => {
    const c0 = makeStillCreature(0, 100, 100, 0.01);
    const world = makeWorldWith([], [c0]);
    const runtime = createRuntime(world);
    stepWorld(world, runtime);
    expect(world.deaths).toBe(1);
    expect(world.creatures.length).toBe(0);
  });

  it("kills creatures that reach the max lifespan", () => {
    const c0 = makeStillCreature(0, 100, 100, 50);
    c0.age = 10;
    const world = makeWorldWith([], [c0]);
    world.config = { ...world.config, maxLifespan: 11 };
    const runtime = createRuntime(world);
    stepWorld(world, runtime);
    expect(world.deaths).toBe(1);
  });

  it("records a completed lifetime by generation on death", () => {
    const c0 = makeStillCreature(0, 100, 100, 0.01);
    c0.foodEaten = 3;
    c0.generation = 2;
    c0.age = 7;
    const world = makeWorldWith([], [c0]);
    const runtime = createRuntime(world);
    stepWorld(world, runtime);
    expect(world.lifetimeCountByGeneration[2]).toBe(1);
    expect(world.lifetimeFoodByGeneration[2]).toBe(3);
    expect(world.lifetimeAgeByGeneration[2]).toBe(8);
  });
});

describe("createWorld food count", () => {
  it("never exceeds initialFood", () => {
    const world = createWorld({ ...DEFAULT_CONFIG, seed: 5 });
    expect(world.food.length).toBeLessThanOrEqual(DEFAULT_CONFIG.initialFood);
  });
});
