import { clamp } from "./geometry";
import type { SimConfig } from "../config";
import type { Creature } from "../types";

/**
 * Per-tick metabolic cost.
 *
 *   cost = ( basal
 *          + moveCost  * (speed / baseMaxSpeed)²
 *          + visionCost * (visionRange / baseVisionRange) )
 *          * metabolicMultiplier
 *
 * The denominators are the GLOBAL baselines from the config, not the
 * creature's own traits. This is deliberate (see docs/DECISIONS.md D-105):
 * normalising speed by the creature's own maxSpeed would make a fast creature
 * pay exactly the same as a slow one, so the speed trait would have no cost.
 * Measuring against the baseline makes faster/farther-seeing creatures pay
 * more, which is what lets selection act on those traits.
 */
export function metabolicCost(creature: Creature, config: SimConfig): number {
  const speedRatio = creature.speed / config.baseMaxSpeed;
  const visionRatio = creature.traits.visionRange / config.baseVisionRange;
  const core = config.basalCost + config.moveCost * speedRatio * speedRatio + config.visionCost * visionRatio;
  return core * creature.traits.metabolicMultiplier;
}

/** Subtracts the metabolic cost for this tick and clamps energy to [0, max]. */
export function applyMetabolicCost(creature: Creature, config: SimConfig): void {
  creature.energy = clamp(creature.energy - metabolicCost(creature, config), 0, config.maxEnergy);
}

/** Adds energy from food and clamps to the ceiling. */
export function addEnergy(creature: Creature, amount: number, config: SimConfig): void {
  creature.energy = clamp(creature.energy + amount, 0, config.maxEnergy);
}
