import {
  OUTPUT_NAMES,
  REPRODUCE_OUTPUT_THRESHOLD,
  SENSOR_NAMES,
  SENSOR_FOOD_BEARING,
  SENSOR_OBSTACLE_BEARING,
  TICKS_PER_SECOND,
  TRAIT_RANGES,
  type TraitName,
} from "@/simulation/constants";
import { TRAIT_NAMES } from "@/simulation/evolution/traits";
import type { InspectedCreature } from "@/simulation/worker-messages";
import { Badge } from "@/components/ui/Badge";
import { Panel, Stat } from "@/components/ui/Panel";
import { BarRow } from "@/components/inspector/BarRow";
import { NetworkDiagram } from "@/components/inspector/NetworkDiagram";
import { formatFixed, formatInt } from "@/lib/format";

const TRAIT_LABEL: Record<TraitName, string> = {
  maxSpeed: "Max speed",
  visionRange: "Vision range",
  metabolicMultiplier: "Metabolic ×",
  mutationRate: "Mutation rate",
};

const SIGNED_SENSORS = new Set<number>([SENSOR_FOOD_BEARING, SENSOR_OBSTACLE_BEARING]);

export interface InspectorPanelProps {
  inspection: InspectedCreature | null;
  /** Applied energy ceiling (for the absolute energy bar). */
  maxEnergy: number;
  /** Ticks elapsed in the run, for "age as % of life" context. */
  tick: number;
}

/** Everything real we know about the selected creature, refreshed ~10×/s. */
export function InspectorPanel({ inspection, maxEnergy, tick }: InspectorPanelProps) {
  if (inspection === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
        <p className="text-[11px] text-ink-dim">No creature selected.</p>
        <p className="text-[10px] leading-relaxed text-ink-faint">
          Click a creature on the canvas to inspect its traits, its live sensor readings, its
          network outputs and the exact weights connecting them. Press Escape to clear the
          selection.
        </p>
      </div>
    );
  }

  const c = inspection;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Panel
        title="Creature"
        actions={
          <>
            <Badge tone="cyan">gen {c.generation}</Badge>
            <Badge tone={c.cooldown > 0 ? "reset" : "live"}>
              {c.cooldown > 0 ? `cooldown ${formatInt(c.cooldown)}` : "ready"}
            </Badge>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <Stat label="ID" value={`#${c.id}`} />
          <Stat label="Energy" value={formatFixed(c.energy, 1)} tone="green" hint={`/ ${maxEnergy}`} />
          <Stat
            label="Age"
            value={`${formatInt(c.age)} t`}
            hint={`${formatFixed(c.age / TICKS_PER_SECOND, 1)} s`}
          />
          <Stat label="Food eaten" value={formatInt(c.foodEaten)} tone="accent" />
          <Stat label="Born tick" value={formatInt(c.birthTick)} />
          <Stat
            label="Parent"
            value={c.parentId >= 0 ? `#${c.parentId}` : "founder"}
            tone={c.parentId >= 0 ? "default" : "cyan"}
          />
          <Stat label="X" value={formatFixed(c.x, 1)} />
          <Stat label="Y" value={formatFixed(c.y, 1)} />
        </div>
        <p className="mt-2 text-[9px] text-ink-faint">
          Live at tick {formatInt(tick)} · updated every 3 simulation ticks.
        </p>
      </Panel>

      <Panel title="Energy" flush>
        <div className="px-3 pb-3">
          <BarRow
            label="Stored energy"
            value={c.energy}
            min={0}
            max={Math.max(maxEnergy, c.energy)}
            fill="bg-green"
            digits={1}
          />
        </div>
      </Panel>

      <Panel title="Traits" flush>
        <div className="space-y-1.5 px-3 pb-3">
          {TRAIT_NAMES.map((name) => {
            const range = TRAIT_RANGES[name];
            return (
              <BarRow
                key={name}
                label={TRAIT_LABEL[name]}
                value={c.traits[name]}
                min={range.min}
                max={range.max}
                digits={name === "visionRange" ? 0 : 3}
              />
            );
          })}
          <p className="pt-1 text-[9px] leading-tight text-ink-faint">
            Bars span each trait&apos;s allowed range, not the population&apos;s range.
          </p>
        </div>
      </Panel>

      <Panel title="Sensors (inputs)" flush>
        <div className="space-y-1.5 px-3 pb-3">
          {SENSOR_NAMES.map((name, index) => {
            const signed = SIGNED_SENSORS.has(index);
            return (
              <BarRow
                key={name}
                label={name}
                value={c.inputs[index] ?? 0}
                min={signed ? -1 : 0}
                max={1}
                signed={signed}
                digits={2}
                fill={index === 3 || index === 1 ? "bg-green" : "bg-accent"}
              />
            );
          })}
        </div>
      </Panel>

      <Panel title="Outputs (actions)" flush>
        <div className="space-y-1.5 px-3 pb-3">
          {OUTPUT_NAMES.map((name, index) => (
            <BarRow
              key={name}
              label={name}
              value={c.outputs[index] ?? 0}
              min={-1}
              max={1}
              signed
              digits={2}
              fill={index === 3 ? "bg-amber" : "bg-accent"}
            />
          ))}
          <p className="pt-1 text-[9px] leading-tight text-ink-faint">
            A reproduce output above {REPRODUCE_OUTPUT_THRESHOLD} counts as an attempt.
          </p>
        </div>
      </Panel>

      <Panel title="Neural network" flush>
        <div className="px-2 pb-3">
          <NetworkDiagram
            genome={c.genome}
            inputs={c.inputs}
            hidden={c.hidden}
            outputs={c.outputs}
          />
          <p className="px-1 pt-1 text-[9px] leading-tight text-ink-faint">
            Line colour shows weight sign (cyan positive, red negative); line opacity/width show
            magnitude. Node fill shows the activation from the last forward pass.
          </p>
        </div>
      </Panel>
    </div>
  );
}
