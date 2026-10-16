import { FOOD_DENSITY_SATURATION, WORLD_HEIGHT, WORLD_WIDTH } from "../constants";
import type { Creature, WorldState } from "../types";
import type { WorldRuntime } from "./world";
import { angleToObstacle, clamp, distance, distanceToObstacle, distanceToWall, wrapAngle } from "./geometry";

/**
 * Fills the 8-element sensor vector for one creature. All values are bounded:
 * indices 0,1,3,4,6,7 are in [0,1] and indices 2,5 (bearings) are in [-1,1].
 *
 * Perception is limited to the creature's own vision range. When no food or
 * obstacle is visible, proximity/bearing are 0 and the visible flag is 0.
 * Perception is omnidirectional (field-of-view is a documented future
 * extension, see docs/DECISIONS.md).
 */
export function computeSensors(
  world: WorldState,
  runtime: WorldRuntime,
  creature: Creature,
  out: Float32Array,
): void {
  const config = world.config;
  const range = creature.traits.visionRange;
  const x = creature.x;
  const y = creature.y;

  // 0: energy
  out[0] = clamp(creature.energy / config.maxEnergy, 0, 1);

  // 1,2,3,7: nearest visible food + visible flag + local food density
  const count = runtime.foodGrid.queryCircle(x, y, range, runtime.foodCandidates);
  let nearestDist = Number.POSITIVE_INFINITY;
  let nearestIndex = -1;
  let visible = 0;
  for (let k = 0; k < count; k++) {
    const idx = runtime.foodCandidates[k];
    const f = world.food[idx];
    if (f.eaten) continue;
    const d = distance(x, y, f.x, f.y);
    if (d > range) continue;
    visible++;
    if (d < nearestDist) {
      nearestDist = d;
      nearestIndex = idx;
    }
  }

  if (nearestIndex >= 0) {
    const f = world.food[nearestIndex];
    out[1] = clamp(1 - nearestDist / range, 0, 1);
    out[2] = wrapAngle(Math.atan2(f.y - y, f.x - x) - creature.heading) / Math.PI;
    out[3] = 1;
  } else {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }
  out[7] = clamp(visible / FOOD_DENSITY_SATURATION, 0, 1);

  // 4,5: nearest obstacle or wall
  const oCount = runtime.obstacleGrid.queryCircle(
    x,
    y,
    range + runtime.obstacleQueryPadding,
    runtime.obstacleCandidates,
  );
  let obstacleDist = Number.POSITIVE_INFINITY;
  let obstacleAngle = 0;
  for (let k = 0; k < oCount; k++) {
    const o = world.obstacles[runtime.obstacleCandidates[k]];
    const d = distanceToObstacle(o, x, y);
    if (d > range) continue;
    if (d < obstacleDist) {
      obstacleDist = d;
      obstacleAngle = angleToObstacle(o, x, y);
    }
  }

  const wall = distanceToWall(x, y, WORLD_WIDTH, WORLD_HEIGHT);
  if (wall.distance < obstacleDist && wall.distance <= range) {
    obstacleDist = wall.distance;
    obstacleAngle = wall.angle;
  }

  if (obstacleDist <= range && Number.isFinite(obstacleDist)) {
    out[4] = clamp(1 - obstacleDist / range, 0, 1);
    out[5] = wrapAngle(obstacleAngle - creature.heading) / Math.PI;
  } else {
    out[4] = 0;
    out[5] = 0;
  }

  // 6: previous speed relative to this creature's own maximum speed
  out[6] = clamp(creature.speed / creature.traits.maxSpeed, 0, 1);
}
