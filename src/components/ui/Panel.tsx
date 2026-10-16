import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface PanelProps {
  title?: string;
  /** Right-aligned element in the header row. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove the horizontal padding (for full-bleed content such as charts). */
  flush?: boolean;
}

/** A titled instrument section with a hairline border and uppercase header. */
export function Panel({ title, actions, children, className, flush = false }: PanelProps) {
  return (
    <section className={cn("border-b border-line", className)}>
      {(title !== undefined || actions !== undefined) && (
        <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
          {title !== undefined && (
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              {title}
            </h3>
          )}
          {actions !== undefined && <div className="flex items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn(flush ? "" : "px-3 pb-3")}>{children}</div>
    </section>
  );
}

/** A labelled readout: small caption above a tabular value. */
export function Stat({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "green" | "amber" | "danger" | "cyan";
  className?: string;
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent"
      : tone === "green"
        ? "text-green"
        : tone === "amber"
          ? "text-amber"
          : tone === "danger"
            ? "text-danger"
            : tone === "cyan"
              ? "text-cyan"
              : "text-ink";
  return (
    <div className={cn("flex flex-col leading-tight", className)}>
      <span className="text-[9px] uppercase tracking-widest text-ink-faint">{label}</span>
      <span className={cn("tnum text-[13px]", toneClass)}>{value}</span>
      {hint !== undefined && <span className="text-[9px] text-ink-faint">{hint}</span>}
    </div>
  );
}

/** A form row: label on the left, control on the right. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <label htmlFor={htmlFor} className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] text-ink-dim">{label}</span>
        {hint !== undefined && <span className="truncate text-[9px] text-ink-faint">{hint}</span>}
      </label>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}
