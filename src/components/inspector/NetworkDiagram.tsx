import { GENOME_LAYOUT, getWeight } from "@/simulation/neural/genome";
import { OUTPUT_NAMES, SENSOR_NAMES } from "@/simulation/constants";

const VIEW_W = 330;
const VIEW_H = 250;
const INPUT_X = 92;
const HIDDEN_X = 196;
const OUTPUT_X = 300;
const TOP = 12;
const BOTTOM = VIEW_H - 12;

const POSITIVE = "#4fd1c5";
const NEGATIVE = "#e05c5c";

interface NetworkDiagramProps {
  genome: Float32Array;
  inputs: Float32Array;
  hidden: Float32Array;
  outputs: Float32Array;
}

function nodeY(count: number, index: number): number {
  return count <= 1 ? (TOP + BOTTOM) / 2 : TOP + ((BOTTOM - TOP) * index) / (count - 1);
}

function edgeOpacity(weight: number): number {
  return Math.min(0.85, 0.05 + Math.abs(weight) * 0.35);
}

function edgeWidth(weight: number): number {
  return 0.25 + Math.min(1, Math.abs(weight) * 0.5);
}

function nodeOpacity(activation: number): number {
  return 0.2 + 0.8 * Math.min(1, Math.abs(activation));
}

/**
 * The selected creature's real neural network. Node positions are fixed by the
 * genome layout; edge colour/width come from the live weights and node fill
 * from the live activations of the last forward pass. Nothing here is invented.
 */
export function NetworkDiagram({ genome, inputs, hidden, outputs }: NetworkDiagramProps) {
  const { inputCount, hiddenCount, outputCount } = GENOME_LAYOUT;

  const edges: React.ReactElement[] = [];
  for (let h = 0; h < hiddenCount; h++) {
    const hy = nodeY(hiddenCount, h);
    for (let i = 0; i < inputCount; i++) {
      const w = getWeight(genome, "w1", h, i);
      edges.push(
        <line
          key={`i${i}-h${h}`}
          x1={INPUT_X}
          y1={nodeY(inputCount, i)}
          x2={HIDDEN_X}
          y2={hy}
          stroke={w >= 0 ? POSITIVE : NEGATIVE}
          strokeWidth={edgeWidth(w)}
          strokeOpacity={edgeOpacity(w)}
        />,
      );
    }
  }
  for (let o = 0; o < outputCount; o++) {
    const oy = nodeY(outputCount, o);
    for (let h = 0; h < hiddenCount; h++) {
      const w = getWeight(genome, "w2", o, h);
      edges.push(
        <line
          key={`h${h}-o${o}`}
          x1={HIDDEN_X}
          y1={nodeY(hiddenCount, h)}
          x2={OUTPUT_X}
          y2={oy}
          stroke={w >= 0 ? POSITIVE : NEGATIVE}
          strokeWidth={edgeWidth(w)}
          strokeOpacity={edgeOpacity(w)}
        />,
      );
    }
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="h-auto w-full"
      role="img"
      aria-label="Neural network of the selected creature"
    >
      {edges}

      {Array.from({ length: inputCount }, (_, i) => {
        const a = inputs[i] ?? 0;
        return (
          <g key={`in${i}`}>
            <circle
              cx={INPUT_X}
              cy={nodeY(inputCount, i)}
              r={3.2}
              fill={a >= 0 ? POSITIVE : NEGATIVE}
              fillOpacity={nodeOpacity(a)}
              stroke="#20304d"
              strokeWidth={0.5}
            />
            <text
              x={INPUT_X - 6}
              y={nodeY(inputCount, i) + 2.2}
              textAnchor="end"
              fontSize={6.5}
              fill="#8fa1b8"
            >
              {SENSOR_NAMES[i]}
            </text>
          </g>
        );
      })}

      {Array.from({ length: hiddenCount }, (_, h) => {
        const a = hidden[h] ?? 0;
        return (
          <circle
            key={`hn${h}`}
            cx={HIDDEN_X}
            cy={nodeY(hiddenCount, h)}
            r={3}
            fill={a >= 0 ? POSITIVE : NEGATIVE}
            fillOpacity={nodeOpacity(a)}
            stroke="#20304d"
            strokeWidth={0.5}
          />
        );
      })}

      {Array.from({ length: outputCount }, (_, o) => {
        const a = outputs[o] ?? 0;
        return (
          <g key={`out${o}`}>
            <circle
              cx={OUTPUT_X}
              cy={nodeY(outputCount, o)}
              r={3.6}
              fill={a >= 0 ? POSITIVE : NEGATIVE}
              fillOpacity={nodeOpacity(a)}
              stroke="#20304d"
              strokeWidth={0.5}
            />
            <text
              x={OUTPUT_X + 7}
              y={nodeY(outputCount, o) + 2.4}
              textAnchor="start"
              fontSize={6.5}
              fill="#8fa1b8"
            >
              {OUTPUT_NAMES[o]}
            </text>
          </g>
        );
      })}

      <text x={INPUT_X} y={VIEW_H - 1} textAnchor="middle" fontSize={6} fill="#5a6a80">
        {inputCount} inputs
      </text>
      <text x={HIDDEN_X} y={VIEW_H - 1} textAnchor="middle" fontSize={6} fill="#5a6a80">
        {hiddenCount} hidden
      </text>
      <text x={OUTPUT_X} y={VIEW_H - 1} textAnchor="middle" fontSize={6} fill="#5a6a80">
        {outputCount} outputs
      </text>
    </svg>
  );
}
