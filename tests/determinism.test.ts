import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type SimConfig } from "@/simulation/config";
import { createRuntime, createWorld } from "@/simulation/engine/world";
import { runTicks } from "@/simulation/engine/step";
import { hashState } from "@/simulation/engine/hash";
import {
  deserializeWorld,
  serializeWorld,
  worldFromJson,
  worldToJson,
} from "@/simulation/storage/state";

const CONFIG: SimConfig = {
  ...DEFAULT_CONFIG,
  seed: 20260101,
  initialPopulation: 50,
  maxPopulation: 120,
  initialFood: 180,
};

describe("determinism", () => {
  it("produces identical hashes for the same seed and tick count", () => {
    const a = createWorld(CONFIG);
    const b = createWorld(CONFIG);
    runTicks(a, createRuntime(a), 500);
    runTicks(b, createRuntime(b), 500);
    expect(hashState(a)).toBe(hashState(b));
  });

  it("differs when the seed differs", () => {
    const a = createWorld(CONFIG);
    const b = createWorld({ ...CONFIG, seed: CONFIG.seed + 1 });
    runTicks(a, createRuntime(a), 100);
    runTicks(b, createRuntime(b), 100);
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it("restore at tick T then M more ticks equals an uninterrupted run", () => {
    const original = createWorld(CONFIG);
    const originalRuntime = createRuntime(original);
    runTicks(original, originalRuntime, 300);

    const snapshot = serializeWorld(original);
    const restored = deserializeWorld(snapshot);
    expect(hashState(restored)).toBe(hashState(original));

    const restoredRuntime = createRuntime(restored);
    const M = 250;
    runTicks(original, originalRuntime, M);
    runTicks(restored, restoredRuntime, M);

    expect(restored.tick).toBe(original.tick);
    expect(hashState(restored)).toBe(hashState(original));
  });

  it("survives a JSON round-trip mid-run and continues identically", () => {
    const original = createWorld(CONFIG);
    const originalRuntime = createRuntime(original);
    runTicks(original, originalRuntime, 200);

    const restored = worldFromJson(worldToJson(original));
    const restoredRuntime = createRuntime(restored);
    runTicks(original, originalRuntime, 150);
    runTicks(restored, restoredRuntime, 150);
    expect(hashState(restored)).toBe(hashState(original));
  });
});
