import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Panel } from "@/components/ui/Panel";
import type { UsePersistenceResult } from "@/hooks/usePersistence";
import { formatInt, formatTimestamp } from "@/lib/format";

/**
 * The "Save slots" panel: named snapshots of the world, listable and restorable
 * independently of the rolling autosave.
 */
export function SaveSlotTable({ persistence }: { persistence: UsePersistenceResult }) {
  return (
    <Panel
      title="Save slots"
      actions={
        <>
          <Badge tone="neutral">{formatInt(persistence.saves.length)} saved</Badge>
          {persistence.saves.length > 0 && (
            <ConfirmDialog
              destructive
              title="Delete all save slots?"
              description={`All ${persistence.saves.length} manual save(s) will be removed. The autosave is kept.`}
              confirmLabel="Delete all"
              onConfirm={() => void persistence.clearAll()}
              trigger={
                <Button size="sm" variant="ghost">
                  Clear all
                </Button>
              }
            />
          )}
        </>
      }
    >
      {!persistence.ready ? (
        <p className="py-3 text-[10px] text-ink-faint">Reading storage…</p>
      ) : persistence.saves.length === 0 ? (
        <p className="py-3 text-[10px] leading-relaxed text-ink-faint">
          No save slots yet. Name and save the current run above; slots are stored in this browser
          and survive a reload.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-widest text-ink-faint">
                <th className="px-2 py-1.5 font-medium">Name</th>
                <th className="px-2 py-1.5 text-right font-medium">Tick</th>
                <th className="px-2 py-1.5 text-right font-medium">Pop</th>
                <th className="px-2 py-1.5 text-right font-medium">Seed</th>
                <th className="px-2 py-1.5 text-right font-medium">Samples</th>
                <th className="px-2 py-1.5 font-medium">Saved</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {persistence.saves.map((slot) => (
                <tr key={slot.id} className="border-t border-line hover:bg-surface-2">
                  <td className="px-2 py-1 text-ink">{slot.name}</td>
                  <td className="px-2 py-1 text-right tnum text-ink-dim">{formatInt(slot.tick)}</td>
                  <td className="px-2 py-1 text-right tnum text-ink-dim">
                    {formatInt(slot.population)}
                  </td>
                  <td className="px-2 py-1 text-right tnum text-ink-faint">
                    {formatInt(slot.seed)}
                  </td>
                  <td className="px-2 py-1 text-right tnum text-ink-faint">
                    {formatInt(slot.samples)}
                  </td>
                  <td className="px-2 py-1 text-ink-faint">{formatTimestamp(slot.createdAt)}</td>
                  <td className="px-2 py-1">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={persistence.busy}
                        aria-label={`Load ${slot.name}`}
                        onClick={() => void persistence.load(slot.id)}
                      >
                        Load
                      </Button>
                      <ConfirmDialog
                        destructive
                        title={`Delete “${slot.name}”?`}
                        description="The saved world is removed from this browser. This cannot be undone."
                        confirmLabel="Delete"
                        onConfirm={() => void persistence.remove(slot.id)}
                        trigger={
                          <Button size="icon" variant="ghost" aria-label={`Delete ${slot.name}`}>
                            ×
                          </Button>
                        }
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
