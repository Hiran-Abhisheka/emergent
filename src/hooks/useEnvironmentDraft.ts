import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LIVE_CONFIG_KEYS,
  validateConfig,
  withConfigValue,
  type NumericConfigKey,
  type SimConfig,
} from "@/simulation/config";
import type { Preset } from "@/simulation/presets";
import { pendingResetKeys } from "@/components/controls/config-fields";
import type { UseSimulationResult } from "@/hooks/useSimulation";

/** Live edits are coalesced so a slider drag does not flood the worker. */
const LIVE_DEBOUNCE_MS = 120;

export interface EnvironmentDraft {
  /** The editable copy (may differ from the applied config). */
  draft: SimConfig;
  /** Per-field validation messages for the draft. */
  errors: Partial<Record<keyof SimConfig, string>>;
  isValid: boolean;
  /** Reset-only fields that differ from the running world. */
  pendingReset: NumericConfigKey[];
  hasPendingReset: boolean;
  setValue: (key: NumericConfigKey, value: number) => void;
  setSeed: (value: number) => void;
  applyPreset: (preset: Preset) => void;
  applyReset: () => void;
  revert: () => void;
}

type SimApi = Pick<UseSimulationResult, "config" | "setEnvironment" | "reset" | "isLive">;

/**
 * Edits the configuration without fighting the worker. Live fields are pushed
 * to the running world (debounced); reset-only fields stay in a local draft
 * until "Apply & reset". Incoming config from the worker refreshes only live
 * fields, so a pending reset edit is never silently overwritten.
 */
export function useEnvironmentDraft(sim: SimApi): EnvironmentDraft {
  const [draft, setDraft] = useState<SimConfig>(sim.config);
  const draftRef = useRef(draft);
  const pendingLive = useRef<Partial<SimConfig>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apiRef = useRef({ setEnvironment: sim.setEnvironment, reset: sim.reset, isLive: sim.isLive });
  useEffect(() => {
    apiRef.current = { setEnvironment: sim.setEnvironment, reset: sim.reset, isLive: sim.isLive };
  });

  const commitDraft = useCallback((next: SimConfig) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  // Adopt the worker's live values (authoritative) but never its reset values,
  // which might be stale relative to a pending edit.
  useEffect(() => {
    const applied = sim.config;
    setDraft((current) => {
      let next = current;
      for (const key of LIVE_CONFIG_KEYS) {
        const numeric = key as NumericConfigKey;
        if (current[numeric] !== applied[numeric]) {
          if (next === current) next = { ...current };
          next[numeric] = applied[numeric];
        }
      }
      if (next === current) return current;
      draftRef.current = next;
      return next;
    });
  }, [sim.config]);

  const flushLive = useCallback(() => {
    timer.current = null;
    const patch = pendingLive.current;
    pendingLive.current = {};
    if (Object.keys(patch).length > 0) apiRef.current.setEnvironment(patch);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const scheduleFlush = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(flushLive, LIVE_DEBOUNCE_MS);
  }, [flushLive]);

  const setValue = useCallback(
    (key: NumericConfigKey, value: number) => {
      const next = withConfigValue(draftRef.current, key, value);
      commitDraft(next);
      if (apiRef.current.isLive(key) && validateConfig(next).errors[key] === undefined) {
        pendingLive.current[key] = value;
        scheduleFlush();
      }
    },
    [commitDraft, scheduleFlush],
  );

  const setSeed = useCallback(
    (value: number) => {
      commitDraft({ ...draftRef.current, seed: Math.max(0, Math.trunc(value)) });
    },
    [commitDraft],
  );

  const applyPreset = useCallback(
    (preset: Preset) => {
      const next = { ...draftRef.current, ...preset.patch };
      commitDraft(next);
      const livePatch: Partial<SimConfig> = {};
      for (const [key, value] of Object.entries(preset.patch)) {
        if (value !== undefined && apiRef.current.isLive(key as keyof SimConfig)) {
          (livePatch as Record<string, number>)[key] = value;
        }
      }
      if (Object.keys(livePatch).length > 0) apiRef.current.setEnvironment(livePatch);
    },
    [commitDraft],
  );

  const applyReset = useCallback(() => {
    const next = draftRef.current;
    if (!validateConfig(next).valid) return;
    pendingLive.current = {};
    if (timer.current !== null) clearTimeout(timer.current);
    apiRef.current.reset(next);
  }, []);

  const revert = useCallback(() => {
    pendingLive.current = {};
    if (timer.current !== null) clearTimeout(timer.current);
    commitDraft(sim.config);
  }, [commitDraft, sim.config]);

  const errors = useMemo(() => validateConfig(draft).errors, [draft]);
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);
  const pendingReset = useMemo(
    () => pendingResetKeys(draft, sim.config, sim.isLive),
    [draft, sim.config, sim.isLive],
  );

  return {
    draft,
    errors,
    isValid,
    pendingReset,
    hasPendingReset: pendingReset.length > 0,
    setValue,
    setSeed,
    applyPreset,
    applyReset,
    revert,
  };
}
