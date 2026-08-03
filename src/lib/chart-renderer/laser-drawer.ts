/**
 * Draws laser tracks as line segments, handling cross-column boundaries.
 *
 * When a laser segment spans two columns, virtual exit/enter points are
 * inserted at the column boundary with interpolated offsets — matching
 * the backend's _columnize_points logic. This ensures laser lines extend
 * to the edge of one column and resume from the corresponding edge of the
 * next column, rather than drawing across the gutter.
 */

import type { ChartData, LaserEvent } from "@/types/chart";
import { C, LASER_COLOR_MAP } from "./colors";
import type { LaserColor } from "@/lib/editor-store";
import {
  findSpanByMeasure,
  lanLeftX,
  laserOffsetToX,
  yInMeasure,
  type LayoutResult,
  type MeasureSpan,
} from "./layout";
import type { TimePosition } from "@/types/chart-domain";
import type { TimeMapper } from "./time-mapper";

// ── Column boundary helpers ─────────────────────────────────────

interface ColBounds {
  /** (sec at top edge, y at top edge) — latest time in the column */
  top: { sec: number; y: number };
  /** (sec at bottom edge, y at bottom edge) — earliest time in the column */
  bottom: { sec: number; y: number };
}

function buildColumnBounds(spans: MeasureSpan[]): Map<number, ColBounds> {
  const colSpans = new Map<number, MeasureSpan[]>();
  for (const s of spans) {
    const arr = colSpans.get(s.col) ?? [];
    arr.push(s);
    colSpans.set(s.col, arr);
  }

  const bounds = new Map<number, ColBounds>();
  for (const [col, list] of colSpans) {
    let topSpan = list[0];
    let bottomSpan = list[0];
    for (const s of list) {
      if (s.y0 < topSpan.y0) topSpan = s;
      if (s.y1 > bottomSpan.y1) bottomSpan = s;
    }
    bounds.set(col, {
      top: { sec: topSpan.sec1, y: topSpan.y0 },
      bottom: { sec: bottomSpan.sec0, y: bottomSpan.y1 },
    });
  }
  return bounds;
}

function secToY(
  sec: number,
  col: number,
  spans: MeasureSpan[],
  pxPerSecond: number,
  colBounds: Map<number, ColBounds>,
): number {
  for (const s of spans) {
    if (s.col === col && sec >= s.sec0 - 1e-9 && sec <= s.sec1 + 1e-9) {
      return s.y1 - (sec - s.sec0) * pxPerSecond;
    }
  }
  const b = colBounds.get(col);
  if (!b) return 0;
  return Math.abs(sec - b.top.sec) < 1e-7 ? b.top.y : b.bottom.y;
}

function interpolateOffset(
  off1: number,
  sec1: number,
  off2: number,
  sec2: number,
  targetSec: number,
): number {
  if (Math.abs(sec2 - sec1) < 1e-9) return off1;
  const t = Math.max(0, Math.min(1, (targetSec - sec1) / (sec2 - sec1)));
  return off1 + t * (off2 - off1);
}

// ── Point types ─────────────────────────────────────────────────

interface ResolvedPoint {
  sec: number;
  offset: number;
  isOob: boolean;
  flag: number;
  col: number;
  x: number;
  y: number;
}

export function resolveEvent(
  ev: LaserEvent,
  tm: TimeMapper,
  spans: MeasureSpan[],
  pxPerSecond: number,
): ResolvedPoint | null {
  const time = ev.time as TimePosition;
  const sec = tm.secondsOf(time);
  const span = findSpanByMeasure(spans, time[0]);
  if (!span) return null;

  const laneLeft = lanLeftX(span.col);
  const x = laserOffsetToX(ev.offset, ev.is_out_of_bounds, laneLeft);
  const y = yInMeasure(span, time, tm, pxPerSecond);

  return {
    sec,
    offset: ev.offset,
    isOob: ev.is_out_of_bounds,
    flag: ev.flag,
    col: span.col,
    x,
    y,
  };
}

