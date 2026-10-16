/**
 * The simulation worker: the single authority over world state.
 *
 * The main thread only ever sends validated commands and receives events. The
 * worker owns the WorldState + WorldRuntime, drives the tick loop with a frame
 * time budget, and posts pooled, transferable snapshots. It never touches the
 * DOM. Commands arrive via `onmessage`, which JS guarantees cannot interleave
 * with the tick loop, so every command is applied exactly at a tick boundary.
 */
import {
  INSPECTION_INTERVAL_TICKS,
  STATS_INTERVAL_TICKS,
  TICKS_PER_SECOND,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./constants";
import { DEFAULT_CONFIG, type SimConfig } from "./config";
import { createRuntime, createWorld, population, type WorldRuntime } from "./engine/world";
import { stepWorld } from "./engine/step";
import { collectMetrics } from "./metrics/collectors";
import { deserializeWorld, serializeWorld } from "./storage/state";
import type { WorldState } from "./types";
import { SnapshotPool } from "./worker/snapshot-pool";
import { buildInspection } from "./worker/inspection";
import { onMessage, post } from "./worker/messaging";
import {
  parseWorkerCommand,
  type ColorMode,
  type CommandLogEntry,
  type WorkerCommand,
} from "./worker-messages";

// ---------------------------------------------------------------------------
// Loop tuning.
// ---------------------------------------------------------------------------

const FRAME_INTERVAL_MS = 16;
const FRAME_BUDGET_MS = 12;
const IDLE_INTERVAL_MS = 40;
const MAX_TICKS_PER_FRAME = 400;
/** Snapshots are posted no more often than this (≈30/s). */
const SNAPSHOT_MIN_INTERVAL_MS = 30;
const MIN_SPEED = 0.1;
const MAX_SPEED = 64;
const MAX_ACCUMULATOR_TICKS = 600;

// ---------------------------------------------------------------------------
// Worker state.
// ---------------------------------------------------------------------------

let world: WorldState | null = null;
let runtime: WorldRuntime | null = null;
let running = false;
let speed = 1;
let colorMode: ColorMode = "energy";
let inspectId: number | null = null;

let accumulator = 0;
let lastFrameTime = 0;
let lastStatsTick = -1;
let lastInspectionTick = -1;
let lastSnapshotTime = 0;

const pool = new SnapshotPool((event, transfer) => post(event, transfer));
const commandLog: CommandLogEntry[] = [];

// ---------------------------------------------------------------------------
// Messaging helpers.
// ---------------------------------------------------------------------------

function postError(message: string): void {
  post({ type: "ERROR", message });
}

function postStatus(): void {
  if (world === null) return;
  post({
    type: "STATUS",
    running,
    tick: world.tick,
    speed,
    population: population(world),
    colorMode,
    config: { ...world.config },
  });
}

function postWorld(): void {
  if (world === null) return;
  post({
    type: "WORLD",
    config: { ...world.config },
    obstacles: world.obstacles.map((o) => ({ ...o })),
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  });
}

// ---------------------------------------------------------------------------
// Snapshot + inspection messaging.
// ---------------------------------------------------------------------------

function postSnapshot(): void {
  if (world === null) return;
  if (pool.publish(world, colorMode, inspectId)) {
    lastSnapshotTime = performance.now();
  }
}

function postInspection(): void {
  post({
    type: "INSPECTION",
    creature: world === null ? null : buildInspection(world, inspectId),
  });
}

function postStats(): void {
  if (world === null || runtime === null) return;
  post({ type: "STATS", payload: collectMetrics(world, runtime) });
}

// ---------------------------------------------------------------------------
// Command handling.
// ---------------------------------------------------------------------------

function logCommand(command: WorkerCommand): void {
  if (command.type === "SNAPSHOT_ACK") return;
  commandLog.push({ tick: world === null ? 0 : world.tick, command: JSON.stringify(command) });
}

function resetTransient(): void {
  accumulator = 0;
  lastStatsTick = -1;
  lastInspectionTick = -1;
  pool.reset();
}

function installWorld(config: SimConfig): void {
  world = createWorld(config);
  runtime = createRuntime(world);
  resetTransient();
  commandLog.length = 0;
}

function handleCommand(command: WorkerCommand): void {
  logCommand(command);
  switch (command.type) {
    case "INIT":
    case "RESET":
      installWorld(command.config);
      running = false;
      postWorld();
      postStatus();
      postStats();
      postInspection();
      postSnapshot();
      return;
    case "START":
      if (world === null) {
        postError("cannot start before INIT");
        return;
      }
      running = true;
      accumulator = 0;
      lastFrameTime = performance.now();
      postStatus();
      return;
    case "PAUSE":
      running = false;
      accumulator = 0;
      postStatus();
      return;
    case "SET_SPEED":
      speed = Math.min(Math.max(command.multiplier, MIN_SPEED), MAX_SPEED);
      postStatus();
      return;
    case "SET_ENVIRONMENT":
      if (world === null) {
        postError("cannot set environment before INIT");
        return;
      }
      world.config = { ...world.config, ...command.patch };
      pool.reset();
      postStatus();
      // The snapshot shape (pool sizing) may change; refresh even while paused.
      postSnapshot();
      return;
    case "SET_COLOR_MODE":
      colorMode = command.mode;
      postStatus();
      // colorValue lives in the snapshot, so repaint even while paused.
      postSnapshot();
      return;
    case "INSPECT_CREATURE":
      inspectId = command.id;
      lastInspectionTick = -1;
      postInspection();
      // The selection flag lives in the snapshot; repaint even while paused.
      postSnapshot();
      return;
    case "SNAPSHOT_ACK":
      pool.accept(command.data, command.ids);
      return;
    case "SAVE_STATE":
      if (world === null) {
        postError("cannot save before INIT");
        return;
      }
      post({ type: "SAVED_STATE", data: serializeWorld(world), commandLog: [...commandLog] });
      return;
    case "RESTORE_STATE":
      try {
        world = deserializeWorld(command.data);
        runtime = createRuntime(world);
        running = false;
        resetTransient();
        postWorld();
        postStatus();
        postStats();
        postInspection();
        postSnapshot();
      } catch (error) {
        postError(error instanceof Error ? error.message : String(error));
      }
      return;
  }
}

onMessage((event: MessageEvent): void => {
  const parsed = parseWorkerCommand(event.data);
  if (!parsed.ok) {
    postError(parsed.error);
    return;
  }
  try {
    handleCommand(parsed.command);
  } catch (error) {
    postError(error instanceof Error ? error.message : String(error));
  }
});

// ---------------------------------------------------------------------------
// The frame loop.
// ---------------------------------------------------------------------------

function schedule(): void {
  setTimeout(loop, running ? FRAME_INTERVAL_MS : IDLE_INTERVAL_MS);
}

function loop(): void {
  const now = performance.now();
  const elapsed = Math.min(now - lastFrameTime, 250);
  lastFrameTime = now;

  if (running && world !== null && runtime !== null) {
    accumulator += (elapsed / 1000) * TICKS_PER_SECOND * speed;
    if (accumulator > MAX_ACCUMULATOR_TICKS) accumulator = MAX_ACCUMULATOR_TICKS;
    let remaining = Math.min(Math.floor(accumulator), MAX_TICKS_PER_FRAME);
    accumulator -= remaining;

    const deadline = now + FRAME_BUDGET_MS;
    while (remaining > 0) {
      stepWorld(world, runtime);
      remaining--;
      if (performance.now() >= deadline) break;
    }

    if (world.tick - lastStatsTick >= STATS_INTERVAL_TICKS) {
      lastStatsTick = world.tick;
      postStats();
    }
    if (inspectId !== null && world.tick - lastInspectionTick >= INSPECTION_INTERVAL_TICKS) {
      lastInspectionTick = world.tick;
      postInspection();
    }
    if (now - lastSnapshotTime >= SNAPSHOT_MIN_INTERVAL_MS) {
      postSnapshot();
    }
  }

  schedule();
}

// ---------------------------------------------------------------------------
// Boot.
// ---------------------------------------------------------------------------

installWorld(DEFAULT_CONFIG);
lastFrameTime = performance.now();
postWorld();
postStatus();
postStats();
postSnapshot();
schedule();
