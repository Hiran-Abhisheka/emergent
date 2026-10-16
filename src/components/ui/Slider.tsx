import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/cn";

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
}

/** A single-thumb instrument slider (Radix Slider, restyled). */
export function Slider({
  value,
  min,
  max,
  step = 1,
  onValueChange,
  onValueCommit,
  disabled,
  className,
  ...rest
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-4 w-full touch-none items-center select-none", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled ?? false}
      onValueChange={(values) => onValueChange(values[0])}
      onValueCommit={onValueCommit === undefined ? undefined : (values) => onValueCommit(values[0])}
      {...rest}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow bg-surface-3">
        <SliderPrimitive.Range className="absolute h-full bg-accent/60 data-[disabled]:bg-ink-faint" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className={cn(
          "block h-3 w-3 border border-accent bg-surface transition-colors",
          "hover:bg-accent/30 disabled:cursor-not-allowed",
        )}
      />
    </SliderPrimitive.Root>
  );
}
