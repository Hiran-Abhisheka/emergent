import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import type { Obstacle } from "@/simulation/types";
import type { InspectedCreature } from "@/simulation/worker-messages";
import {
  SENSOR_FOOD_BEARING,
  SENSOR_FOOD_PROXIMITY,
  SENSOR_FOOD_VISIBLE,
  SENSOR_OBSTACLE_BEARING,
  SENSOR_OBSTACLE_PROXIMITY,
} from "@/simulation/constants";
import { screenToWorld } from "@/simulation/renderer/camera";
import {
  drawScene,
  type OverlayData,
  type ViewOptions,
  type WorldView,
} from "@/simulation/renderer/draw";
import type { CanvasCamera } from "@/hooks/useCanvasCamera";
import type { SnapshotData } from "@/hooks/useSimulation";

const CLICK_SLOP_PX = 4;
const PICK_RADIUS_PX = 14;

/** Keyboard pan step (screen pixels) and zoom factor for the canvas. */
const KEY_PAN_STEP_PX = 64;
const KEY_ZOOM_STEP = 1.2;

interface SimulationCanvasProps {
  snapshotRef: RefObject<SnapshotData | null>;
  obstacles: Obstacle[];
  worldWidth: number;
  worldHeight: number;
  creatureRadius: number;
  maxEnergy: number;
  camera: CanvasCamera;
  view: ViewOptions;
  inspection: InspectedCreature | null;
  onSelect: (id: number | null) => void;
}

function buildOverlay(inspection: InspectedCreature | null): OverlayData | null {
  if (inspection === null) return null;
  const inputs = inspection.inputs;
  return {
    x: inspection.x,
    y: inspection.y,
    heading: inspection.heading,
    visionRange: inspection.traits.visionRange,
    foodProximity: inputs[SENSOR_FOOD_PROXIMITY],
    foodBearing: inputs[SENSOR_FOOD_BEARING],
    foodVisible: inputs[SENSOR_FOOD_VISIBLE],
    obstacleProximity: inputs[SENSOR_OBSTACLE_PROXIMITY],
    obstacleBearing: inputs[SENSOR_OBSTACLE_BEARING],
  };
}

/**
 * Pointer position relative to the canvas. Uses client coordinates against the
 * canvas rect rather than `offsetX/offsetY`, which are unreliable for touch.
 */
function localPoint(event: {
  clientX: number;
  clientY: number;
  currentTarget: HTMLCanvasElement;
}): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/**
 * The simulation viewport. One mutable snapshot buffer is read each animation
 * frame; React state is only involved in pointer interactions, so running at
 * speed never triggers a re-render per tick.
 */
