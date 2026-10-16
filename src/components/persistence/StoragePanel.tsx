import { useCallback, useState } from "react";
import { HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, Stat } from "@/components/ui/Panel";
import { statsToCsv } from "@/simulation/experiments/csv";
import { DB_NAME } from "@/storage/db";
import type { SimulationApi } from "@/hooks/useSimulation";
import type { UsePersistenceResult } from "@/hooks/usePersistence";
import type { ExperimentLibrary } from "@/hooks/useExperimentLibrary";
import { downloadText } from "@/lib/download";
import { formatBytes, formatCompact, formatInt } from "@/lib/format";
import { Notice, type NoticeState } from "./Notice";
import { SaveSlotTable } from "./SaveSlotTable";
import { AutosavePanel } from "./AutosavePanel";
import { ImportExportPanel } from "./ImportExportPanel";

export interface StoragePanelProps {
  sim: SimulationApi;
  persistence: UsePersistenceResult;
  library: ExperimentLibrary;
}

/**
 * The Saves tab: durable snapshots of the running world, the rolling autosave,
 * and file import/export for both worlds and the experiment library. This
 * component owns the "current run" actions; the slot table, autosave card and
 * import/export card live in their own files.
 */
export function StoragePanel({ sim, persistence, library }: StoragePanelProps) {
  const [name, setName] = useState("");
  const [worldNotice, setWorldNotice] = useState<NoticeState>(null);

  const handleSave = useCallback(() => {
    void persistence.save(name);
    setName("");
  }, [name, persistence]);

  const handleExportWorld = useCallback(() => {
    void (async () => {
      try {
        const json = await persistence.exportWorldJson();
        downloadText(`emergent-world-${formatInt(sim.tick)}.json`, json, "application/json");
        setWorldNotice({ tone: "ok", text: "World exported as JSON." });
      } catch (cause) {
        setWorldNotice({
          tone: "error",
          text: cause instanceof Error ? cause.message : String(cause),
        });
      }
    })();
  }, [persistence, sim.tick]);

  const handleExportCsv = useCallback(() => {
    if (sim.statsHistory.length === 0) {
      setWorldNotice({ tone: "error", text: "No statistics recorded yet." });
      return;
    }
    downloadText(
      `emergent-stats-${formatInt(sim.tick)}.csv`,
      statsToCsv(sim.statsHistory),
      "text/csv",
    );
    setWorldNotice({
      tone: "ok",
      text: `Exported ${formatInt(sim.statsHistory.length)} statistics samples as CSV.`,
    });
  }, [sim.statsHistory, sim.tick]);

  if (!persistence.supported) {
    return (
      <Panel title="Storage">
        <p className="text-[11px] leading-relaxed text-ink-dim">
          This browser does not expose IndexedDB, so save slots and a persistent experiment library
          are unavailable. The simulation, statistics and experiments still work for this session,
          and JSON/CSV export remains available.
        </p>
        <div className="flex flex-wrap gap-2 pt-3">
          <Button onClick={handleExportWorld}>Export world (JSON)</Button>
          <Button onClick={handleExportCsv}>Export statistics (CSV)</Button>
        </div>
        {worldNotice !== null && <Notice tone={worldNotice.tone}>{worldNotice.text}</Notice>}
      </Panel>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Panel
        title="Current run"
        actions={<Badge tone="accent">tick {formatInt(sim.tick)}</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Population" value={formatInt(sim.population)} />
          <Stat label="Stats samples" value={formatInt(sim.statsHistory.length)} />
          <Stat label="Seed" value={formatInt(sim.config.seed)} />
          <Stat label="Status" value={sim.status === "running" ? "running" : "paused"} />
        </div>
        <div className="flex flex-wrap items-end gap-2 pt-3">
          <label className="flex min-w-40 flex-1 flex-col gap-1">
            <span className="text-[9px] uppercase tracking-widest text-ink-faint">
              Snapshot name
            </span>
            <input
              value={name}
              aria-label="Snapshot name"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSave();
              }}
              placeholder={`Save ${persistence.saves.length + 1}`}
              className="h-7 w-full border border-line bg-surface-2 px-2 text-[11px] text-ink outline-none hover:border-line-strong focus:border-accent"
            />
          </label>
          <Button
            variant="primary"
            disabled={persistence.busy}
            onClick={handleSave}
            data-testid="save-snapshot"
          >
            Save snapshot
          </Button>
          <Button onClick={handleExportWorld} disabled={persistence.busy}>
            Export world
          </Button>
          <Button onClick={handleExportCsv}>Export CSV</Button>
        </div>
        <p className="pt-2 text-[9px] leading-relaxed text-ink-faint">
          A snapshot stores the exact world state plus the recorded statistics, so loading it
          resumes the whole laboratory — creatures, food, RNG and history. Export produces a
          portable JSON world or a CSV of the statistics series.
        </p>
        {worldNotice !== null && <Notice tone={worldNotice.tone}>{worldNotice.text}</Notice>}
        {persistence.error !== null && <Notice tone="error">{persistence.error}</Notice>}
      </Panel>

      <SaveSlotTable persistence={persistence} />
      <AutosavePanel persistence={persistence} />
      <ImportExportPanel persistence={persistence} library={library} />

      <Panel
        title="Storage"
        actions={
          <span className="flex items-center gap-1 text-[9px] text-ink-faint">
            <HardDrive className="h-3 w-3" />
            IndexedDB
          </span>
        }
      >
        {persistence.usage !== null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Used" value={formatBytes(persistence.usage.usedBytes)} />
            <Stat label="Quota" value={formatCompact(persistence.usage.quotaBytes)} />
            <Stat
              label="Saves"
              value={formatInt(persistence.saves.length + (persistence.autosave === null ? 0 : 1))}
            />
            <Stat label="Recorded runs" value={formatInt(library.experiments.length)} />
          </div>
        ) : (
          <p className="text-[10px] text-ink-faint">Storage estimate unavailable.</p>
        )}
        <p className="pt-2 text-[9px] leading-relaxed text-ink-faint">
          Everything is stored locally in this browser (the <code>{DB_NAME}</code> database);
          nothing is uploaded anywhere.
        </p>
      </Panel>
    </div>
  );
}