// ── Build column-local streams with cross-column interpolation ──

interface ColumnPoint {
  x: number;
  y: number;
  col: number;
  flag: number;
  sec: number;
  offset: number;
  isOob: boolean;
  isVirtual: boolean;
  /** Same-time pair for slam detection */
  sameTimePrev?: boolean;
}

function buildColumnStreams(
  events: LaserEvent[],
  layout: LayoutResult,
): Map<number, ColumnPoint[]> {
  const { spans, timeMapper: tm, pxPerSecond } = layout;
  const colBounds = buildColumnBounds(spans);

  // Resolve all events to points
  const resolved: ResolvedPoint[] = [];
  for (const ev of events) {
    const p = resolveEvent(ev, tm, spans, pxPerSecond);
    if (p) resolved.push(p);
  }

  const streams = new Map<number, ColumnPoint[]>();

  function push(col: number, pt: Omit<ColumnPoint, "col">) {
    const arr = streams.get(col) ?? [];
    arr.push({ ...pt, col });
    streams.set(col, arr);
  }

  for (let i = 0; i < resolved.length; i++) {
    const p = resolved[i];

    // Push the original point
    push(p.col, {
      x: p.x,
      y: p.y,
      flag: p.flag,
      sec: p.sec,
      offset: p.offset,
      isOob: p.isOob,
      isVirtual: false,
    });

    if (i === resolved.length - 1) break;

    const q = resolved[i + 1];

    // Same time = slam, skip cross-column logic for slams
    if (Math.abs(p.sec - q.sec) < 1e-7) continue;

    // Cross-column: insert exit + enter at boundary
    if (p.col !== q.col) {
      const bounds = colBounds.get(p.col);
      if (!bounds) continue;
      const boundarySec = bounds.top.sec;

      const interpOff = interpolateOffset(
        p.offset,
        p.sec,
        q.offset,
        q.sec,
        boundarySec,
      );
      const interpOob = p.isOob || q.isOob;

      // Exit point at top of col1
      const exitLaneLeft = lanLeftX(p.col);
      const exitX = laserOffsetToX(interpOff, interpOob, exitLaneLeft);
      const exitY = secToY(boundarySec, p.col, spans, pxPerSecond, colBounds);

      push(p.col, {
        x: exitX,
        y: exitY,
        flag: 0,
        sec: boundarySec,
        offset: interpOff,
        isOob: interpOob,
        isVirtual: true,
      });

      // Enter point at bottom of col2
      const enterBounds = colBounds.get(q.col);
      if (enterBounds) {
        const enterLaneLeft = lanLeftX(q.col);
        const enterX = laserOffsetToX(interpOff, interpOob, enterLaneLeft);
        const enterY = secToY(
          boundarySec,
          q.col,
          spans,
          pxPerSecond,
          colBounds,
        );

        push(q.col, {
          x: enterX,
          y: enterY,
          flag: 0,
          sec: boundarySec,
          offset: interpOff,
          isOob: interpOob,
          isVirtual: true,
        });
      }
    }
  }

  // Sort each column's points by time
  for (const [, pts] of streams) {
    pts.sort((a, b) => a.sec - b.sec);
  }

  return streams;
}

// ── Segment and draw ────────────────────────────────────────────

function drawStartMarker(
  ctx: CanvasRenderingContext2D,
  point: ColumnPoint,
  color: string,
) {
  const s = 8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(point.x, point.y + s / 2 + 2);
  ctx.lineTo(point.x - s / 2, point.y + s / 2 + 2 + s);
  ctx.lineTo(point.x + s / 2, point.y + s / 2 + 2 + s);
  ctx.closePath();
  ctx.fill();
}

