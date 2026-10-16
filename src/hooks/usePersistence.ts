import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SimulationApi } from "@/hooks/useSimulation";
import {
  AUTOSAVE_ID,
  clearSaves,
  deleteSave,
  estimateUsage,
  isPersistenceSupported,
  listSaves,
  readAutosave,
  readSaveWorld,
  writeSave,
  type SaveMeta,
  type StorageUsage,
} from "@/storage/db";
import {
  deserializeWorld,
  serializedWorldFromJson,
  serializedWorldToJson,
} from "@/simulation/storage/state";

/** How often the running world is snapshotted to the autosave slot. */
export const AUTOSAVE_INTERVAL_MS = 30_000;

interface DbSnapshot {
  saves: SaveMeta[];
  autosave: SaveMeta | null;
  usage: StorageUsage | null;
}

/**
 * Reads everything the Saves view lists, in one parallel pass. Deliberately a
 * plain module function (no React state) so both the initial load and manual
 * refreshes share one implementation.
 */
async function readSnapshot(): Promise<DbSnapshot> {
  const [saves, autosave, usage] = await Promise.all([
    listSaves(),
    readAutosave(),
    estimateUsage(),
  ]);
  return { saves, autosave, usage };
}

/** Normalises an unknown thrown value into a message. */
function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export interface UsePersistenceResult {
  supported: boolean;
  /** True once the first read of the database has finished. */
  ready: boolean;
  error: string | null;
  saves: SaveMeta[];
  autosave: SaveMeta | null;
  busy: boolean;
  autosaveEnabled: boolean;
  usage: StorageUsage | null;
  setAutosaveEnabled: (enabled: boolean) => void;
  refresh: () => Promise<void>;
  save: (name: string) => Promise<void>;
  load: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  /** Current world as exportable JSON. Throws only if the worker is gone. */
  exportWorldJson: () => Promise<string>;
  /** Restores a world from JSON. Returns an error message, or null on success. */
  importWorldJson: (text: string) => string | null;
}

/**
 * Durable storage for save slots: manual saves plus a rolling autosave.
 *
 * A slot stores the `SerializedWorld` exactly as the worker emits it (so a
 * restore is exact) together with the client's statistics series, so loading
 * resumes the *laboratory*, not just the creatures. The heavy world blob lives
 * in its own object store, apart from the small listable header.
 */
export function usePersistence(sim: SimulationApi): UsePersistenceResult {
  const supported = isPersistenceSupported();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [autosave, setAutosave] = useState<SaveMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);

  // Latest sim, read by the stable autosave timer without re-arming it.
  const simRef = useRef(sim);
  const lastAutosaveTick = useRef(-1);
  const idCounter = useRef(0);

  useEffect(() => {
    simRef.current = sim;
  });

  const applySnapshot = useCallback((snapshot: DbSnapshot) => {
    setSaves(snapshot.saves);
    setAutosave(snapshot.autosave);
    setUsage(snapshot.usage);
  }, []);

  // Initial read. State is applied from promise callbacks (an external system
  // reporting in), never synchronously in the effect body.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void readSnapshot()
      .then((snapshot) => {
        if (!cancelled) applySnapshot(snapshot);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describe(cause));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supported, applySnapshot]);

  const refresh = useCallback(async (): Promise<void> => {
    if (!supported) return;
    try {
      applySnapshot(await readSnapshot());
    } catch (cause) {
      setError(describe(cause));
    }
  }, [applySnapshot, supported]);

  /** Runs a database action with shared busy/error bookkeeping. */
  const run = useCallback(
    async (action: () => Promise<void>): Promise<void> => {
      setBusy(true);
      setError(null);
      try {
        await action();
      } catch (cause) {
        setError(describe(cause));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const snapshot = useCallback(async (id: string, name: string): Promise<void> => {
    const current = simRef.current;
    const world = await current.saveState();
    const meta: SaveMeta = {
      id,
      name,
      createdAt: Date.now(),
      tick: world.tick,
      population: world.creatures.length,
      seed: world.config.seed,
      samples: current.statsHistory.length,
    };
    await writeSave(meta, world, current.statsHistory);
    lastAutosaveTick.current = world.tick;
  }, []);

  const makeId = useCallback(() => {
    idCounter.current += 1;
    return `save-${Date.now().toString(36)}-${idCounter.current.toString(36)}`;
  }, []);

  const save = useCallback(
    (name: string) =>
      run(async () => {
        await snapshot(makeId(), name.trim() === "" ? "Untitled run" : name.trim());
        await refresh();
      }),
    [makeId, refresh, run, snapshot],
  );

  const load = useCallback(
    (id: string) =>
      run(async () => {
        const record = await readSaveWorld(id);
        if (record === null) throw new Error("That save slot no longer exists.");
        const current = simRef.current;
        current.restoreState(record.world);
        current.replaceHistory(record.history);
      }),
    [run],
  );

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        await deleteSave(id);
        await refresh();
      }),
    [refresh, run],
  );

  const clearAll = useCallback(
    () =>
      run(async () => {
        await clearSaves();
        await refresh();
      }),
    [refresh, run],
  );

  const exportWorldJson = useCallback(async (): Promise<string> => {
    const world = await simRef.current.saveState();
    return serializedWorldToJson(world);
  }, []);

  const importWorldJson = useCallback((text: string): string | null => {
    try {
      const parsed = serializedWorldFromJson(text);
      // Validate with the engine's own reader so a mismatched save is rejected
      // here, with a readable message, rather than dying inside the worker.
      deserializeWorld(parsed);
      simRef.current.restoreState(parsed);
      return null;
    } catch (cause) {
      return describe(cause);
    }
  }, []);

  // Rolling autosave while running. Skips when the tick has not advanced.
  // The write is followed by a refresh so the panel reflects the new slot
  // immediately rather than only after the next manual save.
  useEffect(() => {
    if (!supported || !autosaveEnabled) return;
    const timer = window.setInterval(() => {
      const current = simRef.current;
      if (current.status !== "running") return;
      if (current.tick === lastAutosaveTick.current) return;
      void snapshot(AUTOSAVE_ID, "Autosave")
        .then(() => refresh())
        .catch((cause: unknown) => setError(describe(cause)));
    }, AUTOSAVE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [supported, autosaveEnabled, snapshot, refresh]);

  return useMemo(
    () => ({
      supported,
      ready: !supported || loaded,
      error,
      saves,
      autosave,
      busy,
      autosaveEnabled,
      usage,
      setAutosaveEnabled,
      refresh,
      save,
      load,
      remove,
      clearAll,
      exportWorldJson,
      importWorldJson,
    }),
    [
      supported,
      loaded,
      error,
      saves,
      autosave,
      busy,
      autosaveEnabled,
      usage,
      refresh,
      save,
      load,
      remove,
      clearAll,
      exportWorldJson,
      importWorldJson,
    ],
  );
}
