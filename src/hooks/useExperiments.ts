import { useCallback, useEffect, useRef, useState } from "react";
import type { ExperimentRecord } from "@/simulation/experiments/record";

export interface UseExperimentsOptions {
  /** Seed list (used for the first render only; see `replaceAll`). */
  initial?: ExperimentRecord[];
  /** Called after every mutation, for persistence (Stage 6). */
  onChange?: (records: ExperimentRecord[]) => void;
}

export interface UseExperimentsResult {
  experiments: ExperimentRecord[];
  /** A unique, sortable id for a new record. */
  makeId: () => string;
  add: (record: ExperimentRecord) => void;
  /** Insert several records at once (import) in a single update. */
  addMany: (records: ExperimentRecord[]) => void;
  remove: (id: string) => void;
  rename: (id: string, name: string) => void;
  clear: () => void;
  /** Replace the whole list (loading a library from storage). */
  replaceAll: (records: ExperimentRecord[]) => void;
}

/**
 * Session-scoped experiment library. Kept deliberately dumb: an array and
 * four mutators, with an `onChange` hook so persistence can be layered on
 * later without the view knowing.
 */
export function useExperiments(options: UseExperimentsOptions = {}): UseExperimentsResult {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>(options.initial ?? []);
  const counter = useRef(0);
  const onChangeRef = useRef(options.onChange);
  useEffect(() => {
    onChangeRef.current = options.onChange;
  });

  const commit = useCallback((next: ExperimentRecord[]) => {
    setExperiments(next);
    onChangeRef.current?.(next);
  }, []);

  const makeId = useCallback(() => {
    counter.current += 1;
    return `exp-${Date.now().toString(36)}-${counter.current.toString(36)}`;
  }, []);

  const add = useCallback(
    (record: ExperimentRecord) => commit([record, ...experiments]),
    [commit, experiments],
  );

  const addMany = useCallback(
    (records: ExperimentRecord[]) =>
      records.length === 0 ? undefined : commit([...records, ...experiments]),
    [commit, experiments],
  );

  const remove = useCallback(
    (id: string) => commit(experiments.filter((record) => record.id !== id)),
    [commit, experiments],
  );

  const rename = useCallback(
    (id: string, name: string) =>
      commit(
        experiments.map((record) => (record.id === id ? { ...record, name } : record)),
      ),
    [commit, experiments],
  );

  const clear = useCallback(() => commit([]), [commit]);

  const replaceAll = useCallback((records: ExperimentRecord[]) => commit(records), [commit]);

  return { experiments, makeId, add, addMany, remove, rename, clear, replaceAll };
}
