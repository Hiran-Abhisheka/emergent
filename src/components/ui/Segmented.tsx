import { cn } from "@/lib/cn";

export interface SegmentedOption<T> {
  value: T;
  label: string;
  title?: string;
  disabled?: boolean;
}

interface SegmentedProps<T> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * A joined row of mutually exclusive buttons (segmented control). Used for
 * colour mode, chart metric and other small enums where a dropdown is overkill.
 */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: SegmentedProps<T>) {
  const height = size === "sm" ? "h-6" : "h-7";
  return (
    <div className={cn("flex", className)} role="group">
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            title={option.title ?? option.label}
            disabled={option.disabled ?? false}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              height,
              "flex-1 border border-line px-2 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              index > 0 && "-ml-px",
              selected
                ? "relative z-10 border-accent bg-accent/15 text-accent"
                : "bg-surface-2 text-ink-dim hover:bg-surface-3 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
