import { FLOAT_EPSILON } from "./constants";

/**
 * Full simulation configuration. This is the single source of truth for all
 * tunable values. A copy of it is stored inside the world state and therefore
 * travels with every saved state and every experiment record.
 */
export interface SimConfig {
  /** PRNG seed. Changing it starts a new run (requires reset). */
  seed: number;

  // Population -------------------------------------------------------------
  /** Founders spawned at reset. Requires reset. */
  initialPopulation: number;
  /** Hard cap; reproduction is refused when reached. Applies live. */
  maxPopulation: number;

  // Food -------------------------------------------------------------------
  /** Food items present at reset. Requires reset. */
  initialFood: number;
  /** Upper bound on food items. Applies live. */
  maxFood: number;
  /** Expected new food items per tick (fractional, accumulated). Applies live. */
  foodRegenPerTick: number;
  /** Energy gained by eating one food item. Applies live. */
  foodEnergy: number;
  /** Number of food clusters in the patchy initial distribution. Requires reset. */
  foodClusterCount: number;
  /** Radius of each food cluster. Requires reset. */
  foodClusterRadius: number;
  /** Fraction of food placed uniformly (the rest is clustered). Requires reset. */
  foodBackgroundFraction: number;

  // Creature baseline ------------------------------------------------------
  /** Visual/collision radius in world units. Applies live. */
  creatureRadius: number;
  /** Energy at reset for founders. Requires reset. */
  initialEnergy: number;
  /** Energy ceiling. Applies live. */
  maxEnergy: number;
  /** Turns remaining after reproducing. Applies live. */
  reproductionCooldown: number;
  /** Base maximum lifespan in ticks. Applies live. */
  maxLifespan: number;

  // Energy model baselines (traits vary around these) ----------------------
  /** Idle upkeep per tick. Applies live. */
  basalCost: number;
  /** Extra cost per tick at `baseMaxSpeed`, scaling with speed². Applies live. */
  moveCost: number;
  /** Extra cost per tick at `baseVisionRange`, scaling linearly. Applies live. */
  visionCost: number;
  /** Global movement-speed baseline traits vary around. Applies live. */
  baseMaxSpeed: number;
  /** Global vision-range baseline traits vary around. Applies live. */
  baseVisionRange: number;
  /** Maximum turn rate in radians per tick at full turn output. Applies live. */
  maxTurnRate: number;

  // Reproduction -----------------------------------------------------------
  /** Energy required to attempt reproduction. Applies live. */
  reproductionThreshold: number;
  /** Energy the parent pays. Applies live. */
  reproductionCost: number;
  /** Energy the offspring starts with. Applies live. */
  offspringEnergy: number;

  // Mutation ---------------------------------------------------------------
  /** Per-parameter mutation probability. Applies live. */
  mutationProbability: number;
  /** Gaussian std applied to a mutated parameter. Applies live. */
  mutationStrength: number;
  /** Multiplicative std applied to a mutated trait. Applies live. */
  traitMutationStrength: number;
}

/** Default configuration (build-spec section 3 starting points). */
export const DEFAULT_CONFIG: SimConfig = {
  seed: 12345,

  initialPopulation: 100,
  maxPopulation: 400,

  initialFood: 250,
  maxFood: 500,
  foodRegenPerTick: 0.6,
  foodEnergy: 30,
  foodClusterCount: 6,
  foodClusterRadius: 120,
  foodBackgroundFraction: 0.35,

  creatureRadius: 5,
  initialEnergy: 70,
  maxEnergy: 100,
  reproductionCooldown: 150,
  maxLifespan: 3000,

  basalCost: 0.02,
  moveCost: 0.06,
  visionCost: 0.02,
  baseMaxSpeed: 1.5,
  baseVisionRange: 120,
  maxTurnRate: 0.16,

  reproductionThreshold: 90,
  reproductionCost: 50,
  offspringEnergy: 40,

  mutationProbability: 0.02,
  mutationStrength: 0.15,
  traitMutationStrength: 0.05,
};

/**
 * Numeric bounds used for validation. Values are inclusive. `max` is the hard
 * engine limit; the honoured max is `min(config.maxPopulation, MAX_POPULATION)`.
 */
