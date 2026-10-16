import { useCallback, useMemo, useState } from "react";
import {
  buildComparison,
  COMPARABLE_METRICS,
  type ComparableMetric,
  type ComparisonEntry,
  type ExperimentRecord,
} from "@/simulation/experiments/record";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/ui/Panel";
import { Select } from "@/components/ui/Select";
import { SwitchRow } from "@/components/ui/Switch";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ExperimentTable } from "@/components/experiments/ExperimentTable";
import { ComparisonChart } from "@/components/experiments/ComparisonChart";
import { SERIES_PALETTE } from "@/components/charts/chart-theme";
import { formatFixed, formatInt } from "@/lib/format";

/** Live run always takes the first palette colour; records follow. */
const LIVE_COLOR = SERIES_PALETTE[0];

function recordColor(index: number): string {
  return SERIES_PALETTE[(index + 1) % SERIES_PALETTE.length];
}

export interface ExperimentsViewProps {
  experiments: ExperimentRecord[];
  /** The current run as a record, or null when there is too little history. */
  liveRecord: ExperimentRecord | null;
  onCapture: (name: string) => ExperimentRecord;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onClear: () => void;
}

/**
 * The Experiments tab: capture the current run, keep a library of runs, and
 * overlay any subset of them (optionally including the live run) on one chart.
 * Everything plotted comes from the recorded `StatsSample` series.
 */
