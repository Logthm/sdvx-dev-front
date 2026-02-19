/**
 * Decorative astrolabe — concentric circles, arc orbits, ticks, node dots.
 * Rendered as inline SVG, meant to sit behind content at low opacity.
 */

import { cn } from "@/lib/utils";

interface AstrolabeProps {
  className?: string;
  /** 0-1, default 0.07 */
  opacity?: number;
}

export function Astrolabe({ className, opacity = 0.07 }: AstrolabeProps) {
  const cx = 200;
  const cy = 200;
  const radii = [60, 100, 140, 175];
  const tickR = 175;
  const tickCount = 36;

  return (
    <svg
      viewBox="0 0 400 400"
      className={cn("pointer-events-none select-none", className)}
      style={{ opacity }}
      aria-hidden
    >
      {/* Concentric circles */}
      {radii.map((r) => (
        <circle
          key={r}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="oklch(0.72 0.155 70)"
          strokeWidth={0.8}
        />
      ))}

      {/* Arc with gap */}
      <path
        d={`M ${cx + 120} ${cy} A 120 120 0 1 0 ${cx - 40} ${cy - 113}`}
        fill="none"
        stroke="oklch(0.72 0.155 70)"
        strokeWidth={0.5}
        strokeDasharray="6 4"
      />

      {/* Ticks */}
      {Array.from({ length: tickCount }, (_, i) => {
        const angle = (i * 360) / tickCount;
        const rad = (angle * Math.PI) / 180;
        const inner = tickR - (i % 3 === 0 ? 8 : 4);
        return (
          <line
            key={i}
            x1={cx + inner * Math.cos(rad)}
            y1={cy + inner * Math.sin(rad)}
            x2={cx + tickR * Math.cos(rad)}
            y2={cy + tickR * Math.sin(rad)}
            stroke="oklch(0.72 0.155 70)"
            strokeWidth={i % 3 === 0 ? 0.8 : 0.4}
          />
        );
      })}

      {/* Node dots */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        return (
          <circle
            key={angle}
            cx={cx + 100 * Math.cos(rad)}
            cy={cy + 100 * Math.sin(rad)}
            r={2.5}
            fill="oklch(0.72 0.155 70)"
          />
        );
      })}

      {/* Small diamond nodes on inner ring */}
      {[45, 135, 225, 315].map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const x = cx + 60 * Math.cos(rad);
        const y = cy + 60 * Math.sin(rad);
        return (
          <rect
            key={angle}
            x={x - 2}
            y={y - 2}
            width={4}
            height={4}
            fill="oklch(0.72 0.155 70)"
            transform={`rotate(45 ${x} ${y})`}
          />
        );
      })}

      {/* Crosshair at center */}
      <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="oklch(0.72 0.155 70)" strokeWidth={0.5} />
      <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="oklch(0.72 0.155 70)" strokeWidth={0.5} />
    </svg>
  );
}