function segmentAndDraw(
  ctx: CanvasRenderingContext2D,
  allPoints: ColumnPoint[],
  strokeColor: string,
) {
  // Segment by flag: 1=start, 0=relay, 2=terminate
  const segments: ColumnPoint[][] = [];
  let current: ColumnPoint[] | null = null;

  for (const p of allPoints) {
    if (p.flag === 1) {
      if (current && current.length > 0) segments.push(current);
      current = [p];
    } else if (p.flag === 0) {
      if (!current) current = [p];
      else current.push(p);
    } else if (p.flag === 2) {
      if (current) {
        current.push(p);
        segments.push(current);
        current = null;
      }
    }
  }
  if (current && current.length > 0) segments.push(current);

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (const seg of segments) {
    if (seg.length === 0) continue;

    if (seg[0].flag === 1) {
      drawStartMarker(ctx, seg[0], strokeColor);
      ctx.lineWidth = 8;
    }

    if (seg.length < 2) continue;

    ctx.beginPath();
    ctx.moveTo(seg[0].x, seg[0].y);

    for (let i = 1; i < seg.length; i++) {
      const prev = seg[i - 1];
      const cur = seg[i];

      // Slam: same time, different x
      const sameTime = Math.abs(prev.sec - cur.sec) < 1e-7;
      if (sameTime && Math.abs(prev.x - cur.x) > 1) {
        ctx.lineTo(cur.x, prev.y);
        ctx.lineTo(cur.x, cur.y);
      } else {
        ctx.lineTo(cur.x, cur.y);
      }
    }

    ctx.stroke();
  }
}

function drawLaserTrack(
  ctx: CanvasRenderingContext2D,
  events: LaserEvent[],
  layout: LayoutResult,
  strokeColor: string,
) {
  if (events.length === 0) return;

  const streams = buildColumnStreams(events, layout);

  // Draw each column's points separately so lines never cross gutters
  const allCols = [...streams.keys()].sort((a, b) => a - b);
  for (const c of allCols) {
    const pts = streams.get(c)!;
    segmentAndDraw(ctx, pts, strokeColor);
  }
}

// ── Public API ──────────────────────────────────────────────────

export function drawLasers(
  ctx: CanvasRenderingContext2D,
  chartData: ChartData,
  layout: LayoutResult,
  laserLColor?: LaserColor,
  laserRColor?: LaserColor,
) {
  const laserLEvents = (chartData.tracks["1"] ?? []).filter(
    (e): e is LaserEvent => e.type === "laser",
  );
  const laserREvents = (chartData.tracks["8"] ?? []).filter(
    (e): e is LaserEvent => e.type === "laser",
  );

  if (laserLEvents.length === 0 && laserREvents.length === 0) return;

  const colorL = laserLColor ? LASER_COLOR_MAP[laserLColor] : C.LASER_L;
  const colorR = laserRColor ? LASER_COLOR_MAP[laserRColor] : C.LASER_R;

  const { width, height } = ctx.canvas;
  const transform = ctx.getTransform();

  function makeOffscreen(): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const cx = c.getContext("2d")!;
    cx.setTransform(transform);
    return [c, cx];
  }

  // Draw each laser on its own offscreen canvas
  const [offL, ctxL] = makeOffscreen();
  drawLaserTrack(ctxL, laserLEvents, layout, colorL);

  const [offR, ctxR] = makeOffscreen();
  drawLaserTrack(ctxR, laserREvents, layout, colorR);

  // Composite onto main canvas (identity transform — offscreens already transformed)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  ctx.drawImage(offL, 0, 0);
  ctx.drawImage(offR, 0, 0);

  // Overlap boost: white highlight where both lasers exist (backend overlap_boost=150)
  const [offO, ctxO] = makeOffscreen();
  ctxO.setTransform(1, 0, 0, 1, 0, 0);
  ctxO.drawImage(offL, 0, 0);
  ctxO.globalCompositeOperation = "source-in";
  ctxO.drawImage(offR, 0, 0);
  ctxO.globalCompositeOperation = "source-in";
  ctxO.fillStyle = `rgba(255, 255, 255, ${150 / 255})`;
  ctxO.fillRect(0, 0, width, height);

  ctx.drawImage(offO, 0, 0);
  ctx.restore();
}
