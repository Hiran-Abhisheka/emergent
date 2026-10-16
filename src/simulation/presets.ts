import { DEFAULT_CONFIG, type SimConfig } from "./config";

/**
 * A named starting environment. Presets only override *environment* tunables;
 * the seed is intentionally never part of a preset, so applying one keeps the
 * current run's seed (and therefore stays comparable).
 */
export interface Preset {
  id: string;
  name: string;
  description: string;
  patch: Omit<Partial<SimConfig>, "seed">;
}

export const PRESETS: readonly Preset[] = [
  {
    id: "default",
    name: "Default",
    description: "The calibrated baseline (docs/DECISIONS.md D-208).",
    patch: { ...DEFAULT_CONFIG },
  },
  {
    id: "scarce",
    name: "Scarce",
    description: "Little food, tight clusters, expensive vision. Strong selective pressure.",
    patch: {
      initialFood: 150,
      maxFood: 300,
      foodRegenPerTick: 0.25,
      foodClusterCount: 3,
      foodClusterRadius: 80,
      foodBackgroundFraction: 0.15,
      visionCost: 0.03,
    },
  },
  {
    id: "abundant",
    name: "Abundant",
    description: "Plentiful, fast-regenerating food. Selection is weak; drift dominates.",
    patch: {
      initialFood: 500,
      maxFood: 900,
      foodRegenPerTick: 1.2,
      foodClusterCount: 8,
      foodBackgroundFraction: 0.5,
    },
  },
  {
    id: "crowded",
    name: "Crowded",
    description: "Many founders on a small food budget: competition is the main pressure.",
    patch: {
      initialPopulation: 250,
      maxPopulation: 600,
      initialFood: 200,
      maxFood: 350,
      foodRegenPerTick: 0.5,
    },
  },
  {
    id: "high-mutation",
    name: "High mutation",
    description: "Rough, frequent mutation. Useful for watching how quickly traits spread.",
    patch: {
      mutationProbability: 0.06,
      mutationStrength: 0.3,
      traitMutationStrength: 0.12,
    },
  },
  {
    id: "fast-generations",
    name: "Fast generations",
    description: "Short cooldown and lifespan so many generations elapse quickly.",
    patch: {
      reproductionCooldown: 60,
      maxLifespan: 12000,
      initialEnergy: 80,
      offspringEnergy: 45,
    },
  },
] as const;

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}
