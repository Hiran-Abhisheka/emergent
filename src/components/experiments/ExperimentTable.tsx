import { useState } from "react";
import type { ExperimentRecord } from "@/simulation/experiments/record";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { safeFileStem, statsToCsv } from "@/simulation/experiments/csv";
import { cn } from "@/lib/cn";
import { downloadText } from "@/lib/download";
import { formatInt, formatTimestamp } from "@/lib/format";

interface ExperimentTableProps {
  experiments: ExperimentRecord[];
  selectedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}

/**
 * One editable name cell. While the user is typing it shows a local draft;
 * otherwise it shows the record's name, so an external rename is reflected
 * without an effect.
 */
function NameCell({ record, onRename }: { record: ExperimentRecord; onRename: (n: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? record.name;
  return (
    <input
      aria-label={`Name of ${record.name}`}
      value={value}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const trimmed = (draft ?? record.name).trim();
        onRename(trimmed === "" ? record.name : trimmed);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(null);
          event.currentTarget.blur();
        }
      }}
      className="w-full min-w-32 border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-ink hover:border-line focus:border-accent focus:bg-surface-2 focus:outline-none"
    />
  );
}

/** The recorded-runs library: select for comparison, rename, delete. */
export function ExperimentTable({
  experiments,
  selectedIds,
  onToggle,
  onRename,
  onRemove,
}: ExperimentTableProps) {
  if (experiments.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-[10px] leading-relaxed text-ink-faint">
        No runs recorded yet. Run the simulation, then use{" "}
        <span className="text-ink-dim">Record current run</span> to capture its statistics and
        configuration. Recorded runs can be compared side by side.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="text-left text-[9px] uppercase tracking-widest text-ink-faint">
            <th className="w-7 px-2 py-1.5" />
            <th className="px-2 py-1.5 font-medium">Name</th>
            <th className="px-2 py-1.5 text-right font-medium">Seed</th>
            <th className="px-2 py-1.5 text-right font-medium">Ticks</th>
            <th className="px-2 py-1.5 text-right font-medium">Pop</th>
            <th className="px-2 py-1.5 text-right font-medium">Peak</th>
            <th className="px-2 py-1.5 text-right font-medium">Gen</th>
            <th className="px-2 py-1.5 text-right font-medium">Births</th>
            <th className="px-2 py-1.5 font-medium">Recorded</th>
            <th className="w-20 px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {experiments.map((record) => {
            const selected = selectedIds.has(record.id);
            return (
              <tr
                key={record.id}
                className={cn(
                  "border-t border-line transition-colors",
                  selected ? "bg-accent/5" : "hover:bg-surface-2",
                )}
              >
                <td className="px-2 py-1 align-middle">
                  <input
                    type="checkbox"
                    aria-label={`Compare ${record.name}`}
                    checked={selected}
                    onChange={() => onToggle(record.id)}
                    className="h-3 w-3 accent-[var(--color-accent)]"
                  />
                </td>
                <td className="px-1 py-0.5 align-middle">
                  <NameCell record={record} onRename={(name) => onRename(record.id, name)} />
                </td>
                <td className="px-2 py-1 text-right tnum text-ink-dim">{formatInt(record.seed)}</td>
                <td className="px-2 py-1 text-right tnum text-ink-dim">
                  {formatInt(record.summary.ticks)}
                </td>
                <td className="px-2 py-1 text-right tnum text-ink">{formatInt(record.summary.finalPopulation)}</td>
                <td className="px-2 py-1 text-right tnum text-ink-dim">
                  {formatInt(record.summary.peakPopulation)}
                </td>
                <td className="px-2 py-1 text-right tnum text-cyan">
                  {formatInt(record.summary.maxGeneration)}
                </td>
                <td className="px-2 py-1 text-right tnum text-green">
                  {formatInt(record.summary.totalBirths)}
                </td>
                <td className="px-2 py-1 text-ink-faint">{formatTimestamp(record.createdAt)}</td>
                <td className="px-1 py-1 align-middle">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Export ${record.name} as CSV`}
                      onClick={() =>
                        downloadText(
                          `emergent-${safeFileStem(record.name)}.csv`,
                          statsToCsv(record.history),
                          "text/csv",
                        )
                      }
                    >
                      CSV
                    </Button>
                    <ConfirmDialog
                      destructive
                      title={`Delete “${record.name}”?`}
                      description="The recorded run is removed from the library. This cannot be undone."
                      confirmLabel="Delete"
                      onConfirm={() => onRemove(record.id)}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Delete ${record.name}`}>
                          ×
                        </Button>
                      }
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-2 px-3 py-2 text-[9px] text-ink-faint">
        <Badge tone="neutral">{experiments.length} recorded</Badge>
        <span>Select runs to overlay them on the comparison chart.</span>
      </div>
    </div>
  );
}