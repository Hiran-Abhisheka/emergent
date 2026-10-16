import type { NumericConfigKey, SimConfig } from "@/simulation/config";

/** Presentation metadata for one numeric config field. */
export interface ConfigFieldMeta {
  key: NumericConfigKey;
  label: string;
  /** One-line description shown under the label / in a tooltip. */
  hint: string;
  /** Suggested input step (does not constrain validation). */
  step: number;
  /** Integer-only fields (counts, seeds, cooldowns). */
  integer?: boolean;
  unit?: string;
}

export interface ConfigGroup {
  id: string;
  title: string;
  fields: ConfigFieldMeta[];
}

/**
 * Every numeric config key, grouped for the Environment panel. The order here
 * is the order shown in the UI. Nothing is omitted: the panel is a complete
 * editor for `SimConfig` (only `seed` is handled separately).
 */
export const CONFIG_GROUPS: readonly ConfigGroup[] = [
  {
    id: "run",
    title: "Run",
    fields: [
      {
        key: "initialPopulation",
        label: "Founders",
        hint: "Creatures spawned at reset.",
        step: 1,
        integer: true,
      },
      { key: "maxPopulation", label: "Population cap", hint: "Reproduction stops at this count.", step: 1, integer: true },
    ],
  },
  {
    id: "food",
    title: "Food",
    fields: [
      { key: "initialFood", label: "Initial food", hint: "Food items placed at reset.", step: 1, integer: true },
      { key: "maxFood", label: "Food cap", hint: "Upper bound on food items.", step: 1, integer: true },
      {
        key: "foodRegenPerTick",
        label: "Regeneration",
        hint: "Expected new food per tick (fractional).",
        step: 0.05,
        unit: "/tick",
      },
      { key: "foodEnergy", label: "Food energy", hint: "Energy gained per food item.", step: 1 },
      { key: "foodClusterCount", label: "Clusters", hint: "Patches in the initial distribution.", step: 1, integer: true },
      { key: "foodClusterRadius", label: "Cluster radius", hint: "Radius of each patch.", step: 5 },
      {
        key: "foodBackgroundFraction",
        label: "Scattered share",
        hint: "Fraction placed uniformly (rest is clustered).",
        step: 0.05,
      },
    ],
  },
  {
    id: "creature",
    title: "Creature",
    fields: [
      { key: "creatureRadius", label: "Radius", hint: "Body radius in world units.", step: 1 },
      { key: "initialEnergy", label: "Starting energy", hint: "Energy of founders.", step: 5 },
      { key: "maxEnergy", label: "Energy ceiling", hint: "Maximum stored energy.", step: 5 },
      {
        key: "reproductionCooldown",
        label: "Cooldown",
        hint: "Ticks after reproducing before the next attempt.",
        step: 5,
        integer: true,
        unit: "t",
      },
      { key: "maxLifespan", label: "Max lifespan", hint: "Forced death age.", step: 100, integer: true, unit: "t" },
    ],
  },
  {
    id: "metabolism",
    title: "Metabolism",
    fields: [
      { key: "basalCost", label: "Basal cost", hint: "Idle upkeep per tick.", step: 0.005 },
      { key: "moveCost", label: "Move cost", hint: "Extra cost at the speed baseline (scales with v²).", step: 0.005 },
      { key: "visionCost", label: "Vision cost", hint: "Extra cost at the vision baseline (scales linearly).", step: 0.005 },
      { key: "baseMaxSpeed", label: "Speed baseline", hint: "Traits vary around this value.", step: 0.1 },
      { key: "baseVisionRange", label: "Vision baseline", hint: "Traits vary around this value.", step: 5 },
      { key: "maxTurnRate", label: "Turn rate", hint: "Radians per tick at full turn output.", step: 0.01 },
    ],
  },
  {
    id: "reproduction",
    title: "Reproduction",
    fields: [
      { key: "reproductionThreshold", label: "Threshold", hint: "Energy needed to attempt reproduction.", step: 5 },
      { key: "reproductionCost", label: "Parent cost", hint: "Energy the parent pays.", step: 5 },
      { key: "offspringEnergy", label: "Offspring energy", hint: "Energy the child starts with.", step: 5 },
    ],
  },
  {
    id: "mutation",
    title: "Mutation",
    fields: [
      { key: "mutationProbability", label: "Founder rate", hint: "Baseline per-parameter mutation chance.", step: 0.005 },
      { key: "mutationStrength", label: "Weight step", hint: "Gaussian std applied to a parameter.", step: 0.01 },
      { key: "traitMutationStrength", label: "Trait step", hint: "Log-normal std applied to a trait.", step: 0.005 },
    ],
  },
] as const;

/** Flat list of every numeric field, in display order. */
export const CONFIG_FIELD_ORDER: readonly ConfigFieldMeta[] = CONFIG_GROUPS.flatMap(
  (group) => group.fields,
);

/** Loose copy of the seeded PRNG word (UI only; the engine owns the real state). */
export const ALL_NUMERIC_KEYS: readonly NumericConfigKey[] = CONFIG_FIELD_ORDER.map(
  (field) => field.key,
);

/**
 * Fields whose full valid range is small enough to drive with a slider in
 * addition to the numeric input (everything else uses the input alone, since a
 * slider across a 1e6 range would be unusable).
 */
export const SLIDER_KEYS: ReadonlySet<NumericConfigKey> = new Set<NumericConfigKey>([
  "mutationProbability",
  "foodBackgroundFraction",
  "maxTurnRate",
  "baseMaxSpeed",
  "creatureRadius",
]);

/** Reset-only keys currently differing from the applied config. */
export function pendingResetKeys(
  draft: SimConfig,
  applied: SimConfig,
  isLive: (key: keyof SimConfig) => boolean,
): NumericConfigKey[] {
  const changed: NumericConfigKey[] = [];
  for (const key of ALL_NUMERIC_KEYS) {
    if (isLive(key)) continue;
    if (draft[key] !== applied[key]) changed.push(key);
  }
  return changed;
}
