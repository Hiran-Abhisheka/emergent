import { CREATURE_SPAWN_ATTEMPTS, WORLD_HEIGHT, WORLD_WIDTH } from "../constants";
import type { Obstacle } from "../types";
import type { Rng } from "./prng";
import { pointInsideAnyObstacle } from "./obstacles";

/** True when a disc of `radius` centred at (x, y) is fully inside the walls. */
export function isInsideWorld(x: number, y: number, radius: number): boolean {
  return x >= radius && x <= WORLD_WIDTH - radius && y >= radius && y <= WORLD_HEIGHT - radius;
}

/** True when (x, y) is inside the walls and clear of every obstacle. */
export function isSpawnFree(
  obstacles: Obstacle[],
  x: number,
  y: number,
  radius: number,
): boolean {
  if (!isInsideWorld(x, y, radius)) return false;
  return !pointInsideAnyObstacle(obstacles, x, y, radius);
}

/** Finds a random free spawn point, or null after a bounded number of tries. */
export function findRandomSpawn(
  rng: Rng,
  obstacles: Obstacle[],
  radius: number,
): { x: number; y: number } | null {
  for (let i = 0; i < CREATURE_SPAWN_ATTEMPTS; i++) {
    const x = rng.nextRange(radius, WORLD_WIDTH - radius);
    const y = rng.nextRange(radius, WORLD_HEIGHT - radius);
    if (isSpawnFree(obstacles, x, y, radius)) return { x, y };
  }
  return null;
}
