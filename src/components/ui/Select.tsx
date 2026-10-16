import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
}

/** A compact themed Select (Radix Select, restyled for the instrument look). */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  ...rest
}: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled ?? false}>
      <SelectPrimitive.Trigger
        className={cn(
          "flex h-7 w-full items-center justify-between gap-2 border border-line bg-surface-2 px-2 text-left text-[11px] text-ink",
          "hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-40",
          className,
        )}
        {...rest}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-3 w-3 text-ink-faint" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={3}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden border border-line-strong bg-surface-2 shadow-lg shadow-black/40"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled ?? false}
                className={cn(
                  "relative flex h-6 cursor-pointer select-none items-center gap-2 pl-6 pr-2 text-[11px] text-ink-dim outline-none",
                  "data-[highlighted]:bg-accent/15 data-[highlighted]:text-accent",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
                )}
              >
                <SelectPrimitive.ItemIndicator className="absolute left-1.5">
                  <Check className="h-3 w-3 text-accent" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
