import { FOUNDER_TRAIT_SPREAD, METABOLIC_BASELINE, TRAIT_RANGES, type TraitName } from "../constants";
import type { Rng } from "../engine/prng";
import type { SimConfig } from "../config";
import type { Traits } from "../types";

export const TRAIT_NAMES: readonly TraitName[] = [
  "maxSpeed",
  "visionRange",
  "metabolicMultiplier",
  "mutationRate",
];

/** Clamp one trait to its documented range. */
export function clampTrait(name: TraitName, value: number): number {
  const { min, max } = TRAIT_RANGES[name];
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Clamp every field of a traits object to its range. */
export function clampTraits(traits: Traits): Traits {
  return {
    maxSpeed: clampTrait("maxSpeed", traits.maxSpeed),
    visionRange: clampTrait("visionRange", traits.visionRange),
    metabolicMultiplier: clampTrait("metabolicMultiplier", traits.metabolicMultiplier),
    mutationRate: clampTrait("mutationRate", traits.mutationRate),
  };
}

/**
 * Founder traits: each is drawn multiplicatively around its global baseline
 * with a small documented spread, then clamped. All founders use the same
 * prior, so trait variance at tick 0 is only the prior's spread.
 */
export function createFounderTraits(rng: Rng, config: SimConfig): Traits {
  return clampTraits({
    maxSpeed: config.baseMaxSpeed * (1 + rng.nextGaussian() * FOUNDER_TRAIT_SPREAD),
    visionRange: config.baseVisionRange * (1 + rng.nextGaussian() * FOUNDER_TRAIT_SPREAD),
    metabolicMultiplier: METABOLIC_BASELINE * (1 + rng.nextGaussian() * FOUNDER_TRAIT_SPREAD),
    mutationRate: config.mutationProbability * (1 + rng.nextGaussian() * FOUNDER_TRAIT_SPREAD),
  });
}

export function cloneTraits(traits: Traits): Traits {
  return { ...traits };
}

/**
 * Mutates traits in place, multiplicatively, using a log-normal step
 * (value * exp(Normal(0, strength))) so traits can never flip sign, then
 * clamps to range. `strength` is the config trait-mutation std.
 */
export function mutateTraitsInPlace(traits: Traits, rng: Rng, strength: number): void {
  for (const name of TRAIT_NAMES) {
    const mutated = traits[name] * Math.exp(rng.nextNormal(0, strength));
    traits[name] = clampTrait(name, mutated);
  }
}

export function meanTrait(traits: number[]): number {
  if (traits.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < traits.length; i++) sum += traits[i];
  return sum / traits.length;
}

export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = meanTrait(values);
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const d = values[i] - mean;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / values.length);
}
