import { describe, expect, it } from "vitest";
import { Rng, seedToRngState } from "@/simulation/engine/prng";

describe("Rng (sfc32)", () => {
  it("is deterministic for a given seed", () => {
    const a = Rng.fromSeed(42);
    const b = Rng.fromSeed(42);
    const seqA = Array.from({ length: 20 }, () => a.nextFloat());
    const seqB = Array.from({ length: 20 }, () => b.nextFloat());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = Rng.fromSeed(1);
    const b = Rng.fromSeed(2);
    expect(a.nextFloat()).not.toEqual(b.nextFloat());
  });

  it("round-trips its state exactly", () => {
    const rng = Rng.fromSeed(12345);
    for (let i = 0; i < 10; i++) rng.nextUint32();
    const snapshot = rng.state();
    const expected = Array.from({ length: 10 }, () => rng.nextFloat());

    const restored = Rng.fromState(snapshot);
    const actual = Array.from({ length: 10 }, () => restored.nextFloat());
    expect(actual).toEqual(expected);
  });

  it("keeps floats inside [0, 1) and uints inside uint32", () => {
    const rng = Rng.fromSeed(7);
    for (let i = 0; i < 5000; i++) {
      const f = rng.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const u = rng.nextUint32();
      expect(Number.isInteger(u)).toBe(true);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("never produces an all-zero state from a seed", () => {
    for (const seed of [0, 1, 2, 0xffffffff]) {
      const s = seedToRngState(seed);
      expect(s.a | s.b | s.c | s.d).not.toBe(0);
    }
  });

  it("has a roughly standard-normal Gaussian (mean≈0, std≈1)", () => {
    const rng = Rng.fromSeed(99);
    const n = 20000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const g = rng.nextGaussian();
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    expect(Math.abs(mean)).toBeLessThan(0.05);
    expect(Math.abs(variance - 1)).toBeLessThan(0.1);
  });

  it("nextInt stays in range", () => {
    const rng = Rng.fromSeed(5);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
    }
  });
});
