import type { WorldState } from "../types";
import { GENOME_LAYOUT_VERSION } from "../constants";

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * FNV-1a 32-bit hash builder. Floats are hashed by their exact float32 bit
 * pattern (not by decimal text), so identical computations hash identically.
 */
export class Fnv1a {
  private h = FNV_OFFSET;
  private readonly scratch = new Float32Array(1);
  private readonly scratchU32 = new Uint32Array(this.scratch.buffer);

  updateByte(byte: number): void {
    this.h ^= byte & 0xff;
    this.h = Math.imul(this.h, FNV_PRIME);
  }

  updateUint32(value: number): void {
    const v = value >>> 0;
    this.updateByte(v);
    this.updateByte(v >>> 8);
    this.updateByte(v >>> 16);
    this.updateByte(v >>> 24);
  }

  updateInt(value: number): void {
    this.updateUint32(value | 0);
  }

  updateFloat(value: number): void {
    this.scratch[0] = value;
    this.updateUint32(this.scratchU32[0]);
  }

  updateBool(value: boolean): void {
    this.updateByte(value ? 1 : 0);
  }

  digest(): number {
    return this.h >>> 0;
  }
}

/**
 * Deterministic hash of the whole world state (creatures incl. genomes, food,
 * obstacles, counters and RNG state). Used by the determinism and
 * restore-continuation tests. Not used in the hot loop.
 */
export function hashState(world: WorldState): number {
  const h = new Fnv1a();
  h.updateInt(GENOME_LAYOUT_VERSION);
  h.updateInt(world.tick);
  h.updateInt(world.births);
  h.updateInt(world.deaths);
  h.updateInt(world.foodEatenTotal);
  h.updateInt(world.nextCreatureId);
  h.updateInt(world.nextFoodId);
  h.updateFloat(world.foodRegenAccumulator);
  h.updateInt(world.lifetimeCountByGeneration.length);
  for (let g = 0; g < world.lifetimeCountByGeneration.length; g++) {
    h.updateInt(world.lifetimeCountByGeneration[g]);
    h.updateFloat(world.lifetimeFoodByGeneration[g]);
    h.updateFloat(world.lifetimeAgeByGeneration[g]);
  }
  h.updateUint32(world.rng.a);
  h.updateUint32(world.rng.b);
  h.updateUint32(world.rng.c);
  h.updateUint32(world.rng.d);

  h.updateInt(world.creatures.length);
  for (const c of world.creatures) {
    h.updateInt(c.id);
    h.updateFloat(c.x);
    h.updateFloat(c.y);
    h.updateFloat(c.heading);
    h.updateFloat(c.speed);
    h.updateFloat(c.energy);
    h.updateInt(c.age);
    h.updateInt(c.generation);
    h.updateBool(c.alive);
    h.updateInt(c.cooldown);
    h.updateInt(c.parentId);
    h.updateInt(c.birthTick);
    h.updateInt(c.foodEaten);
    h.updateFloat(c.traits.maxSpeed);
    h.updateFloat(c.traits.visionRange);
    h.updateFloat(c.traits.metabolicMultiplier);
    h.updateFloat(c.traits.mutationRate);
    for (let i = 0; i < c.genome.length; i++) h.updateFloat(c.genome[i]);
  }

  h.updateInt(world.food.length);
  for (const f of world.food) {
    h.updateInt(f.id);
    h.updateFloat(f.x);
    h.updateFloat(f.y);
  }

  h.updateInt(world.obstacles.length);
  for (const o of world.obstacles) {
    h.updateInt(o.id);
    h.updateByte(o.kind === "circle" ? 1 : 2);
    h.updateFloat(o.x);
    h.updateFloat(o.y);
    if (o.kind === "circle") {
      h.updateFloat(o.radius);
    } else {
      h.updateFloat(o.width);
      h.updateFloat(o.height);
    }
  }

  return h.digest();
}
