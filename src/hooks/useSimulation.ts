import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { configKeyAppliesLive, DEFAULT_CONFIG, type SimConfig } from "@/simulation/config";
import { METRICS_HISTORY_CAPACITY, WORLD_HEIGHT, WORLD_WIDTH } from "@/simulation/constants";
import type { MetricsPayload, Obstacle, StatsSample } from "@/simulation/types";
import type { SerializedWorld } from "@/simulation/storage/state";
import type { ColorMode, InspectedCreature, WorkerCommand } from "@/simulation/worker-messages";
import {
  createSimulationClient,
  type SimStatus,
  type SimulationClient,
  type SnapshotData,
} from "@/hooks/simulation-client";

export type { SimStatus, SnapshotData } from "@/hooks/simulation-client";

export interface UseSimulationResult {
  status: SimStatus;
  tick: number;
  speed: number;
  population: number;
  colorMode: ColorMode;
  config: SimConfig;
  obstacles: Obstacle[];
  worldWidth: number;
  worldHeight: number;
  latestStats: MetricsPayload | null;
  statsHistory: StatsSample[];
  inspection: InspectedCreature | null;
  error: string | null;
  /** Read every animation frame; do not copy it into React state. */
  snapshotRef: RefObject<SnapshotData | null>;
  start: () => void;
  pause: () => void;
  toggleRun: () => void;
  reset: (config: SimConfig) => void;
  setSpeed: (multiplier: number) => void;
  setEnvironment: (patch: Partial<SimConfig>) => void;
  setColorMode: (mode: ColorMode) => void;
  inspect: (id: number | null) => void;
  saveState: () => Promise<SerializedWorld>;
  restoreState: (state: SerializedWorld) => void;
  /** Installs a saved statistics series (loading a snapshot). */
  replaceHistory: (samples: readonly StatsSample[]) => void;
  isLive: (key: keyof SimConfig) => boolean;
}

/**
 * Owns the worker for the whole app: lifecycle, event routing and the command
 * surface. Snapshots never touch React state (that would re-render at ~30 Hz);
 * they are published through a ref that the canvas reads each frame.
 */