export const CONFIG_LIMITS = {
  initialPopulation: { min: 1, max: 400 },
  maxPopulation: { min: 1, max: 2000 },
  initialFood: { min: 0, max: 5000 },
  maxFood: { min: 0, max: 5000 },
  foodRegenPerTick: { min: 0, max: 200 },
  foodEnergy: { min: 1, max: 500 },
  foodClusterCount: { min: 0, max: 64 },
  foodClusterRadius: { min: 10, max: 1000 },
  foodBackgroundFraction: { min: 0, max: 1 },
  creatureRadius: { min: 1, max: 50 },
  initialEnergy: { min: 1, max: 1000 },
  maxEnergy: { min: 1, max: 5000 },
  reproductionCooldown: { min: 0, max: 100000 },
  maxLifespan: { min: 1, max: 1_000_000 },
  basalCost: { min: 0, max: 10 },
  moveCost: { min: 0, max: 100 },
  visionCost: { min: 0, max: 100 },
  baseMaxSpeed: { min: 0.1, max: 20 },
  baseVisionRange: { min: 5, max: 2000 },
  maxTurnRate: { min: 0, max: Math.PI },
  reproductionThreshold: { min: 1, max: 5000 },
  reproductionCost: { min: 0, max: 5000 },
  offspringEnergy: { min: 0, max: 5000 },
  mutationProbability: { min: 0, max: 1 },
  mutationStrength: { min: 0, max: 10 },
  traitMutationStrength: { min: 0, max: 2 },
} as const satisfies Record<Exclude<keyof SimConfig, "seed">, { min: number; max: number }>;

/** Numeric config keys (everything except the seed). */
export type NumericConfigKey = Exclude<keyof SimConfig, "seed">;

/**
 * Settings that take effect immediately on the running world. All others
 * require a RESET (they only apply at world creation). The UI reads this to
 * label each control.
 */
export const LIVE_CONFIG_KEYS: ReadonlySet<keyof SimConfig> = new Set<keyof SimConfig>([
  "maxPopulation",
  "maxFood",
  "foodRegenPerTick",
  "foodEnergy",
  "creatureRadius",
  "maxEnergy",
  "reproductionCooldown",
  "maxLifespan",
  "basalCost",
  "moveCost",
  "visionCost",
  "baseMaxSpeed",
  "baseVisionRange",
  "maxTurnRate",
  "reproductionThreshold",
  "reproductionCost",
  "offspringEnergy",
  "mutationProbability",
  "mutationStrength",
  "traitMutationStrength",
]);

export function configKeyAppliesLive(key: keyof SimConfig): boolean {
  return LIVE_CONFIG_KEYS.has(key);
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof SimConfig, string>>;
}

function checkNumeric(key: NumericConfigKey, value: number, errors: ConfigValidationResult["errors"]): void {
  const limit = CONFIG_LIMITS[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors[key] = `${key} must be a finite number`;
    return;
  }
  if (value < limit.min - FLOAT_EPSILON || value > limit.max + FLOAT_EPSILON) {
    errors[key] = `${key} must be between ${limit.min} and ${limit.max}`;
  }
}

/**
 * Validates a configuration. Returns every problem found so the UI can show
 * inline messages instead of throwing. Never throws for range issues.
 */
export function validateConfig(config: SimConfig): ConfigValidationResult {
  const errors: ConfigValidationResult["errors"] = {};

  if (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff) {
    errors.seed = "seed must be an integer in [0, 4294967295]";
  }

  for (const key of Object.keys(CONFIG_LIMITS) as NumericConfigKey[]) {
    checkNumeric(key, config[key], errors);
  }

  if (
    config.maxPopulation < config.initialPopulation &&
    errors.maxPopulation === undefined &&
    errors.initialPopulation === undefined
  ) {
    errors.maxPopulation = "maxPopulation must be at least initialPopulation";
  }
  if (
    config.maxFood < config.initialFood &&
    errors.maxFood === undefined &&
    errors.initialFood === undefined
  ) {
    errors.maxFood = "maxFood must be at least initialFood";
  }
  if (
    config.maxEnergy < config.initialEnergy &&
    errors.maxEnergy === undefined &&
    errors.initialEnergy === undefined
  ) {
    errors.maxEnergy = "maxEnergy must be at least initialEnergy";
  }
  if (
    config.offspringEnergy > config.maxEnergy &&
    errors.offspringEnergy === undefined &&
    errors.maxEnergy === undefined
  ) {
    errors.offspringEnergy = "offspringEnergy must not exceed maxEnergy";
  }
  if (
    config.reproductionThreshold > config.maxEnergy &&
    errors.reproductionThreshold === undefined &&
    errors.maxEnergy === undefined
  ) {
    errors.reproductionThreshold = "reproductionThreshold must not exceed maxEnergy";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/** True when the config is internally consistent. */
export function isValidConfig(config: SimConfig): boolean {
  return validateConfig(config).valid;
}

/** Immutable copy (configs are small and compared by value in tests). */
export function cloneConfig(config: SimConfig): SimConfig {
  return { ...config };
}

/** Returns a copy of the config with one numeric field replaced. */
export function withConfigValue(config: SimConfig, key: NumericConfigKey, value: number): SimConfig {
  const next: SimConfig = { ...config };
  next[key] = value;
  return next;
}
