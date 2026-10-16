/**
 * Named constants for the Emergent simulation engine.
 *
 * Every magic number in the engine lives here. Values marked "tunable" are
 * starting points from the build spec and are validated/adjusted by
 * `scripts/calibrate.ts` (see docs/DECISIONS.md for tuning history).
 */

/** World size in simulation units (not pixels). */
export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 800;

/** Fixed simulation rate. The engine always steps in whole ticks. */
export const TICKS_PER_SECOND = 30;

// ---------------------------------------------------------------------------
// Neural network layout (versioned so saved genomes stay readable).
// ---------------------------------------------------------------------------

/** Bump when the *meaning* of the parameter array changes. */
export const GENOME_LAYOUT_VERSION = 1;

export const INPUT_COUNT = 8;
export const HIDDEN_COUNT = 12;
export const OUTPUT_COUNT = 4;

/** I*H + H + H*O + O = 8*12 + 12 + 12*4 + 4 = 160. */
export const PARAM_COUNT =
  INPUT_COUNT * HIDDEN_COUNT + HIDDEN_COUNT + HIDDEN_COUNT * OUTPUT_COUNT + OUTPUT_COUNT;

/** Output indices used by the step loop. */
export const OUTPUT_TURN_LEFT = 0;
export const OUTPUT_TURN_RIGHT = 1;
export const OUTPUT_THRUST = 2;
export const OUTPUT_REPRODUCE = 3;

/** A reproduction output above this value counts as an attempt. */
export const REPRODUCE_OUTPUT_THRESHOLD = 0.5;

/** Human-readable sensor names, in input-vector order. */
export const SENSOR_NAMES = [
  "energy",
  "food proximity",
  "food bearing",
  "food visible",
  "obstacle proximity",
  "obstacle bearing",
  "previous speed",
  "food density",
] as const;

/** Sensor indices, so the renderer/inspector never hard-code offsets. */
export const SENSOR_ENERGY = 0;
export const SENSOR_FOOD_PROXIMITY = 1;
export const SENSOR_FOOD_BEARING = 2;
export const SENSOR_FOOD_VISIBLE = 3;
export const SENSOR_OBSTACLE_PROXIMITY = 4;
export const SENSOR_OBSTACLE_BEARING = 5;
export const SENSOR_PREVIOUS_SPEED = 6;
export const SENSOR_FOOD_DENSITY = 7;

/** Human-readable output names, in output-vector order. */
export const OUTPUT_NAMES = ["turn left", "turn right", "thrust", "reproduce"] as const;

/** Squared error tolerance for float comparisons in tests. */
export const FLOAT_EPSILON = 1e-6;

// ---------------------------------------------------------------------------
// Founder initialisation prior (identical for every founder).
// A documented prior, NOT reward shaping: creatures are never rewarded for
// approaching food, only their sensors expose the world to them.
// ---------------------------------------------------------------------------

export const FOUNDER_WEIGHT_STD_HIDDEN = 1 / Math.sqrt(INPUT_COUNT); // ≈ 0.3536
export const FOUNDER_WEIGHT_STD_OUTPUT = 1 / Math.sqrt(HIDDEN_COUNT); // ≈ 0.2887

/** Hidden-layer bias prior (small positive jitter, keeps hidden units awake). */
export const FOUNDER_HIDDEN_BIAS_STD = 0.05;

/**
 * Output bias prior. A positive thrust bias makes a fresh random net drift
 * forward instead of sitting still, which is required for any selection to
 * happen at all. Turn/reproduce biases stay at 0 so motion is undirected.
 * tanh(0.75) ≈ 0.635 -> founders move at ≈ 63% of max speed.
 */
export const FOUNDER_THRUST_BIAS = 0.75;
export const FOUNDER_TURN_BIAS = 0;
export const FOUNDER_REPRODUCE_BIAS = 0;

/** Founder traits are drawn around the config baselines with this spread. */
export const FOUNDER_TRAIT_SPREAD = 0.15;

/** Baseline metabolic multiplier that founder creatures are drawn around. */
export const METABOLIC_BASELINE = 1.0;

