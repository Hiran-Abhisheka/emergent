import { useMemo } from "react";
import type { MetricsPayload, StatsSample } from "@/simulation/types";
import { Panel, Stat } from "@/components/ui/Panel";
import { CHART_COLORS } from "@/components/charts/chart-theme";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { TraitHistogramGrid } from "@/components/charts/TraitHistogramGrid";
import { LifetimeChart } from "@/components/charts/LifetimeChart";
import { downsample } from "@/lib/array";
import { formatFixed, formatInt } from "@/lib/format";

/** Charts plot at most this many points (the newest sample is always kept). */
const MAX_CHART_POINTS = 500;

interface StatisticsViewProps {
  statsHistory: StatsSample[];
  latestStats: MetricsPayload | null;
  tick: number;
}

interface ChartRow extends Record<string, number> {
  tick: number;
}

function toRows(history: StatsSample[]): ChartRow[] {
  return history.map((s) => ({
    tick: s.tick,
    population: s.population,
    births: s.births,
    deaths: s.deaths,
    foodRemaining: s.foodRemaining,
    meanEnergy: s.meanEnergy,
    meanSpeedTrait: s.meanSpeedTrait,
    meanVisionTrait: s.meanVisionTrait,
    meanGeneration: s.meanGeneration,
    maxGeneration: s.maxGeneration,
    genomeDispersion: s.genomeDispersion,
  }));
}

/** The Statistics tab: real time series, current trait histograms and lifetimes. */
export function StatisticsView({ statsHistory, latestStats, tick }: StatisticsViewProps) {
  const rows = useMemo(
    () => downsample(toRows(statsHistory), MAX_CHART_POINTS),
    [statsHistory],
  );
  const sample = latestStats?.sample;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Panel
        title="Summary"
        className="border-b border-line"
        actions={<span className="tnum text-[9px] text-ink-faint">{formatInt(rows.length)} samples</span>}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4 xl:grid-cols-6">
          <Stat label="Tick" value={formatInt(tick)} />
          <Stat label="Population" value={formatInt(sample?.population ?? 0)} tone="accent" />
          <Stat label="Max generation" value={formatInt(sample?.maxGeneration ?? 0)} tone="cyan" />
          <Stat label="Births" value={formatInt(sample?.births ?? 0)} tone="green" />
          <Stat label="Deaths" value={formatInt(sample?.deaths ?? 0)} tone="danger" />
          <Stat label="Food" value={formatInt(sample?.foodRemaining ?? 0)} />
          <Stat label="Mean energy" value={formatFixed(sample?.meanEnergy ?? 0, 1)} tone="amber" />
          <Stat label="Mean generation" value={formatFixed(sample?.meanGeneration ?? 0, 1)} />
          <Stat label="Mean speed trait" value={formatFixed(sample?.meanSpeedTrait ?? 0, 3)} />
          <Stat label="Mean vision trait" value={formatFixed(sample?.meanVisionTrait ?? 0, 1)} />
          <Stat
            label="Genome dispersion"
            value={formatFixed(sample?.genomeDispersion ?? 0, 3)}
            tone="cyan"
          />
          <Stat
            label="Samples"
            value={formatInt(statsHistory.length)}
            hint="every 30 ticks"
          />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-px bg-line xl:grid-cols-2">
        <TimeSeriesChart
          title="Population"
          data={rows}
          series={[{ key: "population", label: "population", color: CHART_COLORS.population, area: true }]}
          domain={[0, "auto"]}
        />
        <TimeSeriesChart
          title="Cumulative births and deaths"
          data={rows}
          series={[
            { key: "births", label: "births", color: CHART_COLORS.births },
            { key: "deaths", label: "deaths", color: CHART_COLORS.deaths },
          ]}
        />
        <TimeSeriesChart
          title="Mean energy"
          data={rows}
          series={[{ key: "meanEnergy", label: "mean energy", color: CHART_COLORS.energy }]}
        />
        <TimeSeriesChart
          title="Generation"
          data={rows}
          series={[
            { key: "meanGeneration", label: "mean", color: CHART_COLORS.generation },
            { key: "maxGeneration", label: "max", color: CHART_COLORS.maxGeneration },
          ]}
        />
        <TimeSeriesChart
          title="Mean traits"
          data={rows}
          series={[
            { key: "meanSpeedTrait", label: "speed", color: CHART_COLORS.speed },
            { key: "meanVisionTrait", label: "vision", color: CHART_COLORS.vision },
          ]}
          digits={3}
        />
        <TimeSeriesChart
          title="Genome dispersion (sampled)"
          data={rows}
          series={[
            { key: "genomeDispersion", label: "dispersion", color: CHART_COLORS.dispersion, area: true },
          ]}
          domain={[0, "auto"]}
          digits={3}
          hint="Mean pairwise genome distance ÷ √paramCount, sampled."
        />
      </div>

      <TraitHistogramGrid
        histograms={latestStats?.histograms ?? []}
        stdDev={latestStats?.traitStandardDeviation ?? {
          maxSpeed: 0,
          visionRange: 0,
          metabolicMultiplier: 0,
          mutationRate: 0,
        }}
      />

      <LifetimeChart buckets={latestStats?.lifetimeByGeneration ?? []} />
    </div>
  );
}
