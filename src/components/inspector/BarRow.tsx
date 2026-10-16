import { cn } from "@/lib/cn";
import { formatFixed } from "@/lib/format";

interface BarRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Draw the bar from the centre (for values that can be negative). */
  signed?: boolean;
  digits?: number;
  /** Tailwind background class for the fill. */
  fill?: string;
  title?: string;
}

/** A labelled horizontal bar used for sensors, outputs and trait ranges. */
export function BarRow({
  label,
  value,
  min,
  max,
  signed = false,
  digits = 2,
  fill = "bg-accent",
  title,
}: BarRowProps) {
  const span = max - min;
  const clamped = Math.min(Math.max(value, min), max);
  const fraction = span > 0 ? (clamped - min) / span : 0;

  return (
    <div className="flex items-center gap-2" title={title}>
      <span className="w-24 shrink-0 truncate text-[10px] text-ink-faint">{label}</span>
      <div className="relative h-2 flex-1 bg-surface-3">
        {signed ? (
          <>
            <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
            <span
              className={cn("absolute inset-y-0", fill)}
              style={{
                left: `${Math.min(fraction, 0.5) * 100}%`,
                width: `${Math.abs(fraction - 0.5) * 100}%`,
              }}
            />
          </>
        ) : (
          <span className={cn("absolute inset-y-0 left-0", fill)} style={{ width: `${fraction * 100}%` }} />
        )}
      </div>
      <span className="w-11 shrink-0 text-right tnum text-[10px] text-ink-dim">
        {formatFixed(value, digits)}
      </span>
    </div>
  );
}
