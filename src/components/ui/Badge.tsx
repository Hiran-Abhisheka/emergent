import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 border px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest leading-4",
  {
    variants: {
      tone: {
        neutral: "border-line-strong bg-surface-3 text-ink-dim",
        live: "border-green/40 bg-green/10 text-green",
        reset: "border-amber/40 bg-amber/10 text-amber",
        accent: "border-accent-dim bg-accent/10 text-accent",
        danger: "border-danger/40 bg-danger/10 text-danger",
        cyan: "border-cyan/40 bg-cyan/10 text-cyan",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ tone, className, ...rest }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...rest} />;
}
