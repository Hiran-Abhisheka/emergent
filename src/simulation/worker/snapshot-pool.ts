import { SNAPSHOT_STRIDE } from "../constants";
import type { SimConfig } from "../config";
import type { WorldState } from "../types";
import type { ColorMode, WorkerEvent } from "../worker-messages";

/**
 * A pair of transferable buffers for one snapshot: the creature/food float
 * block and the parallel creature-id block (see docs/DECISIONS.md D-302).
 */
interface SnapshotBuffers {
  floats: Float32Array;
  ids: Int32Array;
}

type PostFn = (event: WorkerEvent, transfer?: Transferable[]) => void;

const POOL_SIZE = 2;

/**
 * Pooled, ack-gated snapshot publishing.
 *
 * `publish` takes a buffer pair from the pool and transfers it to the client;
 * `accept` returns it on SNAPSHOT_ACK. When the pool is empty (the client is
 * behind) `publish` returns false and the caller skips the frame, so a stalled
 * client drops frames instead of growing an unbounded queue. Two buffers are
 * kept so the very first snapshot can always be sent before any ACK arrives.
 */
export class SnapshotPool {
  private buffers: SnapshotBuffers[] = [];
  private floatsCapacity = 0;
  private idsCapacity = 0;

  constructor(private readonly post: PostFn) {}

  /** Drops all buffers; the next `publish` allocates fresh ones. */
  reset(): void {
    this.buffers = [];
    this.floatsCapacity = 0;
    this.idsCapacity = 0;
  }

  /** Returns a buffer pair handed back by the client after it has drawn it. */
  accept(data: Float32Array, ids: Int32Array): void {
    if (
      data.length === this.floatsCapacity &&
      ids.length === this.idsCapacity &&
      this.buffers.length < POOL_SIZE
    ) {
      this.buffers.push({ floats: data, ids });
    }
  }

  /** Fills and posts one snapshot. Returns false when no buffer is free. */
  publish(world: WorldState, colorMode: ColorMode, inspectId: number | null): boolean {
    this.ensure(world.config);
    const buffers = this.buffers.pop();
    if (buffers === undefined) return false;

    const { floats, ids } = buffers;
    const creatures = world.creatures;
    const count = creatures.length;
    let maxGeneration = 0;

    for (let i = 0; i < count; i++) {
      const c = creatures[i];
      const o = i * SNAPSHOT_STRIDE;
      floats[o] = c.x;
      floats[o + 1] = c.y;
      floats[o + 2] = c.heading;
      floats[o + 3] = c.energy;
      floats[o + 4] = c.id === inspectId ? 1 : 0;
      floats[o + 5] =
        colorMode === "energy"
          ? c.energy
          : colorMode === "speed"
            ? c.traits.maxSpeed
            : c.generation;
      ids[i] = c.id;
      if (c.generation > maxGeneration) maxGeneration = c.generation;
    }

    const food = world.food;
    const foodCount = food.length;
    const base = count * SNAPSHOT_STRIDE;
    for (let i = 0; i < foodCount; i++) {
      floats[base + i * 2] = food[i].x;
      floats[base + i * 2 + 1] = food[i].y;
    }

    this.post(
      {
        type: "SNAPSHOT",
        tick: world.tick,
        count,
        foodCount,
        stride: SNAPSHOT_STRIDE,
        colorMode,
        maxGeneration,
        data: floats,
        ids,
      },
      [floats.buffer, ids.buffer],
    );
    return true;
  }

  private ensure(config: SimConfig): void {
    const floatsCapacity =
      (config.maxPopulation + 8) * SNAPSHOT_STRIDE + (config.maxFood + 8) * 2;
    const idsCapacity = config.maxPopulation + 8;
    if (
      floatsCapacity === this.floatsCapacity &&
      idsCapacity === this.idsCapacity &&
      this.buffers.length > 0
    ) {
      return;
    }
    this.floatsCapacity = floatsCapacity;
    this.idsCapacity = idsCapacity;
    this.buffers = Array.from({ length: POOL_SIZE }, () => ({
      floats: new Float32Array(floatsCapacity),
      ids: new Int32Array(idsCapacity),
    }));
  }
}
