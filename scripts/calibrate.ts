/**
 * Headless calibration harness (build-spec section 9).
 *
 * Runs a configuration on N seeds for T ticks each and reports:
 *   - extinction count
 *   - fraction of sampled time pinned at the population cap
 *   - mean / final population
 *   - mean food eaten per COMPLETED lifetime, by generation bucket (exact;
 *     every death is recorded, so this is not survivor-biased)
 *
 * It also runs a mutation-off control (same seeds) and reports whether
 * foraging efficiency in later generations exceeds early generations, honestly
 * either way.
 *
 * Usage:
 *   npm run calibrate -- [--seeds=10] [--ticks=20000] [--bucket=3]
 *                       [--set=mutationProbability=0.01] [--set=foodRegenPerTick=0.4]
 */
import { DEFAULT_CONFIG, type SimConfig } from "../src/simulation/config";
import { createRuntime, createWorld } from "../src/simulation/engine/world";
import { runTicks } from "../src/simulation/engine/step";
import { STATS_INTERVAL_TICKS } from "../src/simulation/constants";
import {
  livingFoodRateByGenerationBucket,
  lifetimeFoodByGenerationBucket,
  type GenerationBucketStat,
} from "../src/simulation/metrics/collectors";

interface RunSummary {
  seed: number;
  extinct: boolean;
  capSamples: number;
  samples: number;
  populationSum: number;
  finalPopulation: number;
  maxGeneration: number;
  births: number;
  lifetime: GenerationBucketStat[];
  livingRate: { bucketStart: number; meanFoodPer1000Ticks: number; count: number }[];
  meanTraits: { maxSpeed: number; visionRange: number; metabolicMultiplier: number; mutationRate: number };
}

function meanTraitsOf(world: ReturnType<typeof createWorld>): RunSummary["meanTraits"] {
  const n = Math.max(world.creatures.length, 1);
  let speed = 0;
  let vision = 0;
  let metabolic = 0;
  let mutation = 0;
  for (const c of world.creatures) {
    speed += c.traits.maxSpeed;
    vision += c.traits.visionRange;
    metabolic += c.traits.metabolicMultiplier;
    mutation += c.traits.mutationRate;
  }
  return {
    maxSpeed: speed / n,
    visionRange: vision / n,
    metabolicMultiplier: metabolic / n,
    mutationRate: mutation / n,
  };
}

interface Options {
  seeds: number;
  ticks: number;
  bucket: number;
  overrides: Partial<SimConfig>;
  label: string;
}

function parseArgs(argv: string[]): Options {
  let seeds = 10;
  let ticks = 20000;
  let bucket = 3;
  const overrides: Partial<SimConfig> = {};
  let label = "default";
  for (const arg of argv) {
    const setMatch = /^--set=([A-Za-z]+)=(-?\d+(?:\.\d+)?)$/.exec(arg);
    if (setMatch) {
      const key = setMatch[1] as keyof SimConfig;
      if (key in DEFAULT_CONFIG && typeof DEFAULT_CONFIG[key] === "number") {
        (overrides as Record<string, number>)[key] = Number(setMatch[2]);
      }
      continue;
    }
    const m = /^--([a-z]+)=(.+)$/.exec(arg);
    if (!m) continue;
    if (m[1] === "seeds") seeds = Number(m[2]);
    else if (m[1] === "ticks") ticks = Number(m[2]);
    else if (m[1] === "bucket") bucket = Number(m[2]);
    else if (m[1] === "label") label = m[2];
  }
  return { seeds, ticks, bucket, overrides, label };
}

function runOne(seed: number, ticks: number, bucketSize: number, config: SimConfig): RunSummary {
  const world = createWorld({ ...config, seed });
  const runtime = createRuntime(world);

  let capSamples = 0;
  let samples = 0;
  let populationSum = 0;
  let maxGeneration = 0;

  for (let t = 0; t < ticks; t += STATS_INTERVAL_TICKS) {
    runTicks(world, runtime, Math.min(STATS_INTERVAL_TICKS, ticks - t));
    const population = world.creatures.length;
    samples++;
    populationSum += population;
    if (population >= world.config.maxPopulation) capSamples++;
    for (const c of world.creatures) if (c.generation > maxGeneration) maxGeneration = c.generation;
  }

  return {
    seed,
    extinct: world.creatures.length === 0,
    capSamples,
    samples,
    populationSum,
    finalPopulation: world.creatures.length,
    maxGeneration,
    births: world.births,
    lifetime: lifetimeFoodByGenerationBucket(world, bucketSize),
    livingRate: livingFoodRateByGenerationBucket(world, bucketSize),
    meanTraits: meanTraitsOf(world),
  };
}

