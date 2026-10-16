import { describe, expect, it } from "vitest";
import { DEFAULT_ZOOM, MAX_ZOOM, MIN_ZOOM, clampZoom, panBy, screenToWorld, worldToScreen, zoomAt, type Camera } from "@/simulation/renderer/camera";

const W = 800;
const H = 600;

describe("camera transforms", () => {
  const cam: Camera = { x: 400, y: 300, zoom: 1.5 };

  it("maps the camera centre to the canvas centre", () => {
    const p = worldToScreen(cam, W, H, cam.x, cam.y);
    expect(p.x).toBeCloseTo(W / 2, 10);
    expect(p.y).toBeCloseTo(H / 2, 10);
  });

  it("round-trips screen -> world -> screen", () => {
    for (const [sx, sy] of [
      [0, 0],
      [W, H],
      [123, 456],
    ]) {
      const world = screenToWorld(cam, W, H, sx, sy);
      const back = worldToScreen(cam, W, H, world.x, world.y);
      expect(back.x).toBeCloseTo(sx, 8);
      expect(back.y).toBeCloseTo(sy, 8);
    }
  });

  it("keeps the world point under the cursor fixed while zooming", () => {
    const sx = 640;
    const sy = 210;
    const before = screenToWorld(cam, W, H, sx, sy);
    const zoomed = zoomAt(cam, W, H, sx, sy, 1.4);
    const after = screenToWorld(zoomed, W, H, sx, sy);
    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
    expect(zoomed.zoom).toBeCloseTo(cam.zoom * 1.4, 10);
  });

  it("clamps zoom to the documented range", () => {
    expect(clampZoom(0.0001)).toBe(MIN_ZOOM);
    expect(clampZoom(999)).toBe(MAX_ZOOM);
    expect(clampZoom(DEFAULT_ZOOM)).toBe(DEFAULT_ZOOM);
  });

  it("pans opposite to the drag direction, scaled by zoom", () => {
    const panned = panBy(cam, 30, -45);
    expect(panned.x).toBeCloseTo(cam.x - 30 / cam.zoom, 10);
    expect(panned.y).toBeCloseTo(cam.y + 45 / cam.zoom, 10);
  });
});
