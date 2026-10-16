import { CONFIG_LIMITS } from "@/simulation/config";
import { Badge } from "@/components/ui/Badge";
import { NumberField } from "@/components/ui/NumberField";
import { Slider } from "@/components/ui/Slider";
import { SLIDER_KEYS, type ConfigFieldMeta } from "@/components/controls/config-fields";

interface ConfigFieldRowProps {
  meta: ConfigFieldMeta;
  value: number;
  error?: string;
  live: boolean;
  onChange: (value: number) => void;
}

/** One editable config field: label, live/reset badge, numeric input (+ slider). */
export function ConfigFieldRow({ meta, value, error, live, onChange }: ConfigFieldRowProps) {
  const limit = CONFIG_LIMITS[meta.key];
  const invalid = error !== undefined && error !== "";
  const showSlider = SLIDER_KEYS.has(meta.key);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] text-ink-dim" title={meta.hint}>
            {meta.label}
          </span>
          <Badge tone={live ? "live" : "reset"} title={live ? "Applies immediately" : "Applied on reset"}>
            {live ? "live" : "reset"}
          </Badge>
        </span>
        <NumberField
          value={value}
          onChange={onChange}
          min={limit.min}
          max={limit.max}
          step={meta.step}
          integer={meta.integer ?? false}
          unit={meta.unit}
          invalid={invalid}
          error={error}
          aria-label={meta.label}
        />
      </div>
      {showSlider && (
        <Slider
          value={Math.min(Math.max(value, limit.min), limit.max)}
          min={limit.min}
          max={limit.max}
          step={meta.step}
          onValueChange={onChange}
          aria-label={`${meta.label} slider`}
        />
      )}
      {!showSlider && <span className="text-[9px] leading-tight text-ink-faint">{meta.hint}</span>}
    </div>
  );
}
