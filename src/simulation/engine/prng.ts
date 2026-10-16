import type { RngState } from "../types";

/**
 * Deterministic PRNG: sfc32 for uniform output, splitmix32 for seeding.
 *
 * The full state is four 32-bit words and is serialised as part of the world
 * state, so a saved run resumes with the exact same random sequence. No use
 * of `Math.random` anywhere in the engine.
 *
 * Reference: Bob Jenkins' small fast counting RNG ("sfc32").
 */

/** A single splitmix32 step; used to expand one integer seed into four words. */
function splitmix32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad) >>> 0;
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97) >>> 0;
    return (z ^ (z >>> 15)) >>> 0;
  };
}

/** Derive four non-zero sfc32 words from a single integer seed. */
export function seedToRngState(seed: number): RngState {
  const sm = splitmix32(seed >>> 0);
  const a = sm();
  const b = sm();
  const c = sm();
  let d = sm();
  // Guard against the (astronomically unlikely) all-zero state that would
  // make sfc32 produce a constant sequence.
  if ((a | b | c | d) === 0) d = 0x9e3779b9;
  return { a, b, c, d };
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    this.a = state.a >>> 0;
    this.b = state.b >>> 0;
    this.c = state.c >>> 0;
    this.d = state.d >>> 0;
  }

  static fromSeed(seed: number): Rng {
    return new Rng(seedToRngState(seed));
  }

  static fromState(state: RngState): Rng {
    return new Rng(state);
  }

  /** Next raw 32-bit unsigned integer. */
  nextUint32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    const t = ((this.a + this.b) | 0) + this.d | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Uniform integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number {
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  /** Uniform float in [min, max). */
  nextRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Standard normal sample (mean 0, std 1) via Box–Muller. Consumes exactly
   * two uniforms every call so the sequence does not depend on a caller-side
   * spare, which keeps state serialisation trivially correct.
   */
  nextGaussian(): number {
    let u1 = this.nextFloat();
    const u2 = this.nextFloat();
    if (u1 < Number.MIN_VALUE) u1 = Number.MIN_VALUE;
    const radius = Math.sqrt(-2 * Math.log(u1));
    return radius * Math.cos(2 * Math.PI * u2);
  }

  /** Sample from Normal(mean, std). */
  nextNormal(mean: number, std: number): number {
    return mean + std * this.nextGaussian();
  }

  /** Snapshot the current state (for serialisation / hashing). */
  state(): RngState {
    return { a: this.a >>> 0, b: this.b >>> 0, c: this.c >>> 0, d: this.d >>> 0 };
  }
}
