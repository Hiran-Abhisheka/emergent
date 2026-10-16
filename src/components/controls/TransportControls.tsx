import type { SimStatus } from "@/hooks/useSimulation";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8, 16] as const;

interface TransportControlsProps {
  status: SimStatus;
  speed: number;
  onToggleRun: () => void;
  onReset: () => void;
  onSpeed: (speed: number) => void;
}

export function TransportControls({
  status,
  speed,
  onToggleRun,
  onReset,
  onSpeed,
}: TransportControlsProps) {
  const running = status === "running";
  const booting = status === "booting";

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={running ? "default" : "primary"}
        onClick={onToggleRun}
        disabled={booting}
        className="w-16"
      >
        {running ? "Pause" : "Start"}
      </Button>

      <ConfirmDialog
        destructive
        title="Reset the world?"
        description="This rebuilds the world from the current configuration. All creatures, food, statistics and the recorded run are discarded. Saved slots are not affected."
        confirmLabel="Reset"
        onConfirm={onReset}
        trigger={<Button variant="danger">Reset</Button>}
      />

      <div className="ml-2 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-ink-faint">Speed</span>
        <Segmented
          size="sm"
          value={speed}
          onChange={(value) => onSpeed(value)}
          options={SPEED_OPTIONS.map((option) => ({ value: option, label: `${option}×` }))}
        />
      </div>
    </div>
  );
}