function mergeLifetime(runs: RunSummary[]): GenerationBucketStat[] {
  const merged = new Map<number, { food: number; age: number; count: number }>();
  for (const run of runs) {
    for (const b of run.lifetime) {
      const t = merged.get(b.bucketStart) ?? { food: 0, age: 0, count: 0 };
      t.food += b.meanFoodEaten * b.count;
      t.age += b.meanLifespan * b.count;
      t.count += b.count;
      merged.set(b.bucketStart, t);
    }
  }
  return [...merged.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, t]) => ({
      bucketStart,
      meanFoodEaten: t.count > 0 ? t.food / t.count : 0,
      meanLifespan: t.count > 0 ? t.age / t.count : 0,
      count: t.count,
    }));
}

function reportTable(label: string, runs: RunSummary[]): void {
  const totalSamples = runs.reduce((s, r) => s + r.samples, 0);
  const totalCap = runs.reduce((s, r) => s + r.capSamples, 0);
  const totalPop = runs.reduce((s, r) => s + r.populationSum, 0);
  const extinctions = runs.filter((r) => r.extinct).length;

  console.log(`\n=== ${label} ===`);
  console.log(`extinction count        : ${extinctions}/${runs.length}`);
  console.log(
    `time pinned at cap      : ${((totalCap / Math.max(totalSamples, 1)) * 100).toFixed(1)}%`,
  );
  console.log(`mean population         : ${(totalPop / Math.max(totalSamples, 1)).toFixed(1)}`);
  const meanFinal = runs.reduce((s, r) => s + r.finalPopulation, 0) / runs.length;
  const meanMaxGen = runs.reduce((s, r) => s + r.maxGeneration, 0) / runs.length;
  const meanBirths = runs.reduce((s, r) => s + r.births, 0) / runs.length;
  console.log(`mean final population   : ${meanFinal.toFixed(1)}`);
  console.log(`mean max generation     : ${meanMaxGen.toFixed(1)}`);
  console.log(`mean cumulative births  : ${meanBirths.toFixed(0)}`);
  const avg = (sel: (r: RunSummary) => number): number =>
    runs.reduce((s, r) => s + sel(r), 0) / runs.length;
  console.log(
    `mean final traits       : speed ${avg((r) => r.meanTraits.maxSpeed).toFixed(3)}, vision ${avg((r) => r.meanTraits.visionRange).toFixed(1)}, metabolic ${avg((r) => r.meanTraits.metabolicMultiplier).toFixed(3)}, mutRate ${avg((r) => r.meanTraits.mutationRate).toFixed(4)}`,
  );

  console.log(`\n${label} — food eaten per COMPLETED lifetime by generation bucket`);
  console.log("   gen   meanFood   meanLife   rate/1kt   deaths");
  for (const b of mergeLifetime(runs)) {
    const rate = b.meanLifespan > 0 ? (b.meanFoodEaten / b.meanLifespan) * 1000 : 0;
    console.log(
      `  ${String(b.bucketStart).padStart(4)}   ${b.meanFoodEaten.toFixed(2).padStart(8)}   ${b.meanLifespan.toFixed(0).padStart(8)}   ${rate.toFixed(2).padStart(8)}   ${String(b.count).padStart(6)}`,
    );
  }
}

/** Food eaten per 1000 ticks of completed life, per generation bucket. */
function lifetimeRate(b: GenerationBucketStat): number {
  return b.meanLifespan > 0 ? (b.meanFoodEaten / b.meanLifespan) * 1000 : 0;
}

