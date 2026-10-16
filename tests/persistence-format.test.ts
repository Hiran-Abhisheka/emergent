import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type SimConfig } from "@/simulation/config";
import { createRuntime, createWorld } from "@/simulation/engine/world";
import { runTicks } from "@/simulation/engine/step";
import { hashState } from "@/simulation/engine/hash";
import {
  serializeWorld,
  serializedWorldFromJson,
  serializedWorldToJson,
  worldFromJson,
  worldToJson,
} from "@/simulation/storage/state";
import { STATS_CSV_COLUMNS, safeFileStem, statsToCsv } from "@/simulation/experiments/csv";
import type { StatsSample } from "@/simulation/types";

const CONFIG: SimConfig = {
  ...DEFAULT_CONFIG,
  seed: 21,
  initialPopulation: 12,
  maxPopulation: 30,
  initialFood: 40,
};

describe("serializedWorld JSON", () => {
  const world = createWorld(CONFIG);
  runTicks(world, createRuntime(world), 45);

  it("round-trips a SerializedWorld exactly, bit for bit", () => {
    const serialized = serializeWorld(world);
    const restored = serializedWorldFromJson(serializedWorldToJson(serialized));

    expect(restored.tick).toBe(serialized.tick);
    expect(restored.rng).toEqual(serialized.rng);
    expect(restored.creatures.length).toBe(serialized.creatures.length);
    for (let i = 0; i < serialized.creatures.length; i++) {
      // The genome is float32 and travels as base64 of its exact bytes.
      expect(Array.from(restored.creatures[i].genome)).toEqual(
        Array.from(serialized.creatures[i].genome),
      );
      expect(restored.creatures[i].x).toBe(serialized.creatures[i].x);
      expect(restored.creatures[i].y).toBe(serialized.creatures[i].y);
    }
    expect(restored.food.length).toBe(serialized.food.length);
    expect(restored.lifetimeAgeByGeneration).toEqual(serialized.lifetimeAgeByGeneration);
  });

  it("keeps the WorldState helpers equally lossless (they delegate now)", () => {
    const restored = worldFromJson(worldToJson(world));
    expect(hashState(restored)).toBe(hashState(world));
  });
});

describe("statsToCsv", () => {
  const sample: StatsSample = {
    tick: 30,
    population: 41,
    births: 7,
    deaths: 2,
    foodRemaining: 118,
    meanEnergy: 63.5,
    meanSpeedTrait: 2.125,
    meanVisionTrait: 141.5,
    meanGeneration: 3.25,
    maxGeneration: 6,
    genomeDispersion: 0.4567,
  };

  it("writes a header naming every column, in order", () => {
    const csv = statsToCsv([sample]);
    const [header, row] = csv.trimEnd().split("\n");
    expect(header).toBe(STATS_CSV_COLUMNS.join(","));
    expect(header.split(",")).toEqual([...STATS_CSV_COLUMNS]);
    expect(row.split(",")[0]).toBe("30");
    expect(row.split(",")[1]).toBe("41");
  });

  it("emits one row per sample and a trailing newline", () => {
    const csv = statsToCsv([sample, { ...sample, tick: 60 }]);
    expect(csv.endsWith("\n")).toBe(true);
    expect(csv.trimEnd().split("\n")).toHaveLength(3);
  });

  it("preserves full precision so the export can be re-analysed", () => {
    const csv = statsToCsv([sample]);
    expect(csv).toContain("63.5");
    expect(csv).toContain("2.125");
    expect(csv).toContain("0.4567");
  });

  it("produces only a header for an empty history", () => {
    expect(statsToCsv([])).toBe(`${STATS_CSV_COLUMNS.join(",")}\n`);
  });
});

describe("safeFileStem", () => {
  it("slugifies a run name", () => {
    expect(safeFileStem("High food run #2")).toBe("high-food-run-2");
    expect(safeFileStem("   ")).toBe("run");
    expect(safeFileStem("!!!")).toBe("run");
  });

  it("bounds the length", () => {
    expect(safeFileStem("x".repeat(200)).length).toBeLessThanOrEqual(48);
  });
});
