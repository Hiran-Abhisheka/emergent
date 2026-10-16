import { describe, expect, it } from "vitest";
import {
  HIDDEN_COUNT,
  INPUT_COUNT,
  OUTPUT_COUNT,
  PARAM_COUNT,
} from "@/simulation/constants";
import {
  GENOME_LAYOUT,
  cloneGenome,
  createFounderGenome,
  forward,
  isGenomeFinite,
  mutateGenomeInPlace,
  parameterCount,
} from "@/simulation/neural/genome";
import { Rng } from "@/simulation/engine/prng";

function runForward(genome: Float32Array, inputs: number[]): number[] {
  const inArr = new Float32Array(inputs);
  const hidden = new Float32Array(HIDDEN_COUNT);
  const out = new Float32Array(OUTPUT_COUNT);
  forward(genome, inArr, hidden, out);
  return Array.from(out);
}

describe("genome layout", () => {
  it("matches the parameter-count formula", () => {
    expect(PARAM_COUNT).toBe(160);
    expect(parameterCount(INPUT_COUNT, HIDDEN_COUNT, OUTPUT_COUNT)).toBe(PARAM_COUNT);
  });

  it("has non-overlapping slices that exactly fill the genome", () => {
    expect(GENOME_LAYOUT.w1Offset).toBe(0);
    expect(GENOME_LAYOUT.b1Offset).toBe(INPUT_COUNT * HIDDEN_COUNT);
    expect(GENOME_LAYOUT.w2Offset).toBe(INPUT_COUNT * HIDDEN_COUNT + HIDDEN_COUNT);
    expect(GENOME_LAYOUT.b2Offset).toBe(
      INPUT_COUNT * HIDDEN_COUNT + HIDDEN_COUNT + HIDDEN_COUNT * OUTPUT_COUNT,
    );
    expect(GENOME_LAYOUT.b2Offset + OUTPUT_COUNT).toBe(PARAM_COUNT);
  });
});

describe("forward pass", () => {
  it("with zero weights, outputs equal tanh(output biases)", () => {
    const genome = new Float32Array(PARAM_COUNT);
    const { b2Offset } = GENOME_LAYOUT;
    genome[b2Offset + 0] = 0.5;
    genome[b2Offset + 1] = -0.5;
    genome[b2Offset + 2] = 1.0;
    genome[b2Offset + 3] = 0.0;

    const out = runForward(genome, [1, 0, 0, 0, 0, 0, 0, 0]);
    expect(out[0]).toBeCloseTo(0.46211715726000974, 5);
    expect(out[1]).toBeCloseTo(-0.46211715726000974, 5);
    expect(out[2]).toBeCloseTo(0.7615941559557649, 5);
    expect(out[3]).toBeCloseTo(0, 5);
  });

  it("propagates a single weighted path (input0 -> hidden0 -> output0)", () => {
    const genome = new Float32Array(PARAM_COUNT);
    const { w1Offset, w2Offset } = GENOME_LAYOUT;
    genome[w1Offset + 0] = 2; // hidden0 <- 2 * input0
    genome[w2Offset + 0] = 1; // output0 <- 1 * hidden0

    const out = runForward(genome, [1, 0, 0, 0, 0, 0, 0, 0]);
    expect(out[0]).toBeCloseTo(0.7460679984455996, 4);
  });

  it("always keeps outputs within [-1, 1]", () => {
    const rng = Rng.fromSeed(3);
    const genome = createFounderGenome(rng);
    for (let t = 0; t < 200; t++) {
      const inputs = Array.from({ length: INPUT_COUNT }, () => rng.nextRange(-1, 1));
      const out = runForward(genome, inputs);
      for (const v of out) {
        expect(v).toBeGreaterThanOrEqual(-1);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("founder initialisation", () => {
  it("is identical for the same seed and finite everywhere", () => {
    const a = createFounderGenome(Rng.fromSeed(2024));
    const b = createFounderGenome(Rng.fromSeed(2024));
    expect(isGenomeFinite(a)).toBe(true);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("gives a positive thrust bias so founders move", () => {
    const genome = createFounderGenome(Rng.fromSeed(11));
    expect(genome[GENOME_LAYOUT.b2Offset + 2]).toBeGreaterThan(0);
    const out = runForward(genome, [0.5, 0, 0, 0, 0, 0, 0, 0]);
    expect(out[2]).toBeGreaterThan(0);
  });
});

describe("clone / mutation", () => {
  it("clone does not share the buffer", () => {
    const g = createFounderGenome(Rng.fromSeed(1));
    const c = cloneGenome(g);
    c[0] = 999;
    expect(g[0]).not.toBe(999);
    expect(c.length).toBe(g.length);
  });

  it("mutates roughly the requested fraction of parameters", () => {
    const g = createFounderGenome(Rng.fromSeed(8));
    const original = cloneGenome(g);
    mutateGenomeInPlace(g, Rng.fromSeed(8), 0.5, 0.15);
    let changed = 0;
    for (let i = 0; i < g.length; i++) if (g[i] !== original[i]) changed++;
    const fraction = changed / g.length;
    expect(fraction).toBeGreaterThan(0.4);
    expect(fraction).toBeLessThan(0.6);
    expect(isGenomeFinite(g)).toBe(true);
  });

  it("probability 0 leaves the genome untouched, probability 1 changes it", () => {
    const g0 = createFounderGenome(Rng.fromSeed(4));
    const before = cloneGenome(g0);
    mutateGenomeInPlace(g0, Rng.fromSeed(4), 0, 0.15);
    expect(Array.from(g0)).toEqual(Array.from(before));

    const g1 = createFounderGenome(Rng.fromSeed(4));
    mutateGenomeInPlace(g1, Rng.fromSeed(4), 1, 0.15);
    expect(Array.from(g1)).not.toEqual(Array.from(before));
  });
});
