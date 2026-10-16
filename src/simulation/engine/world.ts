import {
  GRID_CELL_SIZE,
  HIDDEN_COUNT,
  INPUT_COUNT,
  OUTPUT_COUNT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../constants";
import { DEFAULT_CONFIG, isValidConfig, type SimConfig } from "../config";
import type { Creature, WorldState } from "../types";
import { Rng } from "./prng";
import { createFounderGenome } from "../neural/genome";
import { createFounderTraits } from "../evolution/traits";
import { generateObstacles } from "./obstacles";
import { generateInitialFood } from "./food";
import { SpatialGrid } from "./spatial-grid";
import { findRandomSpawn } from "./placement";
import { distance, obstacleBoundingRadius } from "./geometry";
import { CREATURE_SPAWN_SEPARATION_FACTOR, CREATURE_SPAWN_ATTEMPTS } from "../constants";

/** Builds a creature with empty telemetry buffers. */
export function createCreature(
  id: number,
  x: number,
  y: number,
  heading: number,
  genome: Float32Array,
  traits: Creature["traits"],
  energy: number,
  generation: number,
  parentId: number,
  birthTick: number,
): Creature {
  return {
    id,
    x,
    y,
    heading,
    speed: 0,
    energy,
    age: 0,
    generation,
    alive: true,
    cooldown: 0,
    genome,
    traits,
    parentId,
    birthTick,
    foodEaten: 0,
    lastInputs: new Float32Array(INPUT_COUNT),
    lastHidden: new Float32Array(HIDDEN_COUNT),
    lastOutputs: new Float32Array(OUTPUT_COUNT),
  };
}

/** Creates the founders for a new world. */
function spawnFounders(rng: Rng, config: SimConfig, obstacles: WorldState["obstacles"]): Creature[] {
  const creatures: Creature[] = [];
  const minSeparation = config.creatureRadius * CREATURE_SPAWN_SEPARATION_FACTOR;

  for (let i = 0; i < config.initialPopulation; i++) {
    let placed: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < CREATURE_SPAWN_ATTEMPTS; attempt++) {
      const candidate = findRandomSpawn(rng, obstacles, config.creatureRadius);
      if (candidate === null) break;
      const clash = creatures.some(
        (c) => distance(c.x, c.y, candidate.x, candidate.y) < minSeparation,
      );
      if (!clash) {
        placed = candidate;
        break;
      }
    }
    // Fallback: if the world is too crowded for separation, allow overlap
    // rather than silently dropping founders.
    if (placed === null) placed = findRandomSpawn(rng, obstacles, config.creatureRadius);
    if (placed === null) continue;

    const genome = createFounderGenome(rng);
    const traits = createFounderTraits(rng, config);
    const heading = rng.nextRange(-Math.PI, Math.PI);
    creatures.push(
      createCreature(i, placed.x, placed.y, heading, genome, traits, config.initialEnergy, 0, -1, 0),
    );
  }
  return creatures;
}

/**
 * Creates a fresh world from a configuration. Throws only when the config is
 * structurally invalid (the UI validates first; this is a guard for the worker
 * and for tests).
 */
