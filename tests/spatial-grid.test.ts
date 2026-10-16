import { describe, expect, it } from "vitest";
import { SpatialGrid } from "@/simulation/engine/spatial-grid";

describe("SpatialGrid", () => {
  it("returns only ids whose position is within the query radius", () => {
    const grid = new SpatialGrid(50, 200, 200, 16);
    grid.clear();
    grid.insert(0, 10, 10);
    grid.insert(1, 30, 30);
    grid.insert(2, 150, 150);

    const out: number[] = [];
    const n = grid.queryCircle(10, 10, 30, out);
    const found = out.slice(0, n).sort();
    expect(found).toEqual([0, 1]);
  });

  it("handles queries that fall outside the world bounds", () => {
    const grid = new SpatialGrid(50, 200, 200, 8);
    grid.clear();
    grid.insert(0, 5, 5);
    const out: number[] = [];
    const n = grid.queryCircle(0, 0, 100, out);
    expect(out.slice(0, n)).toContain(0);
  });

  it("honours capacity without throwing and can be reused across ticks", () => {
    const grid = new SpatialGrid(50, 200, 200, 2);
    grid.clear();
    grid.insert(0, 10, 10);
    grid.insert(1, 20, 20);
    grid.insert(2, 30, 30); // beyond capacity, ignored
    expect(grid.size()).toBe(2);

    grid.clear();
    expect(grid.size()).toBe(0);
    const out: number[] = [];
    expect(grid.queryCircle(10, 10, 5, out)).toBe(0);
  });

  it("finds items across multiple grid cells", () => {
    const grid = new SpatialGrid(32, 300, 300, 64);
    grid.clear();
    for (let i = 0; i < 20; i++) grid.insert(i, i * 12, i * 12);
    const out: number[] = [];
    const n = grid.queryCircle(0, 0, 60, out);
    expect(n).toBeGreaterThan(0);
    for (let k = 0; k < n; k++) {
      const id = out[k];
      const d = Math.hypot(id * 12, id * 12);
      expect(d).toBeLessThanOrEqual(60 + 1e-9);
    }
  });
});
