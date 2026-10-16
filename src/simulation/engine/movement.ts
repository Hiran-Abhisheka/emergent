import {
  MOVEMENT_SMOOTHING,
  OUTPUT_THRUST,
  OUTPUT_TURN_LEFT,
  OUTPUT_TURN_RIGHT,
  STOP_SPEED_EPSILON,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../constants";
import type { SimConfig } from "../config";
import type { Creature, WorldState } from "../types";
import type { WorldRuntime } from "./world";
import { circleIntersectsObstacle, clamp, pushOutOfObstacle, wrapAngle } from "./geometry";

/**
 * Applies the network's steering outputs to heading and speed. Turning is
 * symmetric: (right - left) * maxTurnRate. Thrust only pushes forward
 * (negative thrust simply coasts down to a stop). Speed is smoothed so the
 * "previous speed" sensor is a meaningful low-pass of recent thrust.
 */
export function applySteering(creature: Creature, outputs: Float32Array, config: SimConfig): void {
  const turn = outputs[OUTPUT_TURN_RIGHT] - outputs[OUTPUT_TURN_LEFT];
  creature.heading = wrapAngle(creature.heading + turn * config.maxTurnRate);

  const thrust = outputs[OUTPUT_THRUST];
  const target = thrust > 0 ? thrust * creature.traits.maxSpeed : 0;
  creature.speed += (target - creature.speed) * MOVEMENT_SMOOTHING;
  if (Math.abs(creature.speed) < STOP_SPEED_EPSILON) creature.speed = 0;
}

/**
 * Moves the creature by its current speed and resolves wall/obstacle
 * collisions by pushing it back onto the surface. On any contact the speed is
 * zeroed, so creatures cannot tunnel through obstacles at high speed.
 */
export function integrateMovement(
  world: WorldState,
  runtime: WorldRuntime,
  creature: Creature,
  config: SimConfig,
): void {
  const radius = config.creatureRadius;
  let x = creature.x + Math.cos(creature.heading) * creature.speed;
  let y = creature.y + Math.sin(creature.heading) * creature.speed;
  let collided = false;

  if (x < radius) {
    x = radius;
    collided = true;
  } else if (x > WORLD_WIDTH - radius) {
    x = WORLD_WIDTH - radius;
    collided = true;
  }
  if (y < radius) {
    y = radius;
    collided = true;
  } else if (y > WORLD_HEIGHT - radius) {
    y = WORLD_HEIGHT - radius;
    collided = true;
  }

  const count = runtime.obstacleGrid.queryCircle(
    x,
    y,
    radius + runtime.obstacleQueryPadding,
    runtime.obstacleCandidates,
  );
  for (let k = 0; k < count; k++) {
    const o = world.obstacles[runtime.obstacleCandidates[k]];
    if (circleIntersectsObstacle(o, x, y, radius)) {
      const pushed = pushOutOfObstacle(o, x, y, radius);
      x = pushed.x;
      y = pushed.y;
      collided = true;
    }
  }

  creature.x = clamp(x, radius, WORLD_WIDTH - radius);
  creature.y = clamp(y, radius, WORLD_HEIGHT - radius);
  if (collided) creature.speed = 0;
}
