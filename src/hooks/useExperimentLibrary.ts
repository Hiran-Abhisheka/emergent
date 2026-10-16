import { useEffect, useRef, useState } from "react";
import { useExperiments, type UseExperimentsResult } from "@/hooks/useExperiments";
import { parseExperimentRecord, type ExperimentRecord } from "@/simulation/experiments/record";
import {
  isPersistenceSupported,
  listStoredExperiments,
  replaceStoredExperiments,
} from "@/storage/db";

export interface ExperimentLibrary extends UseExperimentsResult {
  /** True once the stored library has been read (or found unsupported). */
  ready: boolean;
  error: string | null;
}

/**
 * The experiment library, backed by IndexedDB.
 *
 * The list is read once on mount; every subsequent mutation is written back in
 * a single transaction. Records read from storage are re-validated with
 * `parseExperimentRecord`, so a corrupt or outdated entry is dropped rather
 * than breaking the library. When persistence is unavailable the library still
 * works, session-scoped only.
 */
export function useExperimentLibrary(): ExperimentLibrary {
  const supported = isPersistenceSupported();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guards against echoing the just-loaded list straight back to storage.
  const writable = useRef(false);

  const library = useExperiments({
    onChange: (records) => {
      if (!writable.current || !isPersistenceSupported()) return;
      void replaceStoredExperiments(records).catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      });
    },
  });

  const { replaceAll } = library;

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void listStoredExperiments()
      .then((raw) => {
        if (cancelled) return;
        const valid = raw
          .map(parseExperimentRecord)
          .filter((record): record is ExperimentRecord => record !== null);
        replaceAll(valid);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (cancelled) return;
        writable.current = true;
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supported, replaceAll]);

  return { ...library, ready: !supported || loaded, error };
}
