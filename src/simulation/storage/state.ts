import {
  GENOME_LAYOUT_VERSION,
  HIDDEN_COUNT,
  INPUT_COUNT,
  OUTPUT_COUNT,
  PARAM_COUNT,
  SCHEMA_VERSION,
} from "../constants";
import type { SimConfig } from "../config";
import type {
  Creature,
  Food,
  Obstacle,
  RngState,
  Traits,
  WorldState,
} from "../types";
import { GENOME_LAYOUT } from "../neural/genome";
import { base64ToBytes, bytesToBase64 } from "./base64";

/**
 * Structured-clone-friendly snapshot of a world. Genomes are Float32Array
 * copies (binary), which IndexedDB and the worker protocol can transfer with
 * zero conversion. JSON export uses `worldToJson`/`worldFromJson` instead,
 * which base64-encode the genomes.
 */
export interface SerializedWorld {
  schemaVersion: number;
  layoutVersion: number;
  tick: number;
  config: SimConfig;
  rng: RngState;
  obstacles: Obstacle[];
  food: Food[];
  creatures: SerializedCreature[];
  nextCreatureId: number;
  nextFoodId: number;
  births: number;
  deaths: number;
  foodEatenTotal: number;
  foodRegenAccumulator: number;
  lifetimeFoodByGeneration: number[];
  lifetimeCountByGeneration: number[];
  lifetimeAgeByGeneration: number[];
}

export interface SerializedCreature {
  id: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  energy: number;
  age: number;
  generation: number;
  alive: boolean;
  cooldown: number;
  genome: Float32Array;
  traits: Traits;
  parentId: number;
  birthTick: number;
  foodEaten: number;
}

function serializeCreature(c: Creature): SerializedCreature {
  return {
    id: c.id,
    x: c.x,
    y: c.y,
    heading: c.heading,
    speed: c.speed,
    energy: c.energy,
    age: c.age,
    generation: c.generation,
    alive: c.alive,
    cooldown: c.cooldown,
    genome: new Float32Array(c.genome),
    traits: { ...c.traits },
    parentId: c.parentId,
    birthTick: c.birthTick,
    foodEaten: c.foodEaten,
  };
}

function deserializeCreature(s: SerializedCreature): Creature {
  return {
    id: s.id,
    x: s.x,
    y: s.y,
    heading: s.heading,
    speed: s.speed,
    energy: s.energy,
    age: s.age,
    generation: s.generation,
    alive: s.alive,
    cooldown: s.cooldown,
    genome: new Float32Array(s.genome),
    traits: { ...s.traits },
    parentId: s.parentId,
    birthTick: s.birthTick,
    foodEaten: s.foodEaten,
    lastInputs: new Float32Array(INPUT_COUNT),
    lastHidden: new Float32Array(HIDDEN_COUNT),
    lastOutputs: new Float32Array(OUTPUT_COUNT),
  };
}

export function serializeWorld(world: WorldState): SerializedWorld {
  return {
    schemaVersion: SCHEMA_VERSION,
    layoutVersion: GENOME_LAYOUT_VERSION,
    tick: world.tick,
    config: { ...world.config },
    rng: { ...world.rng },
    obstacles: world.obstacles.map((o) => ({ ...o })),
    food: world.food.map((f) => ({ ...f })),
    creatures: world.creatures.map(serializeCreature),
    nextCreatureId: world.nextCreatureId,
    nextFoodId: world.nextFoodId,
    births: world.births,
    deaths: world.deaths,
    foodEatenTotal: world.foodEatenTotal,
    foodRegenAccumulator: world.foodRegenAccumulator,
    lifetimeFoodByGeneration: [...world.lifetimeFoodByGeneration],
    lifetimeCountByGeneration: [...world.lifetimeCountByGeneration],
    lifetimeAgeByGeneration: [...world.lifetimeAgeByGeneration],
  };
}

export function deserializeWorld(data: SerializedWorld): WorldState {
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported save schema ${data.schemaVersion} (expected ${SCHEMA_VERSION})`,
    );
  }
  if (data.layoutVersion !== GENOME_LAYOUT_VERSION) {
    throw new Error(
      `Unsupported genome layout ${data.layoutVersion} (expected ${GENOME_LAYOUT_VERSION})`,
    );
  }
  for (const c of data.creatures) {
    if (c.genome.length !== PARAM_COUNT) {
      throw new Error(`Genome length ${c.genome.length} does not match layout ${PARAM_COUNT}`);
    }
  }
  return {
    tick: data.tick,
    config: { ...data.config },
    rng: { ...data.rng },
    obstacles: data.obstacles.map((o) => ({ ...o })),
    food: data.food.map((f) => ({ ...f })),
    creatures: data.creatures.map(deserializeCreature),
    nextCreatureId: data.nextCreatureId,
    nextFoodId: data.nextFoodId,
    births: data.births,
    deaths: data.deaths,
    foodEatenTotal: data.foodEatenTotal,
    foodRegenAccumulator: data.foodRegenAccumulator,
    lifetimeFoodByGeneration: [...data.lifetimeFoodByGeneration],
    lifetimeCountByGeneration: [...data.lifetimeCountByGeneration],
    lifetimeAgeByGeneration: [...data.lifetimeAgeByGeneration],
  };
}

interface JsonCreature extends Omit<SerializedCreature, "genome"> {
  genome: string;
}

interface JsonWorld extends Omit<SerializedWorld, "creatures"> {
  creatures: JsonCreature[];
}

/**
 * JSON export of a serialized world: genomes become base64 of their exact
 * float32 bytes. This is the single implementation; the `WorldState` variants
 * below delegate to it so the UI (which only ever holds a `SerializedWorld`)
 * and the engine share one format.
 */
export function serializedWorldToJson(data: SerializedWorld): string {
  const json: JsonWorld = {
    ...data,
    creatures: data.creatures.map((c) => ({
      ...c,
      genome: bytesToBase64(new Uint8Array(c.genome.buffer, c.genome.byteOffset, c.genome.byteLength)),
    })),
  };
  return JSON.stringify(json);
}

/** Parses the JSON produced by `serializedWorldToJson`. Throws on bad input. */
export function serializedWorldFromJson(json: string): SerializedWorld {
  const parsed = JSON.parse(json) as JsonWorld;
  return {
    ...parsed,
    creatures: parsed.creatures.map((c) => {
      const bytes = base64ToBytes(c.genome);
      const genome = new Float32Array(PARAM_COUNT);
      const view = new Float32Array(bytes.buffer, bytes.byteOffset, PARAM_COUNT);
      genome.set(view);
      return { ...c, genome };
    }),
  };
}

/** JSON export of a whole world: genomes become base64 of their exact bytes. */
export function worldToJson(world: WorldState): string {
  return serializedWorldToJson(serializeWorld(world));
}

export function worldFromJson(json: string): WorldState {
  return deserializeWorld(serializedWorldFromJson(json));
}

/** Layout metadata for the network diagram (offsets + sizes). */
export const NETWORK_LAYOUT = {
  inputCount: GENOME_LAYOUT.inputCount,
  hiddenCount: GENOME_LAYOUT.hiddenCount,
  outputCount: GENOME_LAYOUT.outputCount,
  paramCount: GENOME_LAYOUT.paramCount,
} as const;
