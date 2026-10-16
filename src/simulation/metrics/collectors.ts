import { DISPERSION_SAMPLE_SIZE, GENERATION_BUCKET_SIZE } from "../constants";
import type {
  GenerationBucket,
  MetricsPayload,
  StatsSample,
  WorldState,
} from "../types";
import type { WorldRuntime } from "../engine/world";
import { genomeDispersion, traitHistograms, traitStandardDeviations } from "./diversity";

/** Number of histogram bins per trait (fixed, so charts stay comparable). */
export const TRAIT_HISTOGRAM_BINS = 12;

/**
 * One real statistics sample. Every field is derived from current world state
 * (no interpolation, no fabrication). Population is instantaneous; births and
 * deaths are separate cumulative counters.
 */
export function collectStats(world: WorldState, runtime: WorldRuntime): StatsSample {
  const alive = world.creatures;
  const population = alive.length;

  let energySum = 0;
  let speedSum = 0;
  let visionSum = 0;
  let generationSum = 0;
  let maxGeneration = 0;
  for (const c of alive) {
    energySum += c.energy;
    speedSum += c.traits.maxSpeed;
    visionSum += c.traits.visionRange;
    generationSum += c.generation;
    if (c.generation > maxGeneration) maxGeneration = c.generation;
  }

  return {
    tick: world.tick,
    population,
    births: world.births,
    deaths: world.deaths,
    foodRemaining: world.food.length,
    meanEnergy: population > 0 ? energySum / population : 0,
    meanSpeedTrait: population > 0 ? speedSum / population : 0,
    meanVisionTrait: population > 0 ? visionSum / population : 0,
    meanGeneration: population > 0 ? generationSum / population : 0,
    maxGeneration,
    genomeDispersion: genomeDispersion(alive, DISPERSION_SAMPLE_SIZE, runtime.metricsRng),
  };
}

/** Stats sample plus histograms, per-trait standard deviations and lifetime buckets. */
export function collectMetrics(world: WorldState, runtime: WorldRuntime): MetricsPayload {
  const alive = world.creatures;
  return {
    sample: collectStats(world, runtime),
    histograms: traitHistograms(alive, TRAIT_HISTOGRAM_BINS),
    traitStandardDeviation: traitStandardDeviations(alive),
    lifetimeByGeneration: lifetimeFoodByGenerationBucket(world, GENERATION_BUCKET_SIZE),
  };
}

/** Completed-lifetime statistics for one generation bucket. */
export type GenerationBucketStat = GenerationBucket;

/**
 * Mean food eaten per *completed* lifetime, bucketed by generation. Uses the
 * per-generation lifetime accumulators, so it is exact (every death is
 * recorded) and not biased by still-living creatures. This is the honest
 * "food eaten per creature lifetime by generation bucket" metric.
 */
export function lifetimeFoodByGenerationBucket(
  world: WorldState,
  bucketSize: number,
): GenerationBucketStat[] {
  const buckets = new Map<number, { food: number; age: number; count: number }>();
  for (let g = 0; g < world.lifetimeCountByGeneration.length; g++) {
    const count = world.lifetimeCountByGeneration[g];
    if (count === 0) continue;
    const start = Math.floor(g / bucketSize) * bucketSize;
    const b = buckets.get(start) ?? { food: 0, age: 0, count: 0 };
    b.food += world.lifetimeFoodByGeneration[g];
    b.age += world.lifetimeAgeByGeneration[g];
    b.count += count;
    buckets.set(start, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, b]) => ({
      bucketStart,
      meanFoodEaten: b.count > 0 ? b.food / b.count : 0,
      meanLifespan: b.count > 0 ? b.age / b.count : 0,
      count: b.count,
    }));
}

export interface LivingRateStat {
  bucketStart: number;
  /** Mean food eaten per 1000 ticks of life for currently-living creatures. */
  meanFoodPer1000Ticks: number;
  count: number;
}

/**
 * Diagnostic only: food eaten per 1000 ticks of life for the *living*
 * population, by generation bucket. This is a partial-lifetime rate and is
 * confounded by competition and survivorship; prefer the lifetime metric.
 */
export function livingFoodRateByGenerationBucket(
  world: WorldState,
  bucketSize: number,
): LivingRateStat[] {
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const c of world.creatures) {
    const start = Math.floor(c.generation / bucketSize) * bucketSize;
    const b = buckets.get(start) ?? { sum: 0, count: 0 };
    b.sum += (c.foodEaten / Math.max(c.age, 1)) * 1000;
    b.count += 1;
    buckets.set(start, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, b]) => ({
      bucketStart,
      meanFoodPer1000Ticks: b.count > 0 ? b.sum / b.count : 0,
      count: b.count,
    }));
}
