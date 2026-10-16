import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { cn } from "@/lib/cn";

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  /** Called when the field loses focus (after the value has been committed). */
  onCommit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Inline validation message shown beneath the input. */
  error?: string;
  /** Short unit shown after the input (e.g. "ticks"). */
  unit?: string;
  width?: string;
  id?: string;
  "aria-label"?: string;
}

function toText(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

/**
 * A numeric text input that keeps its own editing string so intermediate
 * values ("0.", "-") never get clobbered, commits every parseable keystroke,
 * and restores the canonical value on blur. Validation is shown inline.
 */
export function NumberField({
  value,
  onChange,
  onCommit,
  min,
  max,
  step,
  integer = false,
  disabled = false,
  invalid = false,
  error,
  unit,
  width = "w-20",
  id,
  "aria-label": ariaLabel,
}: NumberFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [text, setText] = useState(() => toText(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(toText(value));
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const raw = event.target.value;
    setText(raw);
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    let next = integer ? Math.round(parsed) : parsed;
    if (min !== undefined && next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChange(next);
  };

  const handleBlur = (): void => {
    focused.current = false;
    setText(toText(value));
    onCommit?.();
  };

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-1">
        <input
          id={inputId}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          autoComplete="off"
          spellCheck={false}
          value={text}
          step={step}
          disabled={disabled}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setText(toText(value));
              event.currentTarget.blur();
            }
          }}
          className={cn(
            width,
            "h-6 border bg-surface-2 px-1.5 text-right text-[11px] tnum text-ink outline-none",
            "hover:border-line-strong focus:border-accent",
            invalid ? "border-danger/60" : "border-line",
            "disabled:cursor-not-allowed disabled:opacity-40",
          )}
        />
        {unit !== undefined && <span className="w-8 text-[9px] text-ink-faint">{unit}</span>}
      </div>
      {error !== undefined && error !== "" && (
        <span className="mt-0.5 max-w-40 text-right text-[9px] leading-tight text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
