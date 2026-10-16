import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SwitchRow } from "@/components/ui/Switch";
import type { UsePersistenceResult } from "@/hooks/usePersistence";
import { formatInt, formatTimestamp } from "@/lib/format";

/**
 * The "Autosave" panel: the reserved rolling snapshot. It is deliberately kept
 * out of the manual slot list so it can never be mistaken for a checkpoint.
 */
export function AutosavePanel({ persistence }: { persistence: UsePersistenceResult }) {
  const autosave = persistence.autosave;

  return (
    <Panel
      title="Autosave"
      actions={
        autosave !== null ? (
          <Badge tone="live">tick {formatInt(autosave.tick)}</Badge>
        ) : (
          <Badge tone="neutral">empty</Badge>
        )
      }
    >
      <SwitchRow
        label="Autosave while running"
        hint="Writes a rolling snapshot every 30 seconds (skipped when paused or unchanged)"
        checked={persistence.autosaveEnabled}
        onCheckedChange={persistence.setAutosaveEnabled}
      />
      <div className="flex flex-wrap items-center gap-2 pt-3">
        <Button
          variant="primary"
          disabled={autosave === null || persistence.busy}
          onClick={() => autosave !== null && void persistence.load(autosave.id)}
        >
          Restore autosave
        </Button>
        {autosave !== null && (
          <span className="text-[10px] text-ink-faint">
            Saved {formatTimestamp(autosave.createdAt)} · {formatInt(autosave.population)} creatures ·{" "}
            {formatInt(autosave.samples)} samples
          </span>
        )}
      </div>
      <p className="pt-2 text-[9px] leading-relaxed text-ink-faint">
        The autosave slot is separate from manual saves: it is overwritten in place and never listed
        above, so it cannot be mistaken for a deliberate checkpoint.
      </p>
    </Panel>
  );
}
