import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-1.5 font-medium tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "border border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3",
        primary: "border border-accent-dim bg-accent/10 text-accent hover:bg-accent/20",
        danger: "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
        ghost: "border border-transparent text-ink-dim hover:bg-surface-2 hover:text-ink",
      },
      size: {
        sm: "h-6 px-2 text-[11px]",
        md: "h-8 px-3 text-xs",
        icon: "h-6 w-6 p-0 text-[11px]",
      },
      active: {
        true: "border-accent bg-accent/20 text-accent",
        false: "",
      },
    },
    defaultVariants: { variant: "default", size: "md", active: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    Omit<VariantProps<typeof buttonVariants>, "active"> {
  /** Renders the pressed/selected state (used for segmented-style buttons). */
  active?: boolean;
}

export function Button({
  variant,
  size,
  active = false,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size, active }), className)} {...rest} />
  );
}
