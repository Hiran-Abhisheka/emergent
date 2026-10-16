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

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col leading-none">
      <span className="text-[9px] uppercase tracking-widest text-ink-faint">{label}</span>
      <span className="tnum text-sm text-ink">{value}</span>
    </div>
  );
}

export function TopBar({ status, tick, population, foodRemaining, maxGeneration, speed }: TopBarProps) {
  return (
    <header className="flex items-center gap-5 border-b border-line bg-surface px-4 py-2">
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

      <div className="ml-auto flex items-center gap-6">
        <Readout label="Tick" value={tick.toLocaleString("en-US")} />
        <Readout label="Population" value={population.toLocaleString("en-US")} />
        <Readout label="Food" value={foodRemaining.toLocaleString("en-US")} />
        <Readout label="Max gen" value={String(maxGeneration)} />
        <Readout label="Speed" value={`${speed}×`} />
        <Readout label="Engine" value={`v${ENGINE_VERSION}`} />
      </div>
    </header>
  );
}