export function useSimulation(initialConfig: SimConfig = DEFAULT_CONFIG): UseSimulationResult {
  const clientRef = useRef<SimulationClient | null>(null);
  const snapshotRef = useRef<SnapshotData | null>(null);
  const savedResolverRef = useRef<((state: SerializedWorld) => void) | null>(null);
  const initialConfigRef = useRef(initialConfig);

  const [status, setStatus] = useState<SimStatus>("booting");
  const [tick, setTick] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [population, setPopulation] = useState(0);
  const [colorMode, setColorModeState] = useState<ColorMode>("energy");
  const [config, setConfig] = useState<SimConfig>(initialConfig);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [worldSize, setWorldSize] = useState({ w: WORLD_WIDTH, h: WORLD_HEIGHT });
  const [latestStats, setLatestStats] = useState<MetricsPayload | null>(null);
  const [statsHistory, setStatsHistory] = useState<StatsSample[]>([]);
  const [inspection, setInspection] = useState<InspectedCreature | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = createSimulationClient({
      onWorld: (event) => {
        setObstacles(event.obstacles);
        setWorldSize({ w: event.width, h: event.height });
        setConfig(event.config);
      },
      onStatus: (event) => {
        setStatus(event.running ? "running" : "paused");
        setTick(event.tick);
        setSpeedState(event.speed);
        setPopulation(event.population);
        setColorModeState(event.colorMode);
        setConfig(event.config);
      },
      onSnapshot: (event) => {
        const previous = snapshotRef.current;
        snapshotRef.current = {
          tick: event.tick,
          count: event.count,
          foodCount: event.foodCount,
          stride: event.stride,
          colorMode: event.colorMode,
          maxGeneration: event.maxGeneration,
          data: event.data,
          ids: event.ids,
        };
        setTick(event.tick);
        // Hand the previous buffers back to the worker's pool.
        if (previous !== null) {
          client.post({ type: "SNAPSHOT_ACK", data: previous.data, ids: previous.ids }, [
            previous.data.buffer,
            previous.ids.buffer,
          ]);
        }
      },
      onStats: (event) => {
        setLatestStats(event.payload);
        setStatsHistory((history) => {
          const next =
            history.length >= METRICS_HISTORY_CAPACITY
              ? history.slice(history.length - METRICS_HISTORY_CAPACITY + 1)
              : history.slice();
          next.push(event.payload.sample);
          return next;
        });
      },
      onInspection: (event) => setInspection(event.creature),
      onSavedState: (event) => {
        const resolve = savedResolverRef.current;
        savedResolverRef.current = null;
        if (resolve !== null) resolve(event.data);
      },
      onError: (event) => {
        setError(event.message);
        setStatus("error");
      },
    });

    clientRef.current = client;
    client.post({ type: "INIT", config: initialConfigRef.current });

    return () => {
      client.terminate();
      clientRef.current = null;
      snapshotRef.current = null;
    };
  }, []);

  const send = useCallback(
    (command: WorkerCommand, transfer?: Transferable[]) =>
      clientRef.current?.post(command, transfer),
    [],
  );

  const clearHistory = useCallback(() => {
    setStatsHistory([]);
    setLatestStats(null);
    setInspection(null);
    snapshotRef.current = null;
  }, []);

  /**
   * Installs a saved statistics series (loading a snapshot). `latestStats` is
   * cleared rather than faked: its histograms cannot be reconstructed from a
   * `StatsSample`, so the next stats event repopulates it honestly.
   */
  const replaceHistory = useCallback((samples: readonly StatsSample[]) => {
    setStatsHistory(samples.slice(-METRICS_HISTORY_CAPACITY));
    setLatestStats(null);
  }, []);

  const start = useCallback(() => {
    setError(null);
    send({ type: "START" });
  }, [send]);

  const pause = useCallback(() => send({ type: "PAUSE" }), [send]);

  const toggleRun = useCallback(() => {
    setError(null);
    send({ type: status === "running" ? "PAUSE" : "START" });
  }, [send, status]);

  const reset = useCallback(
    (next: SimConfig) => {
      setError(null);
      clearHistory();
      send({ type: "RESET", config: next });
    },
    [clearHistory, send],
  );

  const setSpeed = useCallback(
    (multiplier: number) => send({ type: "SET_SPEED", multiplier }),
    [send],
  );

  const setEnvironment = useCallback(
    (patch: Partial<SimConfig>) => send({ type: "SET_ENVIRONMENT", patch }),
    [send],
  );

  const setColorMode = useCallback(
    (mode: ColorMode) => send({ type: "SET_COLOR_MODE", mode }),
    [send],
  );

  const inspect = useCallback(
    (id: number | null) => send({ type: "INSPECT_CREATURE", id }),
    [send],
  );

  const saveState = useCallback(
    (): Promise<SerializedWorld> =>
      new Promise<SerializedWorld>((resolve) => {
        savedResolverRef.current = resolve;
        send({ type: "SAVE_STATE" });
      }),
    [send],
  );

  const restoreState = useCallback(
    (state: SerializedWorld) => {
      setError(null);
      clearHistory();
      send({ type: "RESTORE_STATE", data: state });
    },
    [clearHistory, send],
  );

  const isLive = useCallback((key: keyof SimConfig) => configKeyAppliesLive(key), []);

  return useMemo(
    () => ({
      status,
      tick,
      speed,
      population,
      colorMode,
      config,
      obstacles,
      worldWidth: worldSize.w,
      worldHeight: worldSize.h,
      latestStats,
      statsHistory,
      inspection,
      error,
      snapshotRef,
      start,
      pause,
      toggleRun,
      reset,
      setSpeed,
      setEnvironment,
      setColorMode,
      inspect,
      saveState,
      restoreState,
      isLive,
      replaceHistory,
    }),
    [
      status,
      tick,
      speed,
      population,
      colorMode,
      config,
      obstacles,
      worldSize,
      latestStats,
      statsHistory,
      inspection,
      error,
      start,
      pause,
      toggleRun,
      reset,
      setSpeed,
      setEnvironment,
      setColorMode,
      inspect,
      saveState,
      restoreState,
      isLive,
      replaceHistory,
    ],
  );
}

/** The full surface returned by `useSimulation` (worker-backed world state). */
export type SimulationApi = ReturnType<typeof useSimulation>;
