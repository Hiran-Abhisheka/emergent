import { useCallback, useMemo, useRef, useState } from "react";
import {
  clampCamera,
  DEFAULT_ZOOM,
  fitCamera,
  panBy,
  zoomAt,
  type Camera,
} from "@/simulation/renderer/camera";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@/simulation/constants";

export interface CanvasCamera {
  camera: Camera;
  /** Zoom relative to the current fit-to-viewport zoom, as a percentage. */
  zoomPercent: number;
  /** Called by the canvas on resize (and once at first layout). */
  setViewport: (width: number, height: number) => void;
  zoomBy: (factor: number, sx: number, sy: number) => void;
  zoomCentre: (factor: number) => void;
  drag: (dx: number, dy: number) => void;
  fit: () => void;
}

/**
 * Camera state for the simulation canvas. Lives in React state so readouts and
 * the sidebar's zoom buttons stay in sync; the canvas paints from a prop
 * mirror each frame, so its draw loop never depends on a React commit.
 */
export function useCanvasCamera(): CanvasCamera {
  const [camera, setCamera] = useState<Camera>({
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    zoom: DEFAULT_ZOOM,
  });
  const [viewport, setViewportState] = useState({ width: 0, height: 0 });
  const fittedRef = useRef(false);

  const setViewport = useCallback((width: number, height: number) => {
    setViewportState((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
    if (!fittedRef.current && width > 0 && height > 0) {
      fittedRef.current = true;
      setCamera(fitCamera(width, height));
    }
  }, []);

  const fit = useCallback(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return;
    setCamera(fitCamera(viewport.width, viewport.height));
  }, [viewport.width, viewport.height]);

  const zoomBy = useCallback(
    (factor: number, sx: number, sy: number) => {
      if (viewport.width <= 0 || viewport.height <= 0) return;
      setCamera((current) =>
        clampCamera(zoomAt(current, viewport.width, viewport.height, sx, sy, factor)),
      );
    },
    [viewport.width, viewport.height],
  );

  const zoomCentre = useCallback(
    (factor: number) => zoomBy(factor, viewport.width / 2, viewport.height / 2),
    [zoomBy, viewport.width, viewport.height],
  );

  const drag = useCallback((dx: number, dy: number) => {
    setCamera((current) => clampCamera(panBy(current, dx, dy)));
  }, []);

  const zoomPercent = useMemo(() => {
    if (viewport.width <= 0 || viewport.height <= 0) return camera.zoom * 100;
    return (camera.zoom / fitCamera(viewport.width, viewport.height).zoom) * 100;
  }, [camera.zoom, viewport.width, viewport.height]);

  return useMemo(
    () => ({ camera, zoomPercent, setViewport, zoomBy, zoomCentre, drag, fit }),
    [camera, zoomPercent, setViewport, zoomBy, zoomCentre, drag, fit],
  );
}
