import { DEFAULT_CONFIG, validateConfig, type SimConfig } from "../config";
import type { StatsSample } from "../types";
import { downsample } from "../../lib/array";

/**
 * Bump when the *shape* of an experiment record changes. Stored records carry
 * the version they were written with so a future reader can migrate or reject
 * them explicitly rather than guessing.
 */
export const EXPERIMENT_SCHEMA_VERSION = 1;

/** Derived facts about a finished (or captured) run. Always recomputed. */
export interface ExperimentSummary {
  ticks: number;
  finalPopulation: number;
  peakPopulation: number;
  maxGeneration: number;
  totalBirths: number;
  totalDeaths: number;
  finalMeanEnergy: number;
  finalMeanSpeedTrait: number;
  finalMeanVisionTrait: number;
  finalGenomeDispersion: number;
  samples: number;
}

/**
 * One recorded run. `history` is the exact `StatsSample` series the worker
 * emitted (no interpolation). `summary` is derived, never authored.
 */
export interface ExperimentRecord {
  schemaVersion: number;
  id: string;
  name: string;
  /** Wall-clock creation time in ms. Set by the UI, not the engine. */
  createdAt: number;
  /** Copied from config for quick display/sorting. */
  seed: number;
  config: SimConfig;
  /** Tick count at capture. */
  ticks: number;
  history: StatsSample[];
  summary: ExperimentSummary;
}

/** Derives a summary from a sample series. Total; safe on an empty history. */
export function summarizeRun(history: readonly StatsSample[], ticks: number): ExperimentSummary {
  if (history.length === 0) {
    return {
      ticks,
      finalPopulation: 0,
      peakPopulation: 0,
      maxGeneration: 0,
      totalBirths: 0,
      totalDeaths: 0,
      finalMeanEnergy: 0,
      finalMeanSpeedTrait: 0,
      finalMeanVisionTrait: 0,
      finalGenomeDispersion: 0,
      samples: 0,
    };
  }
  const last = history[history.length - 1];
  let peakPopulation = 0;
  let maxGeneration = 0;
  let births = 0;
  let deaths = 0;
  for (const sample of history) {
    if (sample.population > peakPopulation) peakPopulation = sample.population;
    if (sample.maxGeneration > maxGeneration) maxGeneration = sample.maxGeneration;
    if (sample.births > births) births = sample.births;
    if (sample.deaths > deaths) deaths = sample.deaths;
  }
  return {
    ticks,
    finalPopulation: last.population,
    peakPopulation,
    maxGeneration,
    totalBirths: births,
    totalDeaths: deaths,
    finalMeanEnergy: last.meanEnergy,
    finalMeanSpeedTrait: last.meanSpeedTrait,
    finalMeanVisionTrait: last.meanVisionTrait,
    finalGenomeDispersion: last.genomeDispersion,
    samples: history.length,
  };
}

export interface CreateExperimentInput {
  id: string;
  name: string;
  createdAt: number;
  config: SimConfig;
  ticks: number;
  history: readonly StatsSample[];
}

/**
 * Builds a record from a live run. `history` is copied so the record is an
 * immutable snapshot: later ticks in the running world cannot mutate it.
 */