export function createWorld(config: SimConfig = DEFAULT_CONFIG): WorldState {
  if (!isValidConfig(config)) {
    const details = JSON.stringify(config);
    throw new Error(`Invalid simulation config: ${details}`);
  }

  const rng = Rng.fromSeed(config.seed);
  const obstacles = generateObstacles(rng);
  const food = generateInitialFood(rng, config, obstacles);
  const creatures = spawnFounders(rng, config, obstacles);

  let maxId = -1;
  for (const c of creatures) if (c.id > maxId) maxId = c.id;

  return {
    tick: 0,
    config: { ...config },
    rng: rng.state(),
    creatures,
    food,
    obstacles,
    nextCreatureId: maxId + 1,
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

/**
 * Derived, non-serialisable runtime buffers. Recreated whenever the world is
 * loaded/changed shape; never part of the saved state.
 */
export interface WorldRuntime {
  creatureGrid: SpatialGrid;
  foodGrid: SpatialGrid;
  obstacleGrid: SpatialGrid;
  /** Scratch arrays reused for grid queries (no per-tick allocation). */
  creatureCandidates: number[];
  foodCandidates: number[];
  obstacleCandidates: number[];
  /** Padding added to obstacle queries so surfaces inside vision are seen. */
  obstacleQueryPadding: number;
  /** Separate RNG for metrics sampling; never advances the world RNG. */
  metricsRng: Rng;
}

export function createRuntime(world: WorldState): WorldRuntime {
  const capacity = Math.max(1, world.config.maxPopulation + 8);
  const foodCapacity = Math.max(1, world.config.maxFood + 8);
  let padding = 0;
  for (const o of world.obstacles) {
    const r = obstacleBoundingRadius(o);
    if (r > padding) padding = r;
  }
  const obstacleGrid = new SpatialGrid(
    GRID_CELL_SIZE,
    WORLD_WIDTH,
    WORLD_HEIGHT,
    world.obstacles.length + 1,
  );
  for (let i = 0; i < world.obstacles.length; i++) {
    obstacleGrid.insert(i, world.obstacles[i].x, world.obstacles[i].y);
  }
  return {
    creatureGrid: new SpatialGrid(GRID_CELL_SIZE, WORLD_WIDTH, WORLD_HEIGHT, capacity),
    foodGrid: new SpatialGrid(GRID_CELL_SIZE, WORLD_WIDTH, WORLD_HEIGHT, foodCapacity),
    obstacleGrid,
    creatureCandidates: [],
    foodCandidates: [],
    obstacleCandidates: [],
    obstacleQueryPadding: padding,
    metricsRng: Rng.fromSeed((world.config.seed ^ 0x5f356495) >>> 0),
  };
}

/** Rebuilds creature and food grids for the current tick. */
export function rebuildGrids(world: WorldState, runtime: WorldRuntime): void {
  runtime.creatureGrid.clear();
  runtime.foodGrid.clear();
  for (let i = 0; i < world.creatures.length; i++) {
    const c = world.creatures[i];
    runtime.creatureGrid.insert(i, c.x, c.y);
  }
  for (let i = 0; i < world.food.length; i++) {
    const f = world.food[i];
    runtime.foodGrid.insert(i, f.x, f.y);
  }
}

/** Number of alive creatures. */
export function population(world: WorldState): number {
  let n = 0;
  for (let i = 0; i < world.creatures.length; i++) if (world.creatures[i].alive) n++;
  return n;
}

/**
 * Records a completed lifetime into the per-generation accumulators. Called
 * exactly once per death (both energy starvation and max lifespan), so the
 * lifetime statistics are exact, not sampled.
 */
export function recordDeath(world: WorldState, creature: Creature): void {
  const g = creature.generation;
  while (world.lifetimeCountByGeneration.length <= g) {
    world.lifetimeFoodByGeneration.push(0);
    world.lifetimeCountByGeneration.push(0);
    world.lifetimeAgeByGeneration.push(0);
  }
  world.lifetimeFoodByGeneration[g] += creature.foodEaten;
  world.lifetimeCountByGeneration[g] += 1;
  world.lifetimeAgeByGeneration[g] += creature.age;
}

/** Removes eaten food and dead creatures in place, preserving order. */
export function compactWorld(world: WorldState): void {
  let w = 0;
  for (let i = 0; i < world.food.length; i++) {
    if (!world.food[i].eaten) world.food[w++] = world.food[i];
  }
  world.food.length = w;

  w = 0;
  for (let i = 0; i < world.creatures.length; i++) {
    if (world.creatures[i].alive) world.creatures[w++] = world.creatures[i];
  }
  world.creatures.length = w;
}