export function SimulationCanvas(props: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Mirrors of props read inside the rAF loop (avoids stale closures). Synced
  // after render rather than during it, which holds refs to render rules.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  const dragState = useRef({ dragging: false, moved: false, lastX: 0, lastY: 0 });
  const sizeRef = useRef({ width: 0, height: 0 });

  // Every pointer currently down on the canvas. One pointer pans; two pinch.
  // Without this the two pointers would share `dragState` and fight each other,
  // so an ordinary pinch would shake the view instead of zooming it.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef({ distance: 0, midX: 0, midY: 0 });

  // -- Animation loop -------------------------------------------------------
  useEffect(() => {
    let frame = 0;
    const render = (): void => {
      frame = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      if (canvas === null) return;
      const ctx = canvas.getContext("2d");
      if (ctx === null) return;

      const p = propsRef.current;
      const { width, height } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.max(1, Math.round(width * dpr))) {
        canvas.width = Math.max(1, Math.round(width * dpr));
        canvas.height = Math.max(1, Math.round(height * dpr));
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const worldView: WorldView = {
        width: p.worldWidth,
        height: p.worldHeight,
        obstacles: p.obstacles,
        creatureRadius: p.creatureRadius,
        maxEnergy: p.maxEnergy,
      };

      const scene = p.snapshotRef.current;
      if (scene === null) {
        ctx.fillStyle = "#0a0f18";
        ctx.fillRect(0, 0, width, height);
        return;
      }
      drawScene(
        ctx,
        scene,
        worldView,
        p.camera.camera,
        p.view,
        buildOverlay(p.inspection),
        width,
        height,
      );
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  // -- Size tracking --------------------------------------------------------
  useEffect(() => {
    const wrap = wrapRef.current;
    if (wrap === null) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      sizeRef.current = { width: rect.width, height: rect.height };
      props.camera.setViewport(rect.width, rect.height);
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [props.camera]);

  // -- Pointer: pick nearest creature within a small radius -----------------
  const pick = useCallback((sx: number, sy: number): number | null => {
    const p = propsRef.current;
    const scene = p.snapshotRef.current;
    if (scene === null) return null;
    const { width, height } = sizeRef.current;
    const world = screenToWorld(p.camera.camera, width, height, sx, sy);
    let bestId: number | null = null;
    let bestDist = PICK_RADIUS_PX;
    for (let i = 0; i < scene.count; i++) {
      const o = i * scene.stride;
      const dx = (scene.data[o] - world.x) * p.camera.camera.zoom;
      const dy = (scene.data[o + 1] - world.y) * p.camera.camera.zoom;
      const d = Math.hypot(dx, dy);
      if (d < bestDist) {
        bestDist = d;
        bestId = scene.ids[i];
      }
    }
    return bestId;
  }, []);

  const handlePointerDown = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = localPoint(event);
    const active = pointers.current;
    active.set(event.pointerId, { x, y });

    if (active.size >= 2) {
      // A second finger turns the gesture into a pinch: abandon the drag in
      // progress and mark it moved so the gesture cannot end in a selection.
      dragState.current.dragging = false;
      dragState.current.moved = true;
      const [a, b] = [...active.values()];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
      return;
    }

    dragState.current = { dragging: true, moved: false, lastX: x, lastY: y };
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const active = pointers.current;
    if (!active.has(event.pointerId)) return;
    const { x, y } = localPoint(event);
    active.set(event.pointerId, { x, y });

    if (active.size >= 2) {
      const [a, b] = [...active.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const previous = pinch.current;
      if (previous.distance > 0) {
        const { camera } = propsRef.current;
        // Moving the midpoint pans; spreading the fingers zooms about it.
        if (previous.midX !== midX || previous.midY !== midY) {
          camera.drag(midX - previous.midX, midY - previous.midY);
        }
        if (distance > 0) camera.zoomBy(distance / previous.distance, midX, midY);
      }
      pinch.current = { distance, midX, midY };
      return;
    }

    const state = dragState.current;
    if (!state.dragging) return;
    const dx = x - state.lastX;
    const dy = y - state.lastY;
    if (Math.abs(dx) + Math.abs(dy) > CLICK_SLOP_PX) state.moved = true;
    if (state.moved) {
      state.lastX = x;
      state.lastY = y;
      propsRef.current.camera.drag(dx, dy);
    }
  }, []);

  /**
   * Shared pointer-up/cancel path. `allowSelect` is false for `pointercancel`,
   * where the gesture was interrupted and a tap must not be inferred.
   */
  const endPointer = useCallback(
    (event: PointerEvent<HTMLCanvasElement>, allowSelect: boolean) => {
      const active = pointers.current;
      active.delete(event.pointerId);
      const state = dragState.current;

      if (active.size >= 2) return; // other fingers are still pinching

      if (active.size === 1) {
        // Pinch down to one finger: keep panning from the pointer still down,
        // and never read the tail of a pinch as a click.
        const [remaining] = [...active.values()];
        dragState.current = {
          dragging: true,
          moved: true,
          lastX: remaining.x,
          lastY: remaining.y,
        };
        pinch.current = { distance: 0, midX: 0, midY: 0 };
        return;
      }

      pinch.current = { distance: 0, midX: 0, midY: 0 };
      state.dragging = false;
      if (!allowSelect || state.moved) return;
      const { x, y } = localPoint(event);
      propsRef.current.onSelect(pick(x, y));
    },
    [pick],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => endPointer(event, true),
    [endPointer],
  );

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => endPointer(event, false),
    [endPointer],
  );

  const handleWheel = useCallback((event: WheelEvent<HTMLCanvasElement>) => {
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const { x, y } = localPoint(event);
    propsRef.current.camera.zoomBy(factor, x, y);
  }, []);

  // Keyboard equivalent of pan/zoom/select, so the viewport is usable without a
  // pointer. Arrow keys pan the view (scrolling convention), +/- zoom about the
  // centre, F fits, Escape clears the selection. Unhandled keys fall through to
  // the app-level shortcuts (Space, 1-4).
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLCanvasElement>) => {
    const { camera, onSelect } = propsRef.current;
    switch (event.key) {
      case "ArrowLeft":
        camera.drag(KEY_PAN_STEP_PX, 0);
        break;
      case "ArrowRight":
        camera.drag(-KEY_PAN_STEP_PX, 0);
        break;
      case "ArrowUp":
        camera.drag(0, KEY_PAN_STEP_PX);
        break;
      case "ArrowDown":
        camera.drag(0, -KEY_PAN_STEP_PX);
        break;
      case "+":
      case "=":
        camera.zoomCentre(KEY_ZOOM_STEP);
        break;
      case "-":
      case "_":
        camera.zoomCentre(1 / KEY_ZOOM_STEP);
        break;
      case "f":
      case "F":
        camera.fit();
        break;
      case "Escape":
        onSelect(null);
        break;
      default:
        return;
    }
    event.preventDefault();
  }, []);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-abyss">
      <canvas
        ref={canvasRef}
        role="application"
        aria-roledescription="simulation viewport"
        aria-label="Simulation world. Drag or pinch to pan and zoom, click a creature to inspect it. Arrow keys pan, plus and minus zoom, F fits the view, Escape clears the selection."
        tabIndex={0}
        className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
