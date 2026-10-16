/**
 * Uniform spatial grid for broad-phase neighbour queries.
 *
 * The grid is a reusable runtime cache: it is cleared and refilled every tick
 * and never serialised. It uses preallocated typed arrays and a per-cell linked
 * list, so insertion and clearing allocate nothing.
 *
 * Slots store a caller-supplied integer id plus a copy of the position, so a
 * query needs no access to the caller's arrays.
 */
export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  private readonly width: number;
  private readonly height: number;

  private readonly heads: Int32Array;
  private readonly next: Int32Array;
  private readonly ids: Int32Array;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly capacity: number;
  private count = 0;

  constructor(cellSize: number, width: number, height: number, capacity: number) {
    this.cellSize = cellSize;
    this.width = width;
    this.height = height;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.capacity = Math.max(1, capacity);
    this.heads = new Int32Array(this.cols * this.rows).fill(-1);
    this.next = new Int32Array(this.capacity);
    this.ids = new Int32Array(this.capacity);
    this.px = new Float32Array(this.capacity);
    this.py = new Float32Array(this.capacity);
  }

  /** Removes every item. Cheap: only the cell heads are reset. */
  clear(): void {
    this.heads.fill(-1);
    this.count = 0;
  }

  private cellIndex(x: number, y: number): number {
    let cx = Math.floor(x / this.cellSize);
    let cy = Math.floor(y / this.cellSize);
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  /** Inserts an item. Silently ignores items beyond capacity. */
  insert(id: number, x: number, y: number): void {
    if (this.count >= this.capacity) return;
    const slot = this.count++;
    this.ids[slot] = id;
    this.px[slot] = x;
    this.py[slot] = y;
    const cell = this.cellIndex(x, y);
    this.next[slot] = this.heads[cell];
    this.heads[cell] = slot;
  }

  /**
   * Collects ids of items whose stored position lies within `radius` of
   * (x, y). Writes into `out` and returns the number written. `out` is reused
   * by the caller to avoid allocations.
   */
  queryCircle(x: number, y: number, radius: number, out: number[]): number {
    let written = 0;
    const r2 = radius * radius;
    const minCx = Math.max(0, Math.floor((x - radius) / this.cellSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((x + radius) / this.cellSize));
    const minCy = Math.max(0, Math.floor((y - radius) / this.cellSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((y + radius) / this.cellSize));

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowBase = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        let slot = this.heads[rowBase + cx];
        while (slot !== -1) {
          const dx = this.px[slot] - x;
          const dy = this.py[slot] - y;
          if (dx * dx + dy * dy <= r2) {
            out[written++] = this.ids[slot];
          }
          slot = this.next[slot];
        }
      }
    }
    return written;
  }

  /** Number of items currently inserted (for diagnostics/tests). */
  size(): number {
    return this.count;
  }

  get worldWidth(): number {
    return this.width;
  }

  get worldHeight(): number {
    return this.height;
  }
}
