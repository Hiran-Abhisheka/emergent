import {
  OBSTACLE_BORDER_MARGIN,
  OBSTACLE_COUNT,
  OBSTACLE_MAX_RADIUS,
  OBSTACLE_MIN_RADIUS,
  OBSTACLE_MIN_SEPARATION,
  OBSTACLE_PLACEMENT_ATTEMPTS,
  OBSTACLE_RECT_MAX_SIDE,
  OBSTACLE_RECT_MIN_SIDE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../constants";
import type { Obstacle } from "../types";
import type { Rng } from "./prng";
import { distance, obstacleBoundingRadius } from "./geometry";

/**
 * Generates the static obstacle field from the seed. A deterministic mix of
 * circles and rectangles, kept away from the walls and from each other.
 */
export function generateObstacles(rng: Rng): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const radii: number[] = [];
  const margin = OBSTACLE_BORDER_MARGIN;

  for (let i = 0; i < OBSTACLE_COUNT; i++) {
    const makeCircle = rng.nextFloat() < 0.5;
    for (let attempt = 0; attempt < OBSTACLE_PLACEMENT_ATTEMPTS; attempt++) {
      let candidate: Obstacle;
      if (makeCircle) {
        const radius = rng.nextRange(OBSTACLE_MIN_RADIUS, OBSTACLE_MAX_RADIUS);
        candidate = {
          id: i,
          kind: "circle",
          radius,
          x: rng.nextRange(margin + radius, WORLD_WIDTH - margin - radius),
          y: rng.nextRange(margin + radius, WORLD_HEIGHT - margin - radius),
        };
      } else {
        const width = rng.nextRange(OBSTACLE_RECT_MIN_SIDE, OBSTACLE_RECT_MAX_SIDE);
        const height = rng.nextRange(OBSTACLE_RECT_MIN_SIDE, OBSTACLE_RECT_MAX_SIDE);
        candidate = {
          id: i,
          kind: "rect",
          width,
          height,
          x: rng.nextRange(margin + width / 2, WORLD_WIDTH - margin - width / 2),
          y: rng.nextRange(margin + height / 2, WORLD_HEIGHT - margin - height / 2),
        };
      }

      const candidateRadius = obstacleBoundingRadius(candidate);
      let overlaps = false;
      for (let j = 0; j < obstacles.length; j++) {
        if (
          distance(candidate.x, candidate.y, obstacles[j].x, obstacles[j].y) <
          candidateRadius + radii[j] + OBSTACLE_MIN_SEPARATION
        ) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        obstacles.push(candidate);
        radii.push(candidateRadius);
        break;
      }
    }
  }
  return obstacles;
}

/** True when the point lies inside any obstacle, expanded by `padding`. */
export function pointInsideAnyObstacle(
  obstacles: Obstacle[],
  x: number,
  y: number,
  padding: number,
): boolean {
  for (const o of obstacles) {
    if (o.kind === "circle") {
      const dx = x - o.x;
      const dy = y - o.y;
      const r = o.radius + padding;
      if (dx * dx + dy * dy <= r * r) return true;
    } else {
      if (
        x >= o.x - o.width / 2 - padding &&
        x <= o.x + o.width / 2 + padding &&
        y >= o.y - o.height / 2 - padding &&
        y <= o.y + o.height / 2 + padding
      ) {
        return true;
      }
    }
  }
  return false;
}
