import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  title?: string;
  className?: string;
}

/** A compact instrument switch (Radix Switch, restyled). */
export function Switch({ className, ...rest }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative h-3.5 w-7 shrink-0 border transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent/25",
        "data-[state=unchecked]:border-line-strong data-[state=unchecked]:bg-surface-3",
        className,
      )}
      {...rest}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block h-2 w-2.5 transition-transform",
          "data-[state=checked]:translate-x-3.5 data-[state=checked]:bg-accent",
          "data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-ink-faint",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

interface SwitchRowProps extends SwitchProps {
  label: string;
  hint?: string;
}

/** A full-width labelled switch row. */
export function SwitchRow({ label, hint, className, ...rest }: SwitchRowProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5 text-[11px] transition-colors hover:bg-surface-2",
        rest.disabled === true && "cursor-not-allowed opacity-40",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className={rest.checked ? "text-ink" : "text-ink-faint"}>{label}</span>
        {hint !== undefined && <span className="truncate text-[9px] text-ink-faint">{hint}</span>}
      </span>
      <Switch {...rest} />
    </label>
  );
}
