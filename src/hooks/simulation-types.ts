import type { ColorMode } from "@/simulation/worker-messages";

/** Render-facing snapshot (the buffers are owned by the caller until acked). */
export interface SnapshotData {
  tick: number;
  count: number;
  foodCount: number;
  stride: number;
  colorMode: ColorMode;
  maxGeneration: number;
  data: Float32Array;
  ids: Int32Array;
}
