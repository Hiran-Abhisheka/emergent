import type { SimConfig } from "./config";

/** A 2D point/vector in world units. */
export interface Vec2 {
  x: number;
  y: number;
}

/** The four heritable traits. Each is clamped to its range (see constants). */
export interface Traits {
  /** Maximum movement speed in world units per tick. */
  maxSpeed: number;
  /** Perception radius in world units. */
  visionRange: number;
  /** Multiplies the whole metabolic cost. */
  metabolicMultiplier: number;
  /** Per-parameter mutation probability inherited by offspring. */
  mutationRate: number;
}

/** A food item. Food is a point with a unique, never-reused id. */
export interface Food {
  id: number;
  x: number;
  y: number;
  /** Set when consumed this tick; eaten food is compacted out at tick end. */
  eaten: boolean;
}

export interface CircleObstacle {
  id: number;
  kind: "circle";
  x: number;
  y: number;
  radius: number;
}

export interface RectObstacle {
  id: number;
  kind: "rect";
  /** Centre of the rectangle. */
  x: number;
  y: number;
  /** Full width and height (not half-extents). */
  width: number;
  height: number;
}

export type Obstacle = CircleObstacle | RectObstacle;

/** Serializable PRNG state (sfc32 keeps four 32-bit words). */
export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** A single creature and its own neural network. */
export interface Creature {
  id: number;
  x: number;
  y: number;
  /** Unit heading angle in radians, wrapped to [-π, π]. */
  heading: number;
  /** Current speed magnitude in world units per tick. */
  speed: number;
  energy: number;
  /** Age in ticks. */
  age: number;
  generation: number;
  alive: boolean;
  /** Ticks remaining before another reproduction attempt is allowed. */
  cooldown: number;
  /** Flat neural-network parameters, layout version GENOME_LAYOUT_VERSION. */
  genome: Float32Array;
  traits: Traits;
  /** Parent creature id; -1 for founders. */
  parentId: number;
  birthTick: number;
  /** Counts how much real food this creature has eaten (survives until death). */
  foodEaten: number;
  /** Telemetry from the last tick, for the inspector (not used by the engine). */
  lastInputs: Float32Array;
  lastHidden: Float32Array;
  lastOutputs: Float32Array;
}

/**
 * The complete authoritative simulation state. Everything needed to resume an
 * exact run is inside here (including the RNG state). Spatial grids are
 * derived/runtime caches and are intentionally NOT part of this state.
 */
export interface WorldState {
  tick: number;
  config: SimConfig;
  rng: RngState;
  creatures: Creature[];
  food: Food[];
  obstacles: Obstacle[];
  nextCreatureId: number;
  nextFoodId: number;
  /** Cumulative births since reset. */
  births: number;
  /** Cumulative deaths since reset (kept strictly separate from births). */
  deaths: number;
  /** Cumulative food items eaten since reset. */
  foodEatenTotal: number;
  /** Fractional accumulator for food regeneration. */
  foodRegenAccumulator: number;
  /**
   * Cumulative lifetime statistics for creatures that have already died,
   * indexed by generation. These are the honest inputs for "food eaten per
   * creature lifetime by generation bucket" (a living creature's total is
   * only a partial lifetime).
   */
  lifetimeFoodByGeneration: number[];
  lifetimeCountByGeneration: number[];
  lifetimeAgeByGeneration: number[];
}

/** Per-tick statistics emitted by the engine (all from real state). */
export interface StatsSample {
  tick: number;
  population: number;
  births: number;
  deaths: number;
  foodRemaining: number;
  meanEnergy: number;
  meanSpeedTrait: number;
  meanVisionTrait: number;
  meanGeneration: number;
  maxGeneration: number;
  /** Mean pairwise Euclidean genome distance / sqrt(paramCount), sampled. */
  genomeDispersion: number;
}

/** Histogram of one trait over the alive population. */
export interface TraitHistogram {
  trait: keyof Traits;
  bins: number;
  min: number;
  max: number;
  counts: number[];
}

/**
 * Completed-lifetime statistics for one generation bucket. Only creatures that
 * have already died contribute (exact, not sampled), so this is the honest
 * "food eaten per creature lifetime by generation bucket" view.
 */
export interface GenerationBucket {
  bucketStart: number;
  meanFoodEaten: number;
  meanLifespan: number;
  count: number;
}

/** Full metrics payload attached to a STATS event. */
export interface MetricsPayload {
  sample: StatsSample;
  histograms: TraitHistogram[];
  traitStandardDeviation: Record<keyof Traits, number>;
  /** Completed-lifetime means bucketed by generation (exact). */
  lifetimeByGeneration: GenerationBucket[];
}
