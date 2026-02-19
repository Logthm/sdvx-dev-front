import type { RadarSchema } from "@/types/music";
import { useState } from "react";

interface RadarChartProps {
  data: RadarSchema;
  size?: number;
}

const AXES = [
  { key: "notes" as const, label: ["NOTES"] },
  { key: "peak" as const, label: ["PEAK"] },
  { key: "tsumami" as const, label: ["TSUMAMI"] },
  { key: "tricky" as const, label: ["TRICKY"] },
  { key: "hand_trip" as const, label: ["HAND", "TRIP"] },
  { key: "one_hand" as const, label: ["ONE", "HAND"] },
];

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleRad: number,
): [number, number] {
  return [cx + r * Math.sin(angleRad), cy - r * Math.cos(angleRad)];
}

export function RadarChart({ data, size = 140 }: RadarChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 35;
  const n = AXES.length;
  const step = (2 * Math.PI) / n;

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const dataPoints = AXES.map((axis, i) => {
    const val = Math.min(data[axis.key] / 200, 1);
    const r = val * maxR;
    return polarToCartesian(cx, cy, r, i * step);
  });
  const dataPath =
    dataPoints
      .map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`)
      .join(" ") + "Z";

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.72 0.155 70)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.65 0.2 275)" stopOpacity="0.08" />
        </radialGradient>
      </defs>

      {/* Concentric orbit rings — astrolabe style */}
      {gridLevels.map((level) => (
        <circle
          key={level}
          cx={cx}
          cy={cy}
          r={maxR * level}
          fill="none"
          stroke="oklch(0.72 0.155 70)"
          strokeWidth={level === 1 ? 1.2 : 0.5}
          opacity={level === 1 ? 0.3 : 0.15}
          strokeDasharray={level < 1 ? "2 4" : "none"}
        />
      ))}

      {/* Axis lines — star chart spokes */}
      {AXES.map((_, i) => {
        const [x, y] = polarToCartesian(cx, cy, maxR, i * step);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="oklch(0.72 0.155 70)"
            strokeWidth={0.5}
            opacity={0.2}
          />
        );
      })}

      {/* Data area */}
      <path
        d={dataPath}
        fill="url(#radar-fill)"
        stroke="oklch(0.72 0.155 70)"
        strokeWidth={1.5}
        opacity={0.9}
      />

      {/* Data points — star nodes */}
      {dataPoints.map((p, i) => (
        <g
          key={i}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHoveredIndex(i)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Invisible hit area */}
          <circle
            cx={p[0]}
            cy={p[1]}
            r={14}
            fill="transparent"
          />
          <circle
            cx={p[0]}
            cy={p[1]}
            r={hoveredIndex === i ? 4.5 : 2.5}
            fill="oklch(0.72 0.155 70)"
            stroke="oklch(0.09 0.04 275)"
            strokeWidth={1}
            style={{ pointerEvents: "none", transition: "r 0.2s" }}
          />
          {hoveredIndex === i && (
            <g style={{ pointerEvents: "none" }}>
              {/* Glow ring */}
              <circle
                cx={p[0]}
                cy={p[1]}
                r={8}
                fill="none"
                stroke="oklch(0.72 0.155 70)"
                strokeWidth={0.5}
                opacity={0.4}
              />
              <rect
                x={p[0] - 26}
                y={p[1] - 28}
                width={52}
                height={24}
                rx={4}
                fill="oklch(0.12 0.05 275)"
                stroke="oklch(0.72 0.155 70)"
                strokeWidth={0.8}
                opacity={0.95}
              />
              <text
                x={p[0]}
                y={p[1] - 16}
                textAnchor="middle"
                dominantBaseline="central"
                fill="oklch(0.72 0.155 70)"
                fontSize={14}
                fontFamily="var(--font-mono)"
                fontWeight="600"
              >
                {data[AXES[i].key]}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Axis labels */}
      {AXES.map((axis, i) => {
        let [x, y] = polarToCartesian(cx, cy, maxR + 16, i * step);
        if (axis.key === "tsumami") x += 10;
        const isMultiLine = axis.label.length > 1;
        return (
          <text
            key={axis.key}
            x={x}
            y={y}
            textAnchor={isMultiLine ? "end" : "middle"}
            dominantBaseline="central"
            fill="oklch(0.50 0.03 275)"
            fontSize={10}
            fontFamily="var(--font-mono)"
            fontWeight="500"
            letterSpacing="0.05em"
          >
            {isMultiLine ? (
              <>
                <tspan x={x} dy="-0.4em">{axis.label[0]}</tspan>
                <tspan x={x} dy="1.2em">{axis.label[1]}</tspan>
              </>
            ) : (
              axis.label[0]
            )}
          </text>
        );
      })}
    </svg>
  );
}
