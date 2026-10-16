import * as LabelPrimitive from "@radix-ui/react-label";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/cn";

export function Label({ className, ...rest }: LabelPrimitive.LabelProps) {
  return (
    <LabelPrimitive.Root
      className={cn("text-[10px] uppercase tracking-widest text-ink-faint", className)}
      {...rest}
    />
  );
}

export function Separator({
  orientation = "horizontal",
  className,
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <SeparatorPrimitive.Root
      orientation={orientation}
      className={cn(
        "bg-line",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