// ---------------------------------------------------------------------------
// Trait ranges. Every trait is clamped to its documented range. Each
// beneficial trait carries a real metabolic cost (see engine/energy.ts).
// ---------------------------------------------------------------------------

export const TRAIT_RANGES = {
  maxSpeed: { min: 0.5, max: 4.0 },
  visionRange: { min: 40, max: 320 },
  metabolicMultiplier: { min: 0.5, max: 2.0 },
  mutationRate: { min: 0.005, max: 0.1 },
} as const;

export type TraitName = keyof typeof TRAIT_RANGES;

// ---------------------------------------------------------------------------
// Movement / sensing geometry.
// ---------------------------------------------------------------------------

/** Creatures slower than this are treated as stopped (avoids sensor noise). */
export const STOP_SPEED_EPSILON = 1e-4;

/** Food is a point; this is its visual/consumption radius in world units. */
export const FOOD_RADIUS = 3;

/** Sensor 8 counts food within vision; this saturates the normalisation. */
export const FOOD_DENSITY_SATURATION = 5;

/** Max spawn offset when placing an offspring near its parent. */
export const OFFSPRING_SPAWN_RADIUS = 14;

/** Number of deterministic placement attempts before giving up. */
export const OFFSPRING_PLACEMENT_ATTEMPTS = 8;

// ---------------------------------------------------------------------------
// Movement.
// ---------------------------------------------------------------------------

/** Speed blends toward the thrust target by this factor each tick (0..1). */
export const MOVEMENT_SMOOTHING = 0.35;

// ---------------------------------------------------------------------------
// World generation.
// ---------------------------------------------------------------------------

/** Obstacles generated at reset. */
export const OBSTACLE_COUNT = 6;
export const OBSTACLE_MIN_RADIUS = 28;
export const OBSTACLE_MAX_RADIUS = 64;
export const OBSTACLE_RECT_MIN_SIDE = 60;
export const OBSTACLE_RECT_MAX_SIDE = 150;
/** Obstacles are kept this far from every wall. */
export const OBSTACLE_BORDER_MARGIN = 40;
/** Minimum gap between two obstacles (centre to centre, minus radii). */
export const OBSTACLE_MIN_SEPARATION = 30;
export const OBSTACLE_PLACEMENT_ATTEMPTS = 60;

/** Food and creature spawns are kept this far inside the walls. */
export const SPAWN_BORDER_MARGIN = 24;
/** Creature spawns are rejected if closer than this multiple of the radius. */
export const CREATURE_SPAWN_SEPARATION_FACTOR = 2.4;
export const CREATURE_SPAWN_ATTEMPTS = 40;
/** Food is rejected if it lands inside an obstacle (plus this padding). */
export const FOOD_OBSTACLE_PADDING = 6;
export const FOOD_PLACEMENT_ATTEMPTS = 20;

// ---------------------------------------------------------------------------
// Spatial grid.
// ---------------------------------------------------------------------------

/** Cell size for the uniform spatial grid (≈ 2× typical vision range). */
export const GRID_CELL_SIZE = 64;

// ---------------------------------------------------------------------------
// Persistence / protocol.
// ---------------------------------------------------------------------------

export const SNAPSHOT_INTERVAL_TICKS = 1;
export const STATS_INTERVAL_TICKS = 30;
export const INSPECTION_INTERVAL_TICKS = 3;

/** Snapshot stride: x, y, heading, energy, flags, colorValue. */
export const SNAPSHOT_STRIDE = 6;

/**
 * Stats history ring buffer capacity. Stats are emitted every
 * `STATS_INTERVAL_TICKS`, i.e. once per second at `TICKS_PER_SECOND`, so this
 * holds ≈ 66 minutes of history.
 */
export const METRICS_HISTORY_CAPACITY = 4000;

/** Genome dispersion is estimated from at most this many creatures. */
export const DISPERSION_SAMPLE_SIZE = 50;

/** Lifetime statistics are aggregated into generation buckets of this width. */
export const GENERATION_BUCKET_SIZE = 5;

export const ENGINE_VERSION = "0.1.0";
export const SCHEMA_VERSION = 1;
