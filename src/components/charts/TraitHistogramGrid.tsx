import { TRAIT_RANGES, type TraitName } from "@/simulation/constants";
import type { TraitHistogram } from "@/simulation/types";
import { Panel } from "@/components/ui/Panel";
import { formatFixed } from "@/lib/format";

const TRAIT_LABEL: Record<TraitName, string> = {
  maxSpeed: "Max speed",
  visionRange: "Vision range",
  metabolicMultiplier: "Metabolic ×",
  mutationRate: "Mutation rate",
};

interface TraitHistogramGridProps {
  histograms: TraitHistogram[];
  stdDev: Record<TraitName, number>;
}

function Histogram({ histogram, std }: { histogram: TraitHistogram; std: number }) {
  const max = Math.max(1, ...histogram.counts);
  const range = TRAIT_RANGES[histogram.trait];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] text-ink-dim">{TRAIT_LABEL[histogram.trait]}</span>
        <span className="tnum text-[9px] text-ink-faint">σ {formatFixed(std, 3)}</span>
      </div>
      <div className="flex h-16 items-end gap-px">
        {histogram.counts.map((count, index) => (
          <span
            key={index}
            className="flex-1 bg-accent/70"
            style={{ height: `${Math.max(1, (count / max) * 100)}%` }}
            title={`${count} creature${count === 1 ? "" : "s"}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-ink-faint">
        <span className="tnum">{formatFixed(range.min, range.min < 10 ? 2 : 0)}</span>
        <span className="tnum">{formatFixed(range.max, range.max < 10 ? 2 : 0)}</span>
      </div>
    </div>
  );
}

/** Current trait distribution of the living population (fixed bins). */
export function TraitHistogramGrid({ histograms, stdDev }: TraitHistogramGridProps) {
  return (
    <Panel title="Trait distribution (living population)">
      {histograms.length === 0 ? (
        <p className="text-[10px] text-ink-faint">No population to summarise.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
          {histograms.map((histogram) => (
            <Histogram
              key={histogram.trait}
              histogram={histogram}
              std={stdDev[histogram.trait] ?? 0}
            />
          ))}
        </div>
      )}
      <p className="pt-2 text-[9px] text-ink-faint">
        Bins span each trait&apos;s allowed range and never move between samples, so the shape is
        comparable over time.
      </p>
    </Panel>
  );
}
