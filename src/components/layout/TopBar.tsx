import { ENGINE_VERSION } from "@/simulation/constants";
import type { SimStatus } from "@/hooks/useSimulation";
import { cn } from "@/lib/cn";

interface TopBarProps {
  status: SimStatus;
  tick: number;
  population: number;
  foodRemaining: number;
  maxGeneration: number;
  speed: number;
}

const STATUS_LABEL: Record<SimStatus, string> = {
  booting: "BOOTING",
  running: "LIVE",
  paused: "PAUSED",
  error: "ERROR",
};

const STATUS_CLASS: Record<SimStatus, string> = {
  booting: "text-ink-faint border-line",
  running: "text-green border-green/40",
  paused: "text-amber border-amber/40",
  error: "text-danger border-danger/40",
};

function Readout({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  /** Display + breakpoint classes; the caller decides when the readout appears. */
  className?: string;
}) {
  return (
    <div className={cn("flex-col leading-none", className)}>
      <span className="text-[9px] uppercase tracking-widest text-ink-faint">{label}</span>
      <span className="tnum text-sm text-ink">{value}</span>
    </div>
  );
}

export function TopBar({ status, tick, population, foodRemaining, maxGeneration, speed }: TopBarProps) {
  return (
    <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2 sm:gap-4 sm:px-4 lg:gap-5">
      <h1 className="flex items-center gap-2 text-sm font-semibold tracking-[0.2em] text-accent">
        EMERGENT
        <span className="hidden text-[11px] font-normal tracking-normal text-ink-faint sm:inline">
          Artificial Life Laboratory
        </span>
      </h1>

      <span
        className={cn(
          "border px-2 py-0.5 text-[10px] font-semibold tracking-widest",
          STATUS_CLASS[status],
        )}
      >
        {STATUS_LABEL[status]}
      </span>

      {/*
       * Readouts drop out as the viewport narrows so the bar never overflows:
       * the live tick and population are always shown, the rest reappear once
       * there is room for them.
       */}
      <div className="ml-auto flex items-center gap-4 md:gap-6">
        <Readout className="flex" label="Tick" value={tick.toLocaleString("en-US")} />
        <Readout className="flex" label="Population" value={population.toLocaleString("en-US")} />
        <Readout
          className="hidden sm:flex"
          label="Food"
          value={foodRemaining.toLocaleString("en-US")}
        />
        <Readout className="hidden md:flex" label="Max gen" value={String(maxGeneration)} />
        <Readout className="hidden lg:flex" label="Speed" value={`${speed}×`} />
        <Readout className="hidden xl:flex" label="Engine" value={`v${ENGINE_VERSION}`} />
      </div>
    </header>
  );
}
