import {
  OFFSPRING_PLACEMENT_ATTEMPTS,
  OFFSPRING_SPAWN_RADIUS,
  CREATURE_SPAWN_SEPARATION_FACTOR,
} from "../constants";
import type { Creature, WorldState } from "../types";
import type { WorldRuntime } from "./world";
import type { Rng } from "./prng";
import { createCreature } from "./world";
import { cloneGenome, isGenomeFinite, mutateGenomeInPlace } from "../neural/genome";
import { cloneTraits, mutateTraitsInPlace } from "../evolution/traits";
import { clamp } from "./geometry";
import { isSpawnFree } from "./placement";

/** True when this creature is currently allowed to reproduce. */
export function canReproduce(world: WorldState, creature: Creature, aliveCount: number): boolean {
  const config = world.config;
  return (
    creature.alive &&
    creature.cooldown <= 0 &&
    aliveCount < config.maxPopulation &&
    creature.energy >= config.reproductionThreshold &&
    creature.energy >= config.reproductionCost
  );
}

/**
 * Attempts asexual reproduction. Returns the newborn creature, or null when
 * any precondition fails. Reproduction never creates energy: the parent pays
 * `reproductionCost` and the child starts with `offspringEnergy` (the
 * difference is lost to the world). `parentIndex` is the parent's index in
 * `world.creatures`, used to ignore the parent when checking spawn space.
 */
export function attemptReproduction(
  world: WorldState,
  runtime: WorldRuntime,
  parent: Creature,
  parentIndex: number,
  aliveCount: number,
  rng: Rng,
): Creature | null {
  if (!canReproduce(world, parent, aliveCount)) return null;

  const config = world.config;
  const radius = config.creatureRadius;

  const genome = cloneGenome(parent.genome);
  mutateGenomeInPlace(genome, rng, parent.traits.mutationRate, config.mutationStrength);
  if (!isGenomeFinite(genome)) return null;

  const traits = cloneTraits(parent.traits);
  mutateTraitsInPlace(traits, rng, config.traitMutationStrength);

  const spawnMin = radius * CREATURE_SPAWN_SEPARATION_FACTOR;
  const spawnMax = Math.max(OFFSPRING_SPAWN_RADIUS, spawnMin * 1.5);
  let px = parent.x;
  let py = parent.y;
  let placed = false;

  for (let attempt = 0; attempt < OFFSPRING_PLACEMENT_ATTEMPTS; attempt++) {
    const angle = rng.nextRange(0, 2 * Math.PI);
    const dist = rng.nextRange(spawnMin, spawnMax);
    const x = parent.x + Math.cos(angle) * dist;
    const y = parent.y + Math.sin(angle) * dist;
    if (!isSpawnFree(world.obstacles, x, y, radius)) continue;

    const n = runtime.creatureGrid.queryCircle(
      x,
      y,
      spawnMin,
      runtime.creatureCandidates,
    );
    let clash = false;
    for (let k = 0; k < n; k++) {
      if (runtime.creatureCandidates[k] !== parentIndex) {
        clash = true;
        break;
      }
    }
    if (clash) continue;

    px = x;
    py = y;
    placed = true;
    break;
  }

  if (!placed) {
    // Fall back to the parent's own (already valid) position.
    px = parent.x;
    py = parent.y;
  }

  parent.energy = clamp(parent.energy - config.reproductionCost, 0, config.maxEnergy);
  parent.cooldown = config.reproductionCooldown;

  const child = createCreature(
    world.nextCreatureId++,
    px,
    py,
    rng.nextRange(-Math.PI, Math.PI),
    genome,
    traits,
    config.offspringEnergy,
    parent.generation + 1,
    parent.id,
    world.tick,
  );
  world.births += 1;
  return child;
}
