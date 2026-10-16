import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type SimConfig } from "@/simulation/config";
import type { StatsSample } from "@/simulation/types";
import {
  buildComparison,
  COMPARABLE_METRICS,
  createExperiment,
  EXPERIMENT_SCHEMA_VERSION,
  isStatsSample,
  isStoredConfig,
  parseExperimentRecord,
  summarizeRun,
  type ExperimentRecord,
} from "@/simulation/experiments/record";

const CONFIG: SimConfig = { ...DEFAULT_CONFIG, seed: 7 };

function sample(tick: number, population: number, births: number, deaths: number): StatsSample {
  return {
    tick,
    population,
    births,
    deaths,
    foodRemaining: 100,
    meanEnergy: 50,
    meanSpeedTrait: 2,
    meanVisionTrait: 120,
    meanGeneration: tick / 100,
    maxGeneration: Math.floor(tick / 100),
    genomeDispersion: 0.5,
  };
}

function history(ticks: number[]): StatsSample[] {
  return ticks.map((tick, index) => sample(tick, 10 + index, index, 0));
}

describe("summarizeRun", () => {
  it("is total on an empty history", () => {
    const summary = summarizeRun([], 0);
    expect(summary.samples).toBe(0);
    expect(summary.finalPopulation).toBe(0);
    expect(summary.peakPopulation).toBe(0);
  });

  it("uses the last sample for finals and maxima for peaks/totals", () => {
    const summary = summarizeRun(
      [
        { ...sample(0, 5, 0, 0) },
        { ...sample(30, 40, 12, 3) },
        { ...sample(60, 20, 30, 19) },
      ],
      60,
    );
    expect(summary.ticks).toBe(60);
    expect(summary.samples).toBe(3);
    expect(summary.finalPopulation).toBe(20);
    expect(summary.peakPopulation).toBe(40);
    expect(summary.totalBirths).toBe(30);
    expect(summary.totalDeaths).toBe(19);
    expect(summary.maxGeneration).toBe(0);
  });
});

describe("createExperiment", () => {
  it("snapshots the history so later mutations cannot leak in", () => {
    const source = history([0, 30, 60]);
    const record = createExperiment({
      id: "exp-1",
      name: "Run 1",
      createdAt: 1000,
      config: CONFIG,
      ticks: 60,
      history: source,
    });

    source[0].population = 9999;
    expect(record.history[0].population).toBe(10);
    expect(record.summary.finalPopulation).toBe(12);
  });

  it("copies the config and records the seed", () => {
    const config: SimConfig = { ...CONFIG };
    const record = createExperiment({
      id: "exp-2",
      name: "Run 2",
      createdAt: 1,
      config,
      ticks: 0,
      history: [],
    });
    config.seed = 12345;
    expect(record.seed).toBe(7);
    expect(record.config.seed).toBe(7);
    expect(record.schemaVersion).toBe(EXPERIMENT_SCHEMA_VERSION);
  });
});

describe("buildComparison", () => {
  const a: ExperimentRecord = createExperiment({
    id: "a",
    name: "A",
    createdAt: 1,
    config: CONFIG,
    ticks: 60,
    history: [sample(0, 1, 0, 0), sample(30, 2, 0, 0), sample(60, 3, 0, 0)],
  });
  const b: ExperimentRecord = createExperiment({
    id: "b",
    name: "B",
    createdAt: 2,
    config: CONFIG,
    ticks: 30,
    history: [sample(0, 10, 0, 0), sample(30, 20, 0, 0)],
  });

  it("aligns rows by tick and fills only the runs that reached each tick", () => {
    const { data, series } = buildComparison(
      [
        { id: "a", label: "A", color: "#111111", history: a.history },
        { id: "b", label: "B", color: "#222222", history: b.history },
      ],
      "population",
    );
    expect(series.map((s) => s.key)).toEqual(["a", "b"]);
    expect(data.map((row) => row.tick)).toEqual([0, 30, 60]);
    expect(data[0].a).toBe(1);
    expect(data[0].b).toBe(10);
    expect(data[2].a).toBe(3);
    expect(data[2].b).toBeUndefined();
  });

  it("respects the point budget", () => {
    const long = history(Array.from({ length: 1000 }, (_, i) => i * 30));
    const { data } = buildComparison(
      [{ id: "long", label: "L", color: "#333333", history: long }],
      "population",
      50,
    );
    expect(data.length).toBe(50);
    expect(data[0].tick).toBe(0);
    expect(data[data.length - 1].tick).toBe(999 * 30);
  });

  it("offers a metric for every non-tick sample field", () => {
    const keys = COMPARABLE_METRICS.map((metric) => metric.key);
    expect(keys).toContain("population");
    expect(keys).toContain("genomeDispersion");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("parseExperimentRecord", () => {
  const valid = createExperiment({
    id: "exp-valid",
    name: "Valid",
    createdAt: 42,
    config: CONFIG,
    ticks: 60,
    history: [sample(0, 1, 0, 0), sample(30, 2, 1, 0)],
  });

  it("accepts a round-tripped record and recomputes the summary", () => {
    const json = JSON.parse(JSON.stringify(valid)) as unknown;
    const parsed = parseExperimentRecord(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.summary.finalPopulation).toBe(2);
    expect(parsed?.id).toBe("exp-valid");
  });

  it("rejects a wrong schema version", () => {
    expect(parseExperimentRecord({ ...valid, schemaVersion: 99 })).toBeNull();
  });

  it("rejects a malformed config and malformed samples", () => {
    expect(parseExperimentRecord({ ...valid, config: { seed: 1 } })).toBeNull();
    expect(
      parseExperimentRecord({ ...valid, history: [{ tick: 0, population: "lots" }] }),
    ).toBeNull();
    expect(parseExperimentRecord(null)).toBeNull();
    expect(parseExperimentRecord("nope")).toBeNull();
  });

  it("recomputes rather than trusts a stored summary", () => {
    const tampered = { ...valid, summary: { ...valid.summary, finalPopulation: 123456 } };
    expect(parseExperimentRecord(tampered)?.summary.finalPopulation).toBe(2);
  });
});

describe("shape guards", () => {
  it("accepts a real sample and rejects a partial one", () => {
    expect(isStatsSample(sample(0, 1, 0, 0))).toBe(true);
    expect(isStatsSample({ tick: 0 })).toBe(false);
    expect(isStatsSample(null)).toBe(false);
  });

  it("accepts the default config and rejects an out-of-range one", () => {
    expect(isStoredConfig(DEFAULT_CONFIG)).toBe(true);
    expect(isStoredConfig({ ...DEFAULT_CONFIG, initialPopulation: -5 })).toBe(false);
    expect(isStoredConfig({})).toBe(false);
  });
});