export function ExperimentsView({
  experiments,
  liveRecord,
  onCapture,
  onRemove,
  onRename,
  onClear,
}: ExperimentsViewProps) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set<string>());
  const [metric, setMetric] = useState<ComparableMetric>("population");
  const [includeLive, setIncludeLive] = useState(true);
  const [name, setName] = useState("");

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const capture = useCallback(() => {
    const label = name.trim() === "" ? `Run ${experiments.length + 1}` : name.trim();
    const record = onCapture(label);
    setSelectedIds((current) => new Set(current).add(record.id));
    setName("");
  }, [experiments.length, name, onCapture]);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(experiments.map((record) => record.id)));
  }, [experiments]);

  const selectNone = useCallback(() => setSelectedIds(new Set<string>()), []);

  const metricMeta = COMPARABLE_METRICS.find((m) => m.key === metric) ?? COMPARABLE_METRICS[0];

  const selection = useMemo(() => {
    const facts = experiments.map((record, index) => ({
      record,
      index,
      color: recordColor(index),
      selected: selectedIds.has(record.id),
    }));
    return { facts };
  }, [experiments, selectedIds]);

  const entries = useMemo<ComparisonEntry[]>(() => {
    const list: ComparisonEntry[] = [];
    if (includeLive && liveRecord !== null && liveRecord.history.length >= 2) {
      list.push({ id: "live", label: "Live run (current)", color: LIVE_COLOR, history: liveRecord.history });
    }
    for (const fact of selection.facts) {
      if (fact.selected) {
        list.push({
          id: fact.record.id,
          label: fact.record.name,
          color: fact.color,
          history: fact.record.history,
        });
      }
    }
    return list;
  }, [includeLive, liveRecord, selection]);

  const { data, series } = useMemo(
    () => buildComparison(entries, metric),
    [entries, metric],
  );

  const chosen = selection.facts.filter((fact) => fact.selected);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Panel
        title="Record current run"
        actions={
          liveRecord !== null ? (
            <Badge tone="live">
              {formatInt(liveRecord.history.length)} samples · tick {formatInt(liveRecord.ticks)}
            </Badge>
          ) : (
            <Badge tone="reset">collecting…</Badge>
          )
        }
      >
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-40 flex-1 flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-ink-faint">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && liveRecord !== null) capture();
              }}
              aria-label="Run name"
              placeholder={`Run ${experiments.length + 1}`}
              className="h-7 w-full border border-line bg-surface-2 px-2 text-[11px] text-ink outline-none hover:border-line-strong focus:border-accent"
            />
          </label>
          <Button variant="primary" disabled={liveRecord === null} onClick={capture}>
            Record current run
          </Button>
          {experiments.length > 0 && (
            <ConfirmDialog
              destructive
              title="Clear the experiment library?"
              description={`All ${experiments.length} recorded run(s) will be deleted. This cannot be undone.`}
              confirmLabel="Clear all"
              onConfirm={onClear}
              trigger={<Button variant="ghost">Clear library</Button>}
            />
          )}
        </div>
        <p className="pt-2 text-[9px] leading-relaxed text-ink-faint">
          Captures the full statistics series (every 30 ticks), the exact configuration and the
          seed at the moment of capture. The running simulation is not interrupted.
        </p>
      </Panel>

      <Panel
        title="Library"
        actions={
          experiments.length > 0 ? (
            <>
              <Button size="sm" variant="ghost" onClick={selectAll}>
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={selectNone}>
                None
              </Button>
            </>
          ) : undefined
        }
      >
        <ExperimentTable
          experiments={experiments}
          selectedIds={selectedIds}
          onToggle={toggle}
          onRename={onRename}
          onRemove={onRemove}
        />
      </Panel>

      <Panel title="Comparison">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex w-52 flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-ink-faint">Metric</span>
            <Select
              value={metric}
              onValueChange={(value) => setMetric(value as ComparableMetric)}
              aria-label="Comparison metric"
              options={COMPARABLE_METRICS.map((m) => ({ value: m.key, label: m.label }))}
            />
          </label>
          <div className="w-56">
            <SwitchRow
              label="Include live run"
              hint="Overlay the simulation currently running"
              checked={includeLive}
              disabled={liveRecord === null}
              onCheckedChange={setIncludeLive}
            />
          </div>
        </div>
        <p className="pt-2 text-[9px] leading-relaxed text-ink-faint">
          Runs are aligned by tick. Colours are assigned per run and stay fixed while you switch
          metrics.
        </p>
      </Panel>

      <ComparisonChart
        title={`${metricMeta.label} by tick`}
        data={data}
        series={series}
        digits={metricMeta.digits}
        emptyMessage={
          experiments.length === 0
            ? "Record a run to compare it."
            : "Select at least one run (or enable the live run) to plot it."
        }
      />

      {chosen.length > 0 && (
        <Panel title="Summary comparison">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-widest text-ink-faint">
                  <th className="px-2 py-1.5 font-medium">Run</th>
                  <th className="px-2 py-1.5 text-right font-medium">Ticks</th>
                  <th className="px-2 py-1.5 text-right font-medium">Final pop</th>
                  <th className="px-2 py-1.5 text-right font-medium">Peak</th>
                  <th className="px-2 py-1.5 text-right font-medium">Max gen</th>
                  <th className="px-2 py-1.5 text-right font-medium">Births</th>
                  <th className="px-2 py-1.5 text-right font-medium">Deaths</th>
                  <th className="px-2 py-1.5 text-right font-medium">Mean energy</th>
                  <th className="px-2 py-1.5 text-right font-medium">Speed</th>
                  <th className="px-2 py-1.5 text-right font-medium">Vision</th>
                  <th className="px-2 py-1.5 text-right font-medium">Dispersion</th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((fact) => {
                  const s = fact.record.summary;
                  return (
                    <tr key={fact.record.id} className="border-t border-line">
                      <td className="px-2 py-1">
                        <span className="mr-2 inline-block h-2 w-2 align-middle" style={{ backgroundColor: fact.color }} />
                        <span className="text-ink">{fact.record.name}</span>
                      </td>
                      <td className="px-2 py-1 text-right tnum text-ink-dim">{formatInt(s.ticks)}</td>
                      <td className="px-2 py-1 text-right tnum text-ink">{formatInt(s.finalPopulation)}</td>
                      <td className="px-2 py-1 text-right tnum text-ink-dim">{formatInt(s.peakPopulation)}</td>
                      <td className="px-2 py-1 text-right tnum text-cyan">{formatInt(s.maxGeneration)}</td>
                      <td className="px-2 py-1 text-right tnum text-green">{formatInt(s.totalBirths)}</td>
                      <td className="px-2 py-1 text-right tnum text-danger">{formatInt(s.totalDeaths)}</td>
                      <td className="px-2 py-1 text-right tnum text-amber">{formatFixed(s.finalMeanEnergy, 1)}</td>
                      <td className="px-2 py-1 text-right tnum">{formatFixed(s.finalMeanSpeedTrait, 3)}</td>
                      <td className="px-2 py-1 text-right tnum">{formatFixed(s.finalMeanVisionTrait, 1)}</td>
                      <td className="px-2 py-1 text-right tnum text-cyan">{formatFixed(s.finalGenomeDispersion, 3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="pt-2 text-[9px] text-ink-faint">
            Final values are the last emitted sample; totals are cumulative maxima over the run.
          </p>
        </Panel>
      )}
    </div>
  );
}
