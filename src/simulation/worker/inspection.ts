import type { WorldState } from "../types";
import type { InspectedCreature } from "../worker-messages";

/**
 * Builds the inspector payload for one creature (or null if it is gone).
 * Telemetry arrays are copied so the client never shares engine memory.
 */
export function buildInspection(
  world: WorldState,
  id: number | null,
): InspectedCreature | null {
  if (id === null) return null;
  for (const c of world.creatures) {
    if (c.id !== id) continue;
    return {
      id: c.id,
      x: c.x,
      y: c.y,
      heading: c.heading,
      energy: c.energy,
      age: c.age,
      generation: c.generation,
      alive: c.alive,
      cooldown: c.cooldown,
      parentId: c.parentId,
      birthTick: c.birthTick,
      foodEaten: c.foodEaten,
      traits: { ...c.traits },
      genome: new Float32Array(c.genome),
      inputs: new Float32Array(c.lastInputs),
      hidden: new Float32Array(c.lastHidden),
      outputs: new Float32Array(c.lastOutputs),
    };
  }
  return null;
}
