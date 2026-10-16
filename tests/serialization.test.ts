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
  type SerializedWorld,
} from "@/simulation/storage/state";
import { base64ToBytes, bytesToBase64 } from "@/simulation/storage/base64";

const CONFIG: SimConfig = {
  ...DEFAULT_CONFIG,
  seed: 99,
  initialPopulation: 20,
  maxPopulation: 40,
  initialFood: 60,
};

describe("state serialization", () => {
  const world = createWorld(CONFIG);
  runTicks(world, createRuntime(world), 60);

  it("round-trips through structured data with an identical hash", () => {
    const restored = deserializeWorld(serializeWorld(world));
    expect(hashState(restored)).toBe(hashState(world));
    expect(restored.tick).toBe(world.tick);
    expect(restored.creatures.length).toBe(world.creatures.length);
  });

  it("deep-copies genomes (no shared buffers with the original)", () => {
    const restored = deserializeWorld(serializeWorld(world));
    if (world.creatures.length === 0 || restored.creatures.length === 0) return;
    restored.creatures[0].genome[0] += 1;
    expect(restored.creatures[0].genome[0]).not.toBe(world.creatures[0].genome[0]);
  });

  it("round-trips through JSON with an identical hash", () => {
    const restored = worldFromJson(worldToJson(world));
    expect(hashState(restored)).toBe(hashState(world));
  });

  it("rejects an unsupported schema version", () => {
    const bad = { ...serializeWorld(world), schemaVersion: 999 } as SerializedWorld;
    expect(() => deserializeWorld(bad)).toThrow(/schema/i);
  });

  it("rejects a genome whose length does not match the layout", () => {
    const data = serializeWorld(world);
    if (data.creatures.length === 0) return;
    data.creatures[0].genome = new Float32Array(10);
    expect(() => deserializeWorld(data)).toThrow(/genome length/i);
  });
});

describe("base64", () => {
  it("round-trips arbitrary bytes exactly", () => {
    const bytes = new Uint8Array(1000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37) & 0xff;
    const restored = base64ToBytes(bytesToBase64(bytes));
    expect(restored.length).toBe(bytes.length);
    expect(Array.from(restored)).toEqual(Array.from(bytes));
  });

  it("round-trips lengths not divisible by 3", () => {
    for (const len of [1, 2, 4, 5, 640]) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 13 + 1) & 0xff);
      const restored = base64ToBytes(bytesToBase64(bytes));
      expect(Array.from(restored)).toEqual(Array.from(bytes));
    }
  });
});