export function createExperiment(input: CreateExperimentInput): ExperimentRecord {
  const history = input.history.map((sample) => ({ ...sample }));
  return {
    schemaVersion: EXPERIMENT_SCHEMA_VERSION,
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
    seed: input.config.seed,
    config: { ...input.config },
    ticks: input.ticks,
    history,
    summary: summarizeRun(history, input.ticks),
  };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export interface ComparableMetricMeta {
  key: ComparableMetric;
  label: string;
  digits: number;
}

export type ComparableMetric = Exclude<keyof StatsSample, "tick">;

export const COMPARABLE_METRICS: readonly ComparableMetricMeta[] = [
  { key: "population", label: "Population", digits: 0 },
  { key: "meanEnergy", label: "Mean energy", digits: 1 },
  { key: "meanGeneration", label: "Mean generation", digits: 2 },
  { key: "maxGeneration", label: "Max generation", digits: 0 },
  { key: "meanSpeedTrait", label: "Mean speed trait", digits: 3 },
  { key: "meanVisionTrait", label: "Mean vision trait", digits: 1 },
  { key: "genomeDispersion", label: "Genome dispersion", digits: 3 },
  { key: "births", label: "Cumulative births", digits: 0 },
  { key: "deaths", label: "Cumulative deaths", digits: 0 },
  { key: "foodRemaining", label: "Food remaining", digits: 0 },
];

/** One line on the comparison chart. */
export interface ComparisonEntry {
  id: string;
  label: string;
  color: string;
  history: readonly StatsSample[];
}

export interface ComparisonSeries {
  key: string;
  label: string;
  color: string;
}

export interface ComparisonData {
  /** Rows keyed by tick; each entry id maps to that metric's value. */
  data: Array<Record<string, number>>;
  series: ComparisonSeries[];
}

/**
 * Merges several runs into one chart dataset. Rows are aligned by **tick**
 * (stats are emitted on a fixed 30-tick cadence, so runs captured under the
 * same cadence line up exactly). A run that did not reach a tick simply has no
 * value there; the chart connects across the gap.
 */
export function buildComparison(
  entries: readonly ComparisonEntry[],
  metric: ComparableMetric,
  maxPoints = 500,
): ComparisonData {
  const byTick = new Map<number, Record<string, number>>();
  for (const entry of entries) {
    for (const sample of entry.history) {
      let row = byTick.get(sample.tick);
      if (row === undefined) {
        row = { tick: sample.tick };
        byTick.set(sample.tick, row);
      }
      row[entry.id] = sample[metric];
    }
  }
  const rows = [...byTick.values()].sort((a, b) => a.tick - b.tick);
  return {
    data: downsample(rows, maxPoints),
    series: entries.map((entry) => ({ key: entry.id, label: entry.label, color: entry.color })),
  };
}

// ---------------------------------------------------------------------------
// Validation (for import and for anything read back from storage)
// ---------------------------------------------------------------------------

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

const SAMPLE_NUMBER_FIELDS = [
  "tick",
  "population",
  "births",
  "deaths",
  "foodRemaining",
  "meanEnergy",
  "meanSpeedTrait",
  "meanVisionTrait",
  "meanGeneration",
  "maxGeneration",
  "genomeDispersion",
] as const;

/** Structural check for one stats sample. */
export function isStatsSample(value: unknown): value is StatsSample {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return SAMPLE_NUMBER_FIELDS.every((field) => isFiniteNumber(record[field]));
}

/** Structural + range check for a config read back from outside the engine. */
export function isStoredConfig(value: unknown): value is SimConfig {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    if (candidate[key] === undefined) return false;
  }
  return validateConfig(candidate as unknown as SimConfig).valid;
}

/**
 * Validates an arbitrary value as an experiment record and returns a
 * normalised copy (summary recomputed from history) or `null`. Never throws.
 */
export function parseExperimentRecord(value: unknown): ExperimentRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  if (candidate.schemaVersion !== EXPERIMENT_SCHEMA_VERSION) return null;
  if (typeof candidate.id !== "string" || candidate.id === "") return null;
  if (typeof candidate.name !== "string") return null;
  if (!isFiniteNumber(candidate.createdAt)) return null;
  if (!isFiniteNumber(candidate.ticks) || candidate.ticks < 0) return null;
  if (!isStoredConfig(candidate.config)) return null;
  if (!Array.isArray(candidate.history)) return null;
  if (!candidate.history.every(isStatsSample)) return null;

  const history = (candidate.history as StatsSample[]).map((sample) => ({ ...sample }));
  const config = { ...(candidate.config as SimConfig) };
  return {
    schemaVersion: EXPERIMENT_SCHEMA_VERSION,
    id: candidate.id,
    name: candidate.name,
    createdAt: candidate.createdAt,
    seed: config.seed,
    config,
    ticks: candidate.ticks,
    history,
    summary: summarizeRun(history, candidate.ticks),
  };
}
