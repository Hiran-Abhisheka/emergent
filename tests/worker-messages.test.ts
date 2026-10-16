import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "@/simulation/config";
import { parseWorkerCommand } from "@/simulation/worker-messages";

describe("worker command validation", () => {
  it("accepts well-formed commands", () => {
    const commands = [
      { type: "START" },
      { type: "PAUSE" },
      { type: "SAVE_STATE" },
      { type: "INIT", config: DEFAULT_CONFIG },
      { type: "RESET", config: DEFAULT_CONFIG },
      { type: "SET_SPEED", multiplier: 4 },
      { type: "SET_ENVIRONMENT", patch: { foodEnergy: 25 } },
      { type: "SET_COLOR_MODE", mode: "generation" },
      { type: "INSPECT_CREATURE", id: 7 },
      { type: "INSPECT_CREATURE", id: null },
    ];
    for (const command of commands) {
      const result = parseWorkerCommand(command);
      expect(result.ok, JSON.stringify(command)).toBe(true);
    }
  });

  it("rejects non-objects and unknown types", () => {
    expect(parseWorkerCommand(null).ok).toBe(false);
    expect(parseWorkerCommand(42).ok).toBe(false);
    expect(parseWorkerCommand([]).ok).toBe(false);
    expect(parseWorkerCommand({ type: "DOES_NOT_EXIST" }).ok).toBe(false);
    expect(parseWorkerCommand({}).ok).toBe(false);
  });

  it("rejects INIT/RESET without a config object", () => {
    expect(parseWorkerCommand({ type: "INIT" }).ok).toBe(false);
    expect(parseWorkerCommand({ type: "RESET", config: "x" }).ok).toBe(false);
  });

  it("rejects a non-positive or non-finite speed", () => {
    expect(parseWorkerCommand({ type: "SET_SPEED", multiplier: 0 }).ok).toBe(false);
    expect(parseWorkerCommand({ type: "SET_SPEED", multiplier: -1 }).ok).toBe(false);
    expect(parseWorkerCommand({ type: "SET_SPEED", multiplier: Number.NaN }).ok).toBe(false);
  });

  it("rejects environment patches that do not apply live", () => {
    // `seed` and `initialPopulation` require a reset.
    expect(parseWorkerCommand({ type: "SET_ENVIRONMENT", patch: { seed: 1 } }).ok).toBe(false);
    const result = parseWorkerCommand({
      type: "SET_ENVIRONMENT",
      patch: { initialPopulation: 50 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("live");
  });

  it("rejects out-of-range live environment values", () => {
    const result = parseWorkerCommand({
      type: "SET_ENVIRONMENT",
      patch: { foodRegenPerTick: 99999 },
    });
    expect(result.ok).toBe(false);
  });

  it("sanitises a valid patch down to the live keys only", () => {
    const result = parseWorkerCommand({
      type: "SET_ENVIRONMENT",
      patch: { foodEnergy: 12, maxPopulation: 300 },
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "SET_ENVIRONMENT") {
      expect(result.command.patch).toEqual({ foodEnergy: 12, maxPopulation: 300 });
    }
  });

  it("rejects malformed color modes and inspection ids", () => {
    expect(parseWorkerCommand({ type: "SET_COLOR_MODE", mode: "hue" }).ok).toBe(false);
    expect(parseWorkerCommand({ type: "INSPECT_CREATURE", id: 1.5 }).ok).toBe(false);
    expect(parseWorkerCommand({ type: "INSPECT_CREATURE", id: "3" }).ok).toBe(false);
  });

  it("requires both snapshot buffers on ACK", () => {
    expect(
      parseWorkerCommand({ type: "SNAPSHOT_ACK", data: new Float32Array(6) }).ok,
    ).toBe(false);
    expect(
      parseWorkerCommand({
        type: "SNAPSHOT_ACK",
        data: new Float32Array(6),
        ids: new Int32Array(1),
      }).ok,
    ).toBe(true);
  });
});
