import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
import { ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A collapsible group header (chevron rotates) used for config sections. */
export function CollapsibleSection({
  title,
  defaultOpen = true,
  actions,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen} className={className}>
      <div className="flex items-center gap-1 px-3 pt-3">
        <CollapsiblePrimitive.Trigger className="group flex flex-1 items-center gap-1 text-left">
          <ChevronRight
            className={cn("h-3 w-3 text-ink-faint transition-transform", open && "rotate-90")}
          />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint group-hover:text-ink-dim">
            {title}
          </span>
        </CollapsiblePrimitive.Trigger>
        {actions !== undefined && <div className="flex items-center gap-1.5">{actions}</div>}
      </div>
      <CollapsiblePrimitive.Content className="overflow-hidden">
        <div className="space-y-1.5 px-3 pb-3 pt-2">{children}</div>
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  );
}
