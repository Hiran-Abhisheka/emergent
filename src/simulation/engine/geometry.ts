import type { Obstacle } from "../types";

/** Wraps an angle to the range (-π, π]. */
export function wrapAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

export function distance(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Radius of a circle that contains the whole obstacle. */
export function obstacleBoundingRadius(o: Obstacle): number {
  if (o.kind === "circle") return o.radius;
  return Math.hypot(o.width / 2, o.height / 2);
}

/** Nearest point on an obstacle to (x, y); for circles that is on the rim. */
function nearestPointOnObstacle(o: Obstacle, x: number, y: number): { x: number; y: number } {
  if (o.kind === "circle") {
    const dx = x - o.x;
    const dy = y - o.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) return { x: o.x + o.radius, y: o.y };
    return { x: o.x + (dx / d) * o.radius, y: o.y + (dy / d) * o.radius };
  }
  const halfW = o.width / 2;
  const halfH = o.height / 2;
  const nx = clamp(x, o.x - halfW, o.x + halfW);
  const ny = clamp(y, o.y - halfH, o.y + halfH);
  return { x: nx, y: ny };
}

/** Distance from (x, y) to the obstacle's boundary (0 if inside). */
export function distanceToObstacle(o: Obstacle, x: number, y: number): number {
  const p = nearestPointOnObstacle(o, x, y);
  const d = distance(x, y, p.x, p.y);
  if (o.kind === "circle") {
    return Math.max(0, d - o.radius);
  }
  // If (x,y) projects strictly inside the box, it is inside the rectangle.
  const inside =
    x > o.x - o.width / 2 &&
    x < o.x + o.width / 2 &&
    y > o.y - o.height / 2 &&
    y < o.y + o.height / 2;
  return inside ? 0 : d;
}

/** Angle from (x, y) to the nearest point on the obstacle. */
export function angleToObstacle(o: Obstacle, x: number, y: number): number {
  const p = nearestPointOnObstacle(o, x, y);
  return Math.atan2(p.y - y, p.x - x);
}

/** True when a disc of `radius` centred at (x, y) penetrates the obstacle. */
export function circleIntersectsObstacle(o: Obstacle, x: number, y: number, radius: number): boolean {
  return distanceToObstacle(o, x, y) < radius;
}

/**
 * Moves a disc at (x, y) of the given radius out of an obstacle along the
 * shortest direction. Returns the corrected position.
 */
export function pushOutOfObstacle(
  o: Obstacle,
  x: number,
  y: number,
  radius: number,
): { x: number; y: number } {
  if (o.kind === "circle") {
    let dx = x - o.x;
    let dy = y - o.y;
    let d = Math.hypot(dx, dy);
    const minDist = o.radius + radius;
    if (d >= minDist) return { x, y };
    if (d === 0) {
      dx = 1;
      dy = 0;
      d = 1;
    }
    return { x: o.x + (dx / d) * minDist, y: o.y + (dy / d) * minDist };
  }

  const halfW = o.width / 2;
  const halfH = o.height / 2;
  const left = o.x - halfW;
  const right = o.x + halfW;
  const top = o.y - halfH;
  const bottom = o.y + halfH;

  const inside = x > left && x < right && y > top && y < bottom;
  if (inside) {
    // Push out through the nearest face.
    const dLeft = x - left;
    const dRight = right - x;
    const dTop = y - top;
    const dBottom = bottom - y;
    const m = Math.min(dLeft, dRight, dTop, dBottom);
    if (m === dLeft) return { x: left - radius, y };
    if (m === dRight) return { x: right + radius, y };
    if (m === dTop) return { x, y: top - radius };
    return { x, y: bottom + radius };
  }

  const nx = clamp(x, left, right);
  const ny = clamp(y, top, bottom);
  const dx = x - nx;
  const dy = y - ny;
  const d = Math.hypot(dx, dy);
  if (d >= radius || d === 0) return { x, y };
  return { x: nx + (dx / d) * radius, y: ny + (dy / d) * radius };
}

/** Distance from (x, y) to the closest wall. */
export function distanceToWall(
  x: number,
  y: number,
  width: number,
  height: number,
): { distance: number; angle: number } {
  const dl = x;
  const dr = width - x;
  const dt = y;
  const db = height - y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return { distance: dl, angle: Math.PI };
  if (m === dr) return { distance: dr, angle: 0 };
  if (m === dt) return { distance: dt, angle: -Math.PI / 2 };
  return { distance: db, angle: Math.PI / 2 };
}
