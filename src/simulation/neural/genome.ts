import {
  FOUNDER_HIDDEN_BIAS_STD,
  FOUNDER_REPRODUCE_BIAS,
  FOUNDER_THRUST_BIAS,
  FOUNDER_TURN_BIAS,
  FOUNDER_WEIGHT_STD_HIDDEN,
  FOUNDER_WEIGHT_STD_OUTPUT,
  HIDDEN_COUNT,
  INPUT_COUNT,
  OUTPUT_COUNT,
  PARAM_COUNT,
} from "../constants";
import type { Rng } from "../engine/prng";

/**
 * Genome layout (GENOME_LAYOUT_VERSION = 1), a single flat Float32Array:
 *
 *   [ W1 : I*H ][ B1 : H ][ W2 : H*O ][ B2 : O ]
 *
 * W1 is row-major by hidden unit: W1[h*I + i] connects input i -> hidden h.
 * W2 is row-major by output unit:  W2[o*H + h] connects hidden h -> output o.
 *
 * Adding a new output later means a new layout version plus a migration that
 * grows the array; existing version-1 genomes stay valid for the first four
 * outputs.
 */
export interface GenomeLayout {
  version: number;
  inputCount: number;
  hiddenCount: number;
  outputCount: number;
  paramCount: number;
  w1Offset: number;
  b1Offset: number;
  w2Offset: number;
  b2Offset: number;
}

function buildLayout(): GenomeLayout {
  const w1Offset = 0;
  const b1Offset = w1Offset + INPUT_COUNT * HIDDEN_COUNT;
  const w2Offset = b1Offset + HIDDEN_COUNT;
  const b2Offset = w2Offset + HIDDEN_COUNT * OUTPUT_COUNT;
  return {
    version: 1,
    inputCount: INPUT_COUNT,
    hiddenCount: HIDDEN_COUNT,
    outputCount: OUTPUT_COUNT,
    paramCount: PARAM_COUNT,
    w1Offset,
    b1Offset,
    w2Offset,
    b2Offset,
  };
}

export const GENOME_LAYOUT: GenomeLayout = buildLayout();

/** The parameter-count formula, kept here so a test can assert it directly. */
export function parameterCount(i: number, h: number, o: number): number {
  return i * h + h + h * o + o;
}

/**
 * Forward pass. Writes activations into the caller's buffers to avoid
 * allocation in the hot loop. Hidden and output use tanh.
 *
 * Bounds: inputs must be length I; hidden/output must be length H/O.
 */
export function forward(
  genome: Float32Array,
  inputs: Float32Array,
  hidden: Float32Array,
  outputs: Float32Array,
): void {
  const { w1Offset, b1Offset, w2Offset, b2Offset } = GENOME_LAYOUT;

  for (let h = 0; h < HIDDEN_COUNT; h++) {
    let sum = genome[b1Offset + h];
    const rowStart = w1Offset + h * INPUT_COUNT;
    for (let i = 0; i < INPUT_COUNT; i++) {
      sum += genome[rowStart + i] * inputs[i];
    }
    hidden[h] = Math.tanh(sum);
  }

  for (let o = 0; o < OUTPUT_COUNT; o++) {
    let sum = genome[b2Offset + o];
    const rowStart = w2Offset + o * HIDDEN_COUNT;
    for (let h = 0; h < HIDDEN_COUNT; h++) {
      sum += genome[rowStart + h] * hidden[h];
    }
    outputs[o] = Math.tanh(sum);
  }
}

/**
 * Founder initialisation prior. Identical for every founder: weights are
 * Gaussian with a per-layer std of 1/sqrt(fan-in), hidden biases are a small
 * Gaussian, and the thrust output bias is positive so random creatures drift
 * forward rather than freeze. This is an initialisation prior, not reward
 * shaping: nothing here rewards a creature for finding food.
 */
export function createFounderGenome(rng: Rng): Float32Array {
  const genome = new Float32Array(PARAM_COUNT);
  const { w1Offset, b1Offset, w2Offset, b2Offset } = GENOME_LAYOUT;

  for (let h = 0; h < HIDDEN_COUNT; h++) {
    for (let i = 0; i < INPUT_COUNT; i++) {
      genome[w1Offset + h * INPUT_COUNT + i] = rng.nextNormal(0, FOUNDER_WEIGHT_STD_HIDDEN);
    }
  }
  for (let h = 0; h < HIDDEN_COUNT; h++) {
    genome[b1Offset + h] = Math.abs(rng.nextNormal(0, FOUNDER_HIDDEN_BIAS_STD));
  }
  for (let o = 0; o < OUTPUT_COUNT; o++) {
    for (let h = 0; h < HIDDEN_COUNT; h++) {
      genome[w2Offset + o * HIDDEN_COUNT + h] = rng.nextNormal(0, FOUNDER_WEIGHT_STD_OUTPUT);
    }
  }
  genome[b2Offset + 0] = FOUNDER_TURN_BIAS;
  genome[b2Offset + 1] = FOUNDER_TURN_BIAS;
  genome[b2Offset + 2] = FOUNDER_THRUST_BIAS;
  genome[b2Offset + 3] = FOUNDER_REPRODUCE_BIAS;

  return genome;
}

/** Deep copy of a genome (never shares the underlying buffer). */
export function cloneGenome(genome: Float32Array): Float32Array {
  return new Float32Array(genome);
}

/**
 * Mutates a genome in place: each parameter is perturbed with probability
 * `probability` by a Gaussian of std `strength`. Non-finite results are
 * rejected and the original value is kept.
 */
export function mutateGenomeInPlace(
  genome: Float32Array,
  rng: Rng,
  probability: number,
  strength: number,
): void {
  for (let i = 0; i < genome.length; i++) {
    if (rng.nextFloat() < probability) {
      const original = genome[i];
      const mutated = original + rng.nextNormal(0, strength);
      genome[i] = Number.isFinite(mutated) ? mutated : original;
    }
  }
}

/** True when every parameter is finite (used as a guard before accepting a child). */
export function isGenomeFinite(genome: Float32Array): boolean {
  for (let i = 0; i < genome.length; i++) {
    if (!Number.isFinite(genome[i])) return false;
  }
  return true;
}

/** Reads a weight for the network diagram without knowing the raw offsets. */
export function getWeight(
  genome: Float32Array,
  layer: "w1" | "b1" | "w2" | "b2",
  a: number,
  b = 0,
): number {
  switch (layer) {
    case "w1":
      return genome[GENOME_LAYOUT.w1Offset + a * INPUT_COUNT + b];
    case "b1":
      return genome[GENOME_LAYOUT.b1Offset + a];
    case "w2":
      return genome[GENOME_LAYOUT.w2Offset + a * HIDDEN_COUNT + b];
    case "b2":
      return genome[GENOME_LAYOUT.b2Offset + a];
  }
}
