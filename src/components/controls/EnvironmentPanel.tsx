import { useState } from "react";
import type { NumericConfigKey, SimConfig } from "@/simulation/config";
import { PRESETS, findPreset } from "@/simulation/presets";
import type { Preset } from "@/simulation/presets";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberField } from "@/components/ui/NumberField";
import { Select } from "@/components/ui/Select";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ConfigFieldRow } from "@/components/controls/ConfigFieldRow";
import { CONFIG_GROUPS } from "@/components/controls/config-fields";

const CUSTOM = "custom";

interface EnvironmentPanelProps {
  draft: SimConfig;
  errors: Partial<Record<keyof SimConfig, string>>;
  isValid: boolean;
  pendingReset: NumericConfigKey[];
  isLive: (key: keyof SimConfig) => boolean;
  onValue: (key: NumericConfigKey, value: number) => void;
  onSeed: (value: number) => void;
  onPreset: (preset: Preset) => void;
  onApplyReset: () => void;
  onRevert: () => void;
}

export type { EnvironmentPanelProps };

/**
 * The full environment editor. Every numeric field of `SimConfig` appears here,
 * each labelled "live" (applied immediately) or "reset" (applied when the world
 * is rebuilt). Invalid drafts show inline errors and cannot be applied.
 */
export function EnvironmentPanel({
  draft,
  errors,
  isValid,
  pendingReset,
  isLive,
  onValue,
  onSeed,
  onPreset,
  onApplyReset,
  onRevert,
}: EnvironmentPanelProps) {
  const [presetId, setPresetId] = useState<string>(CUSTOM);

  const handlePreset = (id: string): void => {
    const preset = findPreset(id);
    if (preset === undefined) return;
    setPresetId(id);
    onPreset(preset);
  };

  const handleValue = (key: NumericConfigKey, value: number): void => {
    setPresetId(CUSTOM);
    onValue(key, value);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 px-3 pt-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-ink-faint">Preset</span>
          <Select
            value={presetId}
            onValueChange={handlePreset}
            aria-label="Environment preset"
            options={[
              ...PRESETS.map((preset) => ({ value: preset.id, label: preset.name })),
              { value: CUSTOM, label: "Custom", disabled: true },
            ]}
          />
        </label>
        <p className="text-[10px] leading-relaxed text-ink-faint">
          {presetId === CUSTOM
            ? "Customised environment."
            : (findPreset(presetId)?.description ?? "")}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-ink-faint">
          <span className="flex items-center gap-1">
            <Badge tone="live">live</Badge> applies immediately
          </span>
          <span className="flex items-center gap-1">
            <Badge tone="reset">reset</Badge> applied on reset
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {CONFIG_GROUPS.map((group) => (
          <CollapsibleSection key={group.id} title={group.title}>
            {group.id === "run" && (
              <div className="flex items-center justify-between gap-2 pb-1">
                <span className="flex items-center gap-1.5">
                  <span className="text-[11px] text-ink-dim">Seed</span>
                  <Badge tone="reset">reset</Badge>
                </span>
                <NumberField
                  value={draft.seed}
                  onChange={onSeed}
                  min={0}
                  max={4294967295}
                  step={1}
                  integer
                  invalid={errors.seed !== undefined}
                  error={errors.seed}
                  aria-label="Seed"
                />
              </div>
            )}
            {group.fields.map((meta) => (
              <ConfigFieldRow
                key={meta.key}
                meta={meta}
                value={draft[meta.key]}
                error={errors[meta.key]}
                live={isLive(meta.key)}
                onChange={(value) => handleValue(meta.key, value)}
              />
            ))}
          </CollapsibleSection>
        ))}
      </div>

      <div className="sticky bottom-0 border-t border-line bg-surface px-3 py-2">
        {pendingReset.length > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] leading-tight text-amber">
              {pendingReset.length} change{pendingReset.length === 1 ? "" : "s"} need a reset
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={onRevert}>
                Revert
              </Button>
              <Button size="sm" variant="primary" disabled={!isValid} onClick={onApplyReset}>
                Apply &amp; reset
              </Button>
            </div>
          </div>
        ) : (
          <span className="text-[10px] text-ink-faint">
            {isValid ? "All changes applied." : "Fix the highlighted fields."}
          </span>
        )}
      </div>
    </div>
  );
}
