import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Wraps the app once so every tooltip shares one provider/delay. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={150}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * A single child wrapped in a tooltip. The child must accept a ref (a DOM
 * element or a Radix trigger); Radix composes the trigger with `asChild`.
 */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={5}
          className="z-50 max-w-64 border border-line-strong bg-surface-3 px-2 py-1 text-[10px] leading-snug text-ink shadow-lg shadow-black/40"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-line-strong" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
