import {
  PARAM_COUNT,
  TRAIT_RANGES,
  type TraitName,
} from "../constants";
import type { Creature, TraitHistogram } from "../types";
import type { Rng } from "../engine/prng";
import { TRAIT_NAMES, meanTrait, standardDeviation } from "../evolution/traits";

/** Euclidean distance between two genomes, normalised by sqrt(paramCount). */
export function genomeDistance(a: Float32Array, b: Float32Array): number {
  let sumSq = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq) / Math.sqrt(PARAM_COUNT);
}

/**
 * "Genome dispersion (sampled)": mean pairwise Euclidean genome distance over
 * a random sample of up to `sampleSize` living creatures, normalised by
 * sqrt(paramCount) so it is comparable across layout versions. This is a
 * dispersion estimate, not a population-genetics diversity measure.
 */
export function genomeDispersion(
  creatures: Creature[],
  sampleSize: number,
  rng: Rng,
): number {
  const n = creatures.length;
  if (n < 2) return 0;

  const sampleCount = Math.min(sampleSize, n);
  const indices = new Array<number>(n);
  for (let i = 0; i < n; i++) indices[i] = i;

  // Partial Fisher-Yates: choose sampleCount indices without replacement.
  for (let i = 0; i < sampleCount; i++) {
    const j = i + rng.nextInt(n - i);
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }

  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < sampleCount; i++) {
    const gi = creatures[indices[i]].genome;
    for (let j = i + 1; j < sampleCount; j++) {
      sum += genomeDistance(gi, creatures[indices[j]].genome);
      pairs++;
    }
  }
  return pairs > 0 ? sum / pairs : 0;
}

/** Per-trait mean over the living population. */
export function traitMeans(creatures: Creature[]): Record<TraitName, number> {
  const result = {} as Record<TraitName, number>;
  for (const name of TRAIT_NAMES) {
    result[name] = meanTrait(creatures.map((c) => c.traits[name]));
  }
  return result;
}

/** Per-trait standard deviation over the living population. */
export function traitStandardDeviations(creatures: Creature[]): Record<TraitName, number> {
  const result = {} as Record<TraitName, number>;
  for (const name of TRAIT_NAMES) {
    result[name] = standardDeviation(creatures.map((c) => c.traits[name]));
  }
  return result;
}

/**
 * Fixed-bin histograms over each trait's documented range. Bins never move
 * between samples, so charts are stable and comparable over time.
 */
export function traitHistograms(creatures: Creature[], bins: number): TraitHistogram[] {
  const histograms: TraitHistogram[] = [];
  for (const name of TRAIT_NAMES) {
    const { min, max } = TRAIT_RANGES[name];
    const counts = new Array<number>(bins).fill(0);
    for (const c of creatures) {
      const value = c.traits[name];
      let bin = Math.floor(((value - min) / (max - min)) * bins);
      if (bin < 0) bin = 0;
      if (bin >= bins) bin = bins - 1;
      counts[bin]++;
    }
    histograms.push({ trait: name, bins, min, max, counts });
  }
  return histograms;
}
