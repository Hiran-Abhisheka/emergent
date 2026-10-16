import { WORLD_HEIGHT, WORLD_WIDTH } from "../constants";

/** Camera: world point at the canvas centre, plus a zoom factor (px per unit). */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 6;
export const DEFAULT_ZOOM = 0.7;

export function clampZoom(zoom: number): number {
  if (zoom < MIN_ZOOM) return MIN_ZOOM;
  if (zoom > MAX_ZOOM) return MAX_ZOOM;
  return zoom;
}

/** Camera centred on the world with a zoom that fits the canvas. */
export function fitCamera(canvasWidth: number, canvasHeight: number): Camera {
  const zoom = clampZoom(Math.min(canvasWidth / WORLD_WIDTH, canvasHeight / WORLD_HEIGHT) * 0.96);
  return { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom };
}

export function worldToScreen(
  cam: Camera,
  canvasWidth: number,
  canvasHeight: number,
  wx: number,
  wy: number,
): { x: number; y: number } {
  return {
    x: (wx - cam.x) * cam.zoom + canvasWidth / 2,
    y: (wy - cam.y) * cam.zoom + canvasHeight / 2,
  };
}

export function screenToWorld(
  cam: Camera,
  canvasWidth: number,
  canvasHeight: number,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return {
    x: (sx - canvasWidth / 2) / cam.zoom + cam.x,
    y: (sy - canvasHeight / 2) / cam.zoom + cam.y,
  };
}

export function panBy(cam: Camera, dxScreen: number, dyScreen: number): Camera {
  return { x: cam.x - dxScreen / cam.zoom, y: cam.y - dyScreen / cam.zoom, zoom: cam.zoom };
}

/** Zooms about a screen point, keeping the world point under it fixed. */
export function zoomAt(
  cam: Camera,
  canvasWidth: number,
  canvasHeight: number,
  sx: number,
  sy: number,
  factor: number,
): Camera {
  const before = screenToWorld(cam, canvasWidth, canvasHeight, sx, sy);
  const zoom = clampZoom(cam.zoom * factor);
  return {
    x: before.x - (sx - canvasWidth / 2) / zoom,
    y: before.y - (sy - canvasHeight / 2) / zoom,
    zoom,
  };
}

/** Keeps the camera centre within a modest margin of the world. */
export function clampCamera(cam: Camera): Camera {
  const margin = 200;
  return {
    x: Math.min(Math.max(cam.x, -margin), WORLD_WIDTH + margin),
    y: Math.min(Math.max(cam.y, -margin), WORLD_HEIGHT + margin),
    zoom: cam.zoom,
  };
}
