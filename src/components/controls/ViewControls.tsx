import { COLOR_MODES, type ColorMode } from "@/simulation/worker-messages";
import type { ViewOptions } from "@/simulation/renderer/draw";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { SwitchRow } from "@/components/ui/Switch";
import { Panel } from "@/components/ui/Panel";

const COLOR_LABEL: Record<ColorMode, string> = {
  energy: "Energy",
  generation: "Gen",
  speed: "Speed",
};

const OVERLAY_OPTIONS: ReadonlyArray<{
  key: keyof ViewOptions;
  label: string;
  hint?: string;
}> = [
  { key: "showFood", label: "Food" },
  { key: "showObstacles", label: "Obstacles" },
  {
    key: "showSensorLines",
    label: "Sensor lines",
    hint: "From the selected creature to what it sensed",
  },
  { key: "showVisionCircle", label: "Vision radius" },
  { key: "showLabels", label: "Labels" },
];

export interface ViewControlsProps {
  colorMode: ColorMode;
  onColorMode: (mode: ColorMode) => void;
  view: ViewOptions;
  onView: (patch: Partial<ViewOptions>) => void;
  onZoom: (factor: number) => void;
  onResetView: () => void;
  zoomPercent: number;
}

export function ViewControls({
  colorMode,
  onColorMode,
  view,
  onView,
  onZoom,
  onResetView,
  zoomPercent,
}: ViewControlsProps) {
  return (
    <div className="flex flex-col">
      <Panel title="Colour by">
        <Segmented
          size="sm"
          value={colorMode}
          onChange={onColorMode}
          options={COLOR_MODES.map((mode) => ({ value: mode, label: COLOR_LABEL[mode] }))}
        />
      </Panel>

      <Panel title="Overlays" flush>
        <div className="flex flex-col">
          {OVERLAY_OPTIONS.map((option) => (
            <SwitchRow
              key={option.key}
              label={option.label}
              hint={option.hint}
              checked={view[option.key]}
              onCheckedChange={(checked) => onView({ [option.key]: checked })}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Zoom">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onZoom(1 / 1.25)} aria-label="Zoom out">
            −
          </Button>
          <Button size="sm" onClick={() => onZoom(1.25)} aria-label="Zoom in">
            +
          </Button>
          <Button size="sm" onClick={onResetView} className="flex-1">
            Fit
          </Button>
          <span
            className="tnum w-12 text-right text-[11px] text-ink-dim"
            role="status"
            aria-label={`Zoom ${Math.round(zoomPercent)} percent`}
          >
            {Math.round(zoomPercent)}%
          </span>
        </div>
      </Panel>
    </div>
  );
}
