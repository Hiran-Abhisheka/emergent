import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/ui/Panel";
import { CHART_COLORS, CHART_MARGIN, TOOLTIP_STYLE } from "@/components/charts/chart-theme";
import { formatCompact, formatInt } from "@/lib/format";

export interface SeriesSpec {
  key: string;
  label: string;
  color: string;
  /** Draw as a filled area under the line. */
  area?: boolean;
}

interface TimeSeriesChartProps {
  title: string;
  data: ReadonlyArray<Record<string, number>>;
  series: SeriesSpec[];
  height?: number;
  /** Fixed y-domain; omit for auto. */
  domain?: [number | "auto", number | "auto"];
  digits?: number;
  hint?: string;
}

/**
 * One dependency-free time-series figure. `data` rows are keyed by "tick".
 * No smoothing or interpolation is applied: the line is the real samples.
 */
export function TimeSeriesChart({
  title,
  data,
  series,
  height = 150,
  domain,
  digits = 1,
  hint,
}: TimeSeriesChartProps) {
  const empty = data.length < 2;

  return (
    <Panel
      title={title}
      actions={
        <span className="flex items-center gap-2">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1 text-[9px] text-ink-faint">
              <span className="h-1.5 w-2.5" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </span>
      }
    >
      {hint !== undefined && <p className="pb-1 text-[9px] text-ink-faint">{hint}</p>}
      <div style={{ height }} className="w-full">
        {empty ? (
          <div className="flex h-full items-center justify-center text-[10px] text-ink-faint">
            Collecting samples…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data as Record<string, number>[]} margin={CHART_MARGIN}>
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
                width={38}
                domain={domain === undefined ? ["auto", "auto"] : domain}
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
                  isAnimationActive={false}
                  fill={s.area === true ? s.color : undefined}
                  fillOpacity={s.area === true ? 0.12 : undefined}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
