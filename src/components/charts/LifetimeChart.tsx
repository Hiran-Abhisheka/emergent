import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GenerationBucket } from "@/simulation/types";
import { Panel } from "@/components/ui/Panel";
import { CHART_COLORS, CHART_MARGIN, TOOLTIP_STYLE } from "@/components/charts/chart-theme";
import { formatInt } from "@/lib/format";

interface LifetimeChartProps {
  buckets: GenerationBucket[];
  height?: number;
}

/**
 * Mean food eaten per *completed* lifetime, bucketed by generation (bars, left
 * axis) with mean lifespan at death (line, right axis). Only dead creatures
 * contribute, so the samples are exact.
 */
export function LifetimeChart({ buckets, height = 190 }: LifetimeChartProps) {
  const data = buckets.map((b) => ({
    bucket: b.bucketStart,
    meanFoodEaten: b.meanFoodEaten,
    meanLifespan: b.meanLifespan,
    count: b.count,
  }));
  const empty = data.length === 0;

  return (
    <Panel
      title="Food per completed lifetime, by generation"
      actions={
        <span className="flex items-center gap-2 text-[9px] text-ink-faint">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-2.5" style={{ backgroundColor: CHART_COLORS.food }} />
            food eaten
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-2.5" style={{ backgroundColor: CHART_COLORS.lifespan }} />
            lifespan
          </span>
        </span>
      }
    >
      <p className="pb-1 text-[9px] text-ink-faint">
        Exact means over creatures that have already died. Hover for the number of completed
        lifetimes in each bucket.
      </p>
      <div style={{ height }} className="w-full">
        {empty ? (
          <div className="flex h-full items-center justify-center text-[10px] text-ink-faint">
            No completed lifetimes yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={CHART_MARGIN}>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                stroke={CHART_COLORS.grid}
                tickFormatter={(v: number) => `g${v}+`}
              />
              <YAxis
                yAxisId="food"
                width={34}
                tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                stroke={CHART_COLORS.grid}
              />
              <YAxis
                yAxisId="life"
                orientation="right"
                width={40}
                tick={{ fontSize: 9, fill: CHART_COLORS.axis }}
                stroke={CHART_COLORS.grid}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#8fa1b8" }}
                cursor={{ fill: "#16202f" }}
                labelFormatter={(label) => `generation bucket ${label}+`}
                formatter={(value, name, item) => {
                  const count = (item?.payload as { count?: number } | undefined)?.count;
                  const suffix = name === "completed" ? "" : count === undefined ? "" : ` (${formatInt(count)})`;
                  return [Number(value).toFixed(2), `${String(name)}${suffix}`];
                }}
              />
              <Bar
                yAxisId="food"
                dataKey="meanFoodEaten"
                name="food eaten"
                fill={CHART_COLORS.food}
                fillOpacity={0.55}
                isAnimationActive={false}
              />
              <Line
                yAxisId="life"
                type="linear"
                dataKey="meanLifespan"
                name="lifespan"
                stroke={CHART_COLORS.lifespan}
                strokeWidth={1.3}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
