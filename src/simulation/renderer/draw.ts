import type { Obstacle } from "../types";
import type { ColorMode } from "../worker-messages";
import { PALETTE, creatureColor } from "./colors";
import { screenToWorld, worldToScreen, type Camera } from "./camera";
import { FOOD_RADIUS } from "../constants";

/** Everything the renderer needs about the world's static geometry. */
export interface WorldView {
  width: number;
  height: number;
  obstacles: Obstacle[];
  creatureRadius: number;
  maxEnergy: number;
}

/** Per-frame view toggles (all real; nothing decorative is faked). */
export interface ViewOptions {
  showFood: boolean;
  showObstacles: boolean;
  showSensorLines: boolean;
  showVisionCircle: boolean;
  showLabels: boolean;
}

/** The render-facing part of a SNAPSHOT event. */
export interface SceneData {
  count: number;
  foodCount: number;
  stride: number;
  colorMode: ColorMode;
  maxGeneration: number;
  data: Float32Array;
}

/** The selected creature's live data, used for overlays. */
export interface OverlayData {
  x: number;
  y: number;
  heading: number;
  visionRange: number;
  foodProximity: number;
  foodBearing: number;
  foodVisible: number;
  obstacleProximity: number;
  obstacleBearing: number;
}

const GRID_STEP = 100;

function drawBackground(
  ctx: CanvasRenderingContext2D,
  view: WorldView,
  cam: Camera,
  w: number,
  h: number,
): void {
  ctx.fillStyle = PALETTE.abyss;
  ctx.fillRect(0, 0, w, h);

  const tl = screenToWorld(cam, w, h, 0, 0);
  const br = screenToWorld(cam, w, h, w, h);

  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.gridLine;
  ctx.beginPath();
  const startX = Math.floor(Math.max(tl.x, 0) / GRID_STEP) * GRID_STEP;
  for (let x = startX; x <= Math.min(br.x, view.width); x += GRID_STEP) {
    const sx = Math.round(worldToScreen(cam, w, h, x, 0).x) + 0.5;
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, h);
  }
  const startY = Math.floor(Math.max(tl.y, 0) / GRID_STEP) * GRID_STEP;
  for (let y = startY; y <= Math.min(br.y, view.height); y += GRID_STEP) {
    const sy = Math.round(worldToScreen(cam, w, h, 0, y).y) + 0.5;
    ctx.moveTo(0, sy);
    ctx.lineTo(w, sy);
  }
  ctx.stroke();

  // World boundary.
  const origin = worldToScreen(cam, w, h, 0, 0);
  const corner = worldToScreen(cam, w, h, view.width, view.height);
  ctx.strokeStyle = PALETTE.wall;
  ctx.lineWidth = 2;
  ctx.strokeRect(origin.x, origin.y, corner.x - origin.x, corner.y - origin.y);
}

function drawCoordinateTicks(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  w: number,
  h: number,
  view: WorldView,
): void {
  const step = cam.zoom > 1.2 ? 100 : 200;
  ctx.fillStyle = PALETTE.label;
  ctx.font = "10px ui-monospace, monospace";
  const tl = screenToWorld(cam, w, h, 0, 0);
  const br = screenToWorld(cam, w, h, w, h);
  for (let x = Math.ceil(tl.x / step) * step; x <= br.x; x += step) {
    if (x < 0 || x > view.width) continue;
    const s = worldToScreen(cam, w, h, x, 0);
    ctx.fillText(String(x), s.x + 2, 12);
  }
  for (let y = Math.ceil(tl.y / step) * step; y <= br.y; y += step) {
    if (y < 0 || y > view.height) continue;
    const s = worldToScreen(cam, w, h, 0, y);
    ctx.fillText(String(y), 2, s.y - 2);
  }
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  view: WorldView,
  cam: Camera,
  w: number,
  h: number,
): void {
  ctx.fillStyle = PALETTE.obstacle;
  ctx.strokeStyle = PALETTE.obstacleEdge;
  ctx.lineWidth = 1;
  for (const o of view.obstacles) {
    if (o.kind === "circle") {
      const c = worldToScreen(cam, w, h, o.x, o.y);
      const r = o.radius * cam.zoom;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const tl = worldToScreen(cam, w, h, o.x - o.width / 2, o.y - o.height / 2);
      ctx.fillRect(tl.x, tl.y, o.width * cam.zoom, o.height * cam.zoom);
      ctx.strokeRect(tl.x, tl.y, o.width * cam.zoom, o.height * cam.zoom);
    }
  }
}

