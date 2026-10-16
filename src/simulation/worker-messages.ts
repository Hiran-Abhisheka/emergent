import {
  CONFIG_LIMITS,
  LIVE_CONFIG_KEYS,
  validateConfig,
  type NumericConfigKey,
  type SimConfig,
} from "./config";
import type { MetricsPayload, Obstacle, Traits } from "./types";
import type { SerializedWorld } from "./storage/state";

/** How the renderer colours creatures. */
export type ColorMode = "energy" | "generation" | "speed";

export const COLOR_MODES: readonly ColorMode[] = ["energy", "generation", "speed"];

/** A log entry for the deterministic command log (spec section 4). */
export interface CommandLogEntry {
  tick: number;
  command: string;
}

/** The selected creature's full live state, sent to the inspector. */
export interface InspectedCreature {
  id: number;
  x: number;
  y: number;
  heading: number;
  energy: number;
  age: number;
  generation: number;
  alive: boolean;
  cooldown: number;
  parentId: number;
  birthTick: number;
  foodEaten: number;
  traits: Traits;
  genome: Float32Array;
  inputs: Float32Array;
  hidden: Float32Array;
  outputs: Float32Array;
}

/** Commands the client sends to the worker (discriminated union). */
export type WorkerCommand =
  | { type: "INIT"; config: SimConfig }
  | { type: "START" }
  | { type: "PAUSE" }
  | { type: "RESET"; config: SimConfig }
  | { type: "SET_SPEED"; multiplier: number }
  | { type: "SET_ENVIRONMENT"; patch: Partial<SimConfig> }
  | { type: "SET_COLOR_MODE"; mode: ColorMode }
  | { type: "INSPECT_CREATURE"; id: number | null }
  | { type: "SNAPSHOT_ACK"; data: Float32Array; ids: Int32Array }
  | { type: "SAVE_STATE" }
  | { type: "RESTORE_STATE"; data: SerializedWorld };

/** Events the worker sends to the client. */
export type WorkerEvent =
  | {
      type: "WORLD";
      config: SimConfig;
      obstacles: Obstacle[];
      width: number;
      height: number;
    }
  | {
      type: "STATUS";
      running: boolean;
      tick: number;
      speed: number;
      population: number;
      colorMode: ColorMode;
      config: SimConfig;
    }
  | {
      type: "SNAPSHOT";
      tick: number;
      count: number;
      foodCount: number;
      stride: number;
      colorMode: ColorMode;
      maxGeneration: number;
      /** Creature block (count*stride) followed by food block (foodCount*2). */
      data: Float32Array;
      /** Creature ids, parallel to the creature block (count entries). */
      ids: Int32Array;
    }
  | { type: "STATS"; payload: MetricsPayload }
  | { type: "INSPECTION"; creature: InspectedCreature | null }
  | { type: "SAVED_STATE"; data: SerializedWorld; commandLog: CommandLogEntry[] }
  | { type: "ERROR"; message: string };

// ---------------------------------------------------------------------------
// Runtime validation of incoming commands. Never trust the message.
// ---------------------------------------------------------------------------

export type CommandParseResult =
  | { ok: true; command: WorkerCommand }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvironmentPatch(
  raw: unknown,
): { ok: true; patch: Partial<SimConfig> } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "patch must be an object" };
  const patch: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!LIVE_CONFIG_KEYS.has(key as keyof SimConfig)) {
      return { ok: false, error: `${key} does not apply live` };
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, error: `${key} must be a finite number` };
    }
    const limits = CONFIG_LIMITS[key as NumericConfigKey];
    if (value < limits.min || value > limits.max) {
      return { ok: false, error: `${key} must be in [${limits.min}, ${limits.max}]` };
    }
    patch[key] = value;
  }
  return { ok: true, patch: patch as Partial<SimConfig> };
}

/**
 * Validates an arbitrary message as a WorkerCommand. Returns a typed error
 * (never throws) so the worker can post an ERROR event instead of dying.
 */
export function parseWorkerCommand(raw: unknown): CommandParseResult {
  if (!isRecord(raw)) return { ok: false, error: "message must be an object" };
  const type = raw.type;
  if (typeof type !== "string") return { ok: false, error: "message.type must be a string" };

  switch (type) {
    case "START":
    case "PAUSE":
    case "SAVE_STATE":
      return { ok: true, command: { type } };
    case "INIT":
    case "RESET": {
      if (!isRecord(raw.config)) return { ok: false, error: `${type}.config must be an object` };
      const config = raw.config as unknown as SimConfig;
      const validation = validateConfig(config);
      if (!validation.valid) {
        return { ok: false, error: `invalid config: ${Object.values(validation.errors).join("; ")}` };
      }
      return { ok: true, command: { type, config } };
    }
    case "SET_SPEED": {
      const multiplier = raw.multiplier;
      if (typeof multiplier !== "number" || !Number.isFinite(multiplier) || multiplier <= 0) {
        return { ok: false, error: "SET_SPEED.multiplier must be a positive number" };
      }
      return { ok: true, command: { type: "SET_SPEED", multiplier } };
    }
    case "SET_ENVIRONMENT": {
      if (raw.patch === undefined) return { ok: false, error: "SET_ENVIRONMENT.patch is required" };
      const parsed = parseEnvironmentPatch(raw.patch);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      return { ok: true, command: { type: "SET_ENVIRONMENT", patch: parsed.patch } };
    }
    case "SET_COLOR_MODE": {
      if (raw.mode !== "energy" && raw.mode !== "generation" && raw.mode !== "speed") {
        return { ok: false, error: "SET_COLOR_MODE.mode is invalid" };
      }
      return { ok: true, command: { type: "SET_COLOR_MODE", mode: raw.mode } };
    }
    case "INSPECT_CREATURE": {
      if (raw.id !== null && (typeof raw.id !== "number" || !Number.isInteger(raw.id))) {
        return { ok: false, error: "INSPECT_CREATURE.id must be an integer or null" };
      }
      return { ok: true, command: { type: "INSPECT_CREATURE", id: raw.id as number | null } };
    }
    case "SNAPSHOT_ACK": {
      if (!(raw.data instanceof Float32Array)) {
        return { ok: false, error: "SNAPSHOT_ACK.data must be a Float32Array" };
      }
      if (!(raw.ids instanceof Int32Array)) {
        return { ok: false, error: "SNAPSHOT_ACK.ids must be an Int32Array" };
      }
      return { ok: true, command: { type: "SNAPSHOT_ACK", data: raw.data, ids: raw.ids } };
    }
    case "RESTORE_STATE": {
      if (!isRecord(raw.data)) return { ok: false, error: "RESTORE_STATE.data must be an object" };
      return { ok: true, command: { type: "RESTORE_STATE", data: raw.data as unknown as SerializedWorld } };
    }
    default:
      return { ok: false, error: `unknown command type: ${type}` };
  }
}
