import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonSeries } from "@/simulation/experiments/record";
import { Panel } from "@/components/ui/Panel";
import { CHART_COLORS, CHART_MARGIN, TOOLTIP_STYLE } from "@/components/charts/chart-theme";
import { formatCompact, formatInt } from "@/lib/format";

interface ComparisonChartProps {
  title: string;
  data: Array<Record<string, number>>;
  series: ComparisonSeries[];
  digits: number;
  height?: number;
  /** Shown when there is nothing to draw. */
  emptyMessage: string;
}

/** Overlays several runs of one metric on a shared tick axis. */
export function ComparisonChart({
  title,
  data,
  series,
  digits,
  height = 300,
  emptyMessage,
}: ComparisonChartProps) {
  const empty = data.length < 2 || series.length === 0;

  return (
    <Panel
      title={title}
      actions={
        <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-[9px] text-ink-faint">
              <span className="h-1.5 w-3" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </span>
      }
    >
      <div style={{ height }} className="w-full">
        {empty ? (
          <div className="flex h-full items-center justify-center text-[10px] text-ink-faint">
            {emptyMessage}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="tick"
                type="number"
                domain={["dataMin", "dataMax"]}
                tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                tickFormatter={(v: number) => formatCompact(v)}
                stroke={CHART_COLORS.grid}
                minTickGap={28}
              />
              <YAxis
                width={42}
                tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                tickFormatter={(v: number) => formatCompact(v)}
                stroke={CHART_COLORS.grid}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#8fa1b8" }}
                cursor={{ stroke: CHART_COLORS.grid }}
                labelFormatter={(label) => `tick ${formatInt(Number(label))}`}
                formatter={(value, name) => [Number(value).toFixed(digits), String(name)]}
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={1.3}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