function drawFood(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  cam: Camera,
  w: number,
  h: number,
): void {
  const base = scene.count * scene.stride;
  const r = Math.max(1.5, FOOD_RADIUS * cam.zoom);
  ctx.fillStyle = scene.colorMode === "energy" ? PALETTE.food : PALETTE.foodDim;
  ctx.beginPath();
  for (let i = 0; i < scene.foodCount; i++) {
    const x = scene.data[base + i * 2];
    const y = scene.data[base + i * 2 + 1];
    const s = worldToScreen(cam, w, h, x, y);
    if (s.x < -5 || s.y < -5 || s.x > w + 5 || s.y > h + 5) continue;
    ctx.moveTo(s.x + r, s.y);
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  }
  ctx.fill();
}

function drawCreatures(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  view: WorldView,
  cam: Camera,
  w: number,
  h: number,
  options: ViewOptions,
): void {
  const { stride, data } = scene;
  const r = Math.max(2.2, view.creatureRadius * cam.zoom);
  for (let i = 0; i < scene.count; i++) {
    const o = i * stride;
    const x = data[o];
    const y = data[o + 1];
    const heading = data[o + 2];
    const flags = data[o + 4];
    const colorValue = data[o + 5];
    const s = worldToScreen(cam, w, h, x, y);
    if (s.x < -20 || s.y < -20 || s.x > w + 20 || s.y > h + 20) continue;

    if ((flags & 1) === 1) {
      ctx.fillStyle = PALETTE.selection;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = creatureColor(scene.colorMode, colorValue, scene.maxGeneration, view.maxEnergy);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Heading tick.
    ctx.strokeStyle = PALETTE.void;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(heading) * r * 1.9, s.y + Math.sin(heading) * r * 1.9);
    ctx.stroke();

    if (options.showLabels && cam.zoom > 0.45) {
      ctx.fillStyle = PALETTE.label;
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText(String(Math.round(colorValue)), s.x + r + 1, s.y - r);
    }
  }
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlay: OverlayData,
  cam: Camera,
  w: number,
  h: number,
  options: ViewOptions,
): void {
  const c = worldToScreen(cam, w, h, overlay.x, overlay.y);

  if (options.showVisionCircle) {
    ctx.strokeStyle = PALETTE.vision;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, overlay.visionRange * cam.zoom, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (!options.showSensorLines) return;

  const drawSense = (
    bearing: number,
    proximity: number,
    color: string,
  ): void => {
    const angle = overlay.heading + bearing * Math.PI;
    const dist = Math.max(0, 1 - proximity) * overlay.visionRange;
    const target = worldToScreen(
      cam,
      w,
      h,
      overlay.x + Math.cos(angle) * dist,
      overlay.y + Math.sin(angle) * dist,
    );
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  };

  if (overlay.foodVisible > 0) {
    drawSense(overlay.foodBearing, overlay.foodProximity, PALETTE.sensorFood);
  }
  if (overlay.obstacleProximity > 0) {
    drawSense(overlay.obstacleBearing, overlay.obstacleProximity, PALETTE.sensorObstacle);
  }
}

/**
 * Draws one complete frame. Pure with respect to state: it reads the snapshot
 * and view data and paints; it never mutates simulation state.
 */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: SceneData,
  view: WorldView,
  cam: Camera,
  options: ViewOptions,
  overlay: OverlayData | null,
  canvasWidth: number,
  canvasHeight: number,
): void {
  drawBackground(ctx, view, cam, canvasWidth, canvasHeight);
  drawCoordinateTicks(ctx, cam, canvasWidth, canvasHeight, view);
  if (options.showObstacles) drawObstacles(ctx, view, cam, canvasWidth, canvasHeight);
  if (options.showFood) drawFood(ctx, scene, cam, canvasWidth, canvasHeight);
  drawCreatures(ctx, scene, view, cam, canvasWidth, canvasHeight, options);
  if (overlay !== null) drawOverlays(ctx, overlay, cam, canvasWidth, canvasHeight, options);
}
