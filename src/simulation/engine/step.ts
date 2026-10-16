import {
  FOOD_RADIUS,
  OUTPUT_REPRODUCE,
  REPRODUCE_OUTPUT_THRESHOLD,
} from "../constants";
import type { Creature, WorldState } from "../types";
import { Rng } from "./prng";
import { forward } from "../neural/genome";
import { compactWorld, rebuildGrids, recordDeath, type WorldRuntime } from "./world";
import { computeSensors } from "./sensors";
import { applySteering, integrateMovement } from "./movement";
import { addEnergy, applyMetabolicCost } from "./energy";
import { attemptReproduction } from "./reproduction";
import { regenerateFood } from "./food";
import { distance } from "./geometry";

/**
 * Eats the nearest reachable food, if any. When several creatures reach the
 * same item in one tick, the one processed first wins; creatures are always
 * processed in ascending id order, so the winner is the lowest creature id.
 * Each item is removed exactly once (the `eaten` flag).
 */
function eatFood(world: WorldState, runtime: WorldRuntime, creature: Creature): void {
  const reach = world.config.creatureRadius + FOOD_RADIUS;
  const n = runtime.foodGrid.queryCircle(creature.x, creature.y, reach, runtime.foodCandidates);
  let bestIndex = -1;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let k = 0; k < n; k++) {
    const idx = runtime.foodCandidates[k];
    const f = world.food[idx];
    if (f.eaten) continue;
    const d = distance(creature.x, creature.y, f.x, f.y);
    if (d > reach) continue;
    if (d < bestDist || (d === bestDist && bestIndex >= 0 && f.id < world.food[bestIndex].id)) {
      bestDist = d;
      bestIndex = idx;
    }
  }

  if (bestIndex < 0) return;
  world.food[bestIndex].eaten = true;
  addEnergy(creature, world.config.foodEnergy, world.config);
  creature.foodEaten += 1;
  world.foodEatenTotal += 1;
}

/**
 * Advances the world by exactly one tick.
 *
 * Per creature, in ascending id order: age/cool down -> sense -> think -> steer
 * -> move/collide -> eat -> pay metabolic cost -> die or reproduce. Newborns
 * never act on the tick they are born. Food regeneration happens at the end,
 * then eaten food and dead creatures are compacted out and the RNG state is
 * written back.
 */
export function stepWorld(world: WorldState, runtime: WorldRuntime): void {
  const config = world.config;
  const rng = Rng.fromState(world.rng);
  rebuildGrids(world, runtime);

  let aliveCount = 0;
  for (let i = 0; i < world.creatures.length; i++) {
    if (world.creatures[i].alive) aliveCount++;
  }

  const initialCount = world.creatures.length;
  const newborns: Creature[] = [];

  for (let i = 0; i < initialCount; i++) {
    const creature = world.creatures[i];
    if (!creature.alive) continue;

    creature.age += 1;
    if (creature.cooldown > 0) creature.cooldown -= 1;

    computeSensors(world, runtime, creature, creature.lastInputs);
    forward(creature.genome, creature.lastInputs, creature.lastHidden, creature.lastOutputs);

    applySteering(creature, creature.lastOutputs, config);
    integrateMovement(world, runtime, creature, config);

    eatFood(world, runtime, creature);
    applyMetabolicCost(creature, config);

    if (creature.energy <= 0 || creature.age >= config.maxLifespan) {
      creature.alive = false;
      recordDeath(world, creature);
      world.deaths += 1;
      aliveCount -= 1;
      continue;
    }

    if (creature.lastOutputs[OUTPUT_REPRODUCE] > REPRODUCE_OUTPUT_THRESHOLD) {
      const child = attemptReproduction(world, runtime, creature, i, aliveCount, rng);
      if (child !== null) {
        newborns.push(child);
        aliveCount += 1;
      }
    }
  }

  for (let i = 0; i < newborns.length; i++) world.creatures.push(newborns[i]);

  const regen = regenerateFood(
    rng,
    world.food,
    world.nextFoodId,
    world.foodRegenAccumulator,
    config,
    world.obstacles,
  );
  world.nextFoodId = regen.nextFoodId;
  world.foodRegenAccumulator = regen.accumulator;

  compactWorld(world);
  world.tick += 1;
  world.rng = rng.state();
}

/** Runs `ticks` full ticks. */
export function runTicks(world: WorldState, runtime: WorldRuntime, ticks: number): void {
  for (let t = 0; t < ticks; t++) stepWorld(world, runtime);
}

/**
 * Runs ticks until `deadlineMs` (from `now`) elapses, capped at `maxTicks`.
 * Used by the worker's per-frame time budget so slow devices degrade
 * gracefully. `now` is injected so the engine itself stays time-free.
 */
export function runWithBudget(
  world: WorldState,
  runtime: WorldRuntime,
  maxTicks: number,
  deadlineMs: number,
  now: () => number,
): number {
  let ticks = 0;
  while (ticks < maxTicks && now() < deadlineMs) {
    stepWorld(world, runtime);
    ticks++;
  }
  return ticks;
}
