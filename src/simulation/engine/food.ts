import {
  FOOD_OBSTACLE_PADDING,
  FOOD_PLACEMENT_ATTEMPTS,
  FOOD_RADIUS,
  SPAWN_BORDER_MARGIN,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../constants";
import type { Food, Obstacle } from "../types";
import type { Rng } from "./prng";
import { pointInsideAnyObstacle } from "./obstacles";

/**
 * Patchy initial food: a background fraction spread uniformly, the rest in
 * Gaussian-free uniform discs around a handful of cluster centres. Placement
 * avoids obstacles. Ids are assigned in creation order and never reused.
 */
export function generateInitialFood(rng: Rng, config: {
  initialFood: number;
  foodClusterCount: number;
  foodClusterRadius: number;
  foodBackgroundFraction: number;
}, obstacles: Obstacle[]): Food[] {
  const food: Food[] = [];
  const margin = SPAWN_BORDER_MARGIN;

  const backgroundCount = Math.round(config.initialFood * config.foodBackgroundFraction);

  const centres: { x: number; y: number }[] = [];
  for (let c = 0; c < config.foodClusterCount; c++) {
    centres.push({
      x: rng.nextRange(margin, WORLD_WIDTH - margin),
      y: rng.nextRange(margin, WORLD_HEIGHT - margin),
    });
  }

  // With no clusters, everything is background; otherwise the clustered part
  // is the remainder after the background fraction.
  const clusteredCount = centres.length > 0 ? config.initialFood - backgroundCount : 0;
  const uniformCount = config.initialFood - clusteredCount;

  const place = (x: number, y: number): void => {
    if (pointInsideAnyObstacle(obstacles, x, y, FOOD_RADIUS + FOOD_OBSTACLE_PADDING)) return;
    food.push({ id: food.length, x, y, eaten: false });
  };

  const clusteredPerCentre = centres.length > 0 ? Math.ceil(clusteredCount / centres.length) : 0;

  for (let c = 0; c < centres.length; c++) {
    const remaining = Math.min(clusteredPerCentre, clusteredCount - c * clusteredPerCentre);
    for (let k = 0; k < remaining; k++) {
      for (let attempt = 0; attempt < FOOD_PLACEMENT_ATTEMPTS; attempt++) {
        const angle = rng.nextRange(0, 2 * Math.PI);
        const radius = config.foodClusterRadius * Math.sqrt(rng.nextFloat());
        const x = centres[c].x + Math.cos(angle) * radius;
        const y = centres[c].y + Math.sin(angle) * radius;
        if (x < margin || x > WORLD_WIDTH - margin || y < margin || y > WORLD_HEIGHT - margin) continue;
        if (pointInsideAnyObstacle(obstacles, x, y, FOOD_RADIUS + FOOD_OBSTACLE_PADDING)) continue;
        place(x, y);
        break;
      }
    }
  }

  for (let k = 0; k < uniformCount; k++) {
    for (let attempt = 0; attempt < FOOD_PLACEMENT_ATTEMPTS; attempt++) {
      const x = rng.nextRange(margin, WORLD_WIDTH - margin);
      const y = rng.nextRange(margin, WORLD_HEIGHT - margin);
      if (pointInsideAnyObstacle(obstacles, x, y, FOOD_RADIUS + FOOD_OBSTACLE_PADDING)) continue;
      place(x, y);
      break;
    }
  }

  return food;
}

/**
 * Accumulates fractional regeneration and spawns food up to the cap. Draws
 * from the world RNG so regeneration is part of the deterministic run.
 * Returns the number of items spawned.
 */
export function regenerateFood(
  rng: Rng,
  food: Food[],
  nextFoodId: number,
  accumulator: number,
  config: { foodRegenPerTick: number; maxFood: number },
  obstacles: Obstacle[],
): { spawned: number; nextFoodId: number; accumulator: number } {
  const margin = SPAWN_BORDER_MARGIN;
  let acc = accumulator + config.foodRegenPerTick;
  let id = nextFoodId;
  let spawned = 0;

  while (acc >= 1 && food.length < config.maxFood) {
    acc -= 1;
    for (let attempt = 0; attempt < FOOD_PLACEMENT_ATTEMPTS; attempt++) {
      const x = rng.nextRange(margin, WORLD_WIDTH - margin);
      const y = rng.nextRange(margin, WORLD_HEIGHT - margin);
      if (pointInsideAnyObstacle(obstacles, x, y, FOOD_RADIUS + FOOD_OBSTACLE_PADDING)) continue;
      food.push({ id: id++, x, y, eaten: false });
      spawned++;
      break;
    }
  }

  return { spawned, nextFoodId: id, accumulator: acc };
}