function evolutionDelta(
  runs: RunSummary[],
  minCount: number,
): { early: number; later: number; earlyGen: number; laterGen: number; delta: number } {
  const buckets = mergeLifetime(runs);
  const usable = buckets.filter((b) => b.count >= minCount);
  const pool = usable.length >= 2 ? usable : buckets;
  if (pool.length < 2) return { early: 0, later: 0, earlyGen: 0, laterGen: 0, delta: 0 };
  const early = pool[0];
  const later = pool[pool.length - 1];
  const earlyRate = lifetimeRate(early);
  const laterRate = lifetimeRate(later);
  return {
    early: earlyRate,
    later: laterRate,
    earlyGen: early.bucketStart,
    laterGen: later.bucketStart,
    delta: laterRate - earlyRate,
  };
}

function main(): void {
  const opts = parseArgs(process.argv.slice(2));
  const base: SimConfig = { ...DEFAULT_CONFIG, ...opts.overrides };
  console.log(
    `Emergent calibration — ${opts.seeds} seeds x ${opts.ticks} ticks (bucket ${opts.bucket}) label=${opts.label}`,
  );
  console.log(`overrides: ${JSON.stringify(opts.overrides)}`);

  const seedList = Array.from({ length: opts.seeds }, (_, i) => DEFAULT_CONFIG.seed + i * 1013);
  const started = Date.now();

  const defaultRuns: RunSummary[] = [];
  for (const seed of seedList) {
    const t0 = Date.now();
    const run = runOne(seed, opts.ticks, opts.bucket, base);
    defaultRuns.push(run);
    console.log(
      `  seed ${seed}: pop ${run.finalPopulation}, maxGen ${run.maxGeneration}, births ${run.births}, extinct ${run.extinct}, ${Date.now() - t0}ms`,
    );
  }

  const mutationOff: SimConfig = { ...base, mutationStrength: 0, traitMutationStrength: 0 };
  const controlRuns: RunSummary[] = [];
  for (const seed of seedList) controlRuns.push(runOne(seed, opts.ticks, opts.bucket, mutationOff));

  reportTable("mutation on", defaultRuns);
  reportTable("mutation off (control)", controlRuns);

  // A bucket needs a reasonable number of completed lifetimes to be trusted.
  const totalLifetimes = mergeLifetime(defaultRuns).reduce((s, b) => s + b.count, 0);
  const minCount = Math.max(30, Math.floor(totalLifetimes * 0.002));
  const dOn = evolutionDelta(defaultRuns, minCount);
  const dOff = evolutionDelta(controlRuns, minCount);

  console.log(`\n=== evolution check: lifetime food intake RATE (food/1000t), later vs early generation (min ${minCount} deaths/bucket) ===`);
  console.log(
    `mutation on  : gen ${dOn.earlyGen} ${dOn.early.toFixed(2)} -> gen ${dOn.laterGen} ${dOn.later.toFixed(2)} (delta ${dOn.delta >= 0 ? "+" : ""}${dOn.delta.toFixed(2)})`,
  );
  console.log(
    `mutation off : gen ${dOff.earlyGen} ${dOff.early.toFixed(2)} -> gen ${dOff.laterGen} ${dOff.later.toFixed(2)} (delta ${dOff.delta >= 0 ? "+" : ""}${dOff.delta.toFixed(2)})`,
  );
  const meanPopOn = defaultRuns.reduce((s, r) => s + r.populationSum, 0) / defaultRuns.reduce((s, r) => s + r.samples, 0);
  const meanPopOff = controlRuns.reduce((s, r) => s + r.populationSum, 0) / controlRuns.reduce((s, r) => s + r.samples, 0);
  console.log(
    `supporting evidence: mean population ${meanPopOn.toFixed(1)} (on) vs ${meanPopOff.toFixed(1)} (off); extinctions ${defaultRuns.filter((r) => r.extinct).length} vs ${controlRuns.filter((r) => r.extinct).length}`,
  );
  console.log(
    dOn.delta > dOff.delta
      ? "VERDICT: mutation-on improves the lifetime intake rate more than the control (consistent with selection)."
      : "VERDICT: no clear improvement in intake rate over the control on these settings.",
  );

  console.log(`\ntotal wall time: ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main();
