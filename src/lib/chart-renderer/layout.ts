/**
 * Multi-column layout engine — port of backend LayoutManager.
 *
 * Measures flow bottom-to-top within each column; when a measure
 * doesn't fit in the remaining column space, it wraps to the next column.
 *
 * All pixel constants match the backend's chart_drawer.py exactly.
 */

import type { ChartData, ChartTimingData } from "@/types/chart";
import { TimeMapper, type Time3 } from "./time-mapper";

// ── Layout constants (matching backend) ─────────────────────────

export const LANE_WIDTH = 96.5;
export const OOB_WIDTH = 48.25;
export const TRACK_WIDTH = LANE_WIDTH + OOB_WIDTH * 2; // 193
export const GUTTER_WIDTH = 60;
export const LEFT_GUTTER = GUTTER_WIDTH / 2; // space before first column for HS/measure labels
export const MARGIN = 10;
export const DEFAULT_PX_PER_SECOND = 300;
export const DEFAULT_COLUMN_HEIGHT = 1400;

// ── Lane geometry (from track center) ───────────────────────────

export const BT_POSITIONS: Record<string, number> = {
  A: -25.5,
  B: -8.5,
  C: 8.5,
  D: 25.5,
};
export const FX_POSITIONS: Record<string, number> = { L: -16.75, R: 16.75 };
export const BT_WIDTH = 13;
export const FX_WIDTH = 34;
export const LINE_WIDTH = 95;

export const LASER_WIDTH = 12;

// ── MeasureSpan ─────────────────────────────────────────────────

export interface MeasureSpan {
  measure: number;
  col: number;
  /** Top edge pixel Y (smaller = higher on canvas, later in time) */
  y0: number;
  /** Bottom edge pixel Y (larger = lower on canvas, earlier in time) */
  y1: number;
  sec0: number; // seconds at measure start
  sec1: number; // seconds at measure end
}

// ── LayoutResult ────────────────────────────────────────────────

export interface LayoutResult {
  spans: MeasureSpan[];
  timeMapper: TimeMapper;
  numColumns: number;
  canvasWidth: number;
  canvasHeight: number;
  pxPerSecond: number;
  columnHeight: number;
}

// ── Compute layout ──────────────────────────────────────────────

export function computeLayout(
  chartData: ChartData,
  pxPerSecond: number = DEFAULT_PX_PER_SECOND,
  columnHeight: number = DEFAULT_COLUMN_HEIGHT,
): LayoutResult {
  const tm = new TimeMapper(chartData);
  const endMeasure = chartData.end_position?.measure ?? 1;
  const spans: MeasureSpan[] = [];

  let currentCol = 0;
  let currentY = columnHeight - MARGIN;

  for (let m = 1; m <= endMeasure; m++) {
    const startTime: Time3 = [m, 1, 0];
    const endTime: Time3 = [m + 1, 1, 0];
    const sec0 = tm.secondsOf(startTime);
    const sec1 = tm.secondsOf(endTime);
    const measureHeight = (sec1 - sec0) * pxPerSecond;

    if (currentY - measureHeight < MARGIN) {
      currentCol++;
      currentY = columnHeight - MARGIN;
    }

    spans.push({
      measure: m,
      col: currentCol,
      y0: currentY - measureHeight,
      y1: currentY,
      sec0,
      sec1,
    });

    currentY -= measureHeight;
  }

  const numColumns = spans.length > 0 ? spans[spans.length - 1].col + 1 : 1;
  const canvasWidth =
    numColumns * (TRACK_WIDTH + GUTTER_WIDTH) - GUTTER_WIDTH + 2 * MARGIN + LEFT_GUTTER;

  return {
    spans,
    timeMapper: tm,
    numColumns,
    canvasWidth: Math.max(100, canvasWidth),
    canvasHeight: Math.max(100, columnHeight),
    pxPerSecond,
    columnHeight,
  };
}

// ── Single-column layout (for playback mode) ────────────────

export function computeSingleColumnLayout(
  chartData: ChartTimingData,
  pxPerSecond: number = DEFAULT_PX_PER_SECOND,
): LayoutResult {
  const tm = new TimeMapper(chartData);
  const endMeasure = chartData.end_position?.measure ?? 1;

  // First pass: compute total height
  // Only top margin — no bottom margin so chart content starts at the
  // very bottom of the image (important for playback scroll alignment).
  let totalHeight = MARGIN;
  const heights: number[] = [];
  for (let m = 1; m <= endMeasure; m++) {
    const sec0 = tm.secondsOf([m, 1, 0]);
    const sec1 = tm.secondsOf([m + 1, 1, 0]);
    const h = (sec1 - sec0) * pxPerSecond;
    heights.push(h);
    totalHeight += h;
  }

  // Second pass: build spans bottom-to-top (start from very bottom)
  const spans: MeasureSpan[] = [];
  let currentY = totalHeight;

  for (let m = 1; m <= endMeasure; m++) {
    const sec0 = tm.secondsOf([m, 1, 0]);
    const sec1 = tm.secondsOf([m + 1, 1, 0]);
    const measureHeight = heights[m - 1];

    spans.push({
      measure: m,
      col: 0,
      y0: currentY - measureHeight,
      y1: currentY,
      sec0,
      sec1,
    });

    currentY -= measureHeight;
  }

  const canvasWidth = TRACK_WIDTH + GUTTER_WIDTH + 2 * MARGIN + LEFT_GUTTER;

  return {
    spans,
    timeMapper: tm,
    numColumns: 1,
    canvasWidth: Math.max(100, canvasWidth),
    canvasHeight: Math.max(100, totalHeight),
    pxPerSecond,
    columnHeight: totalHeight,
  };
}

// ── Helpers ─────────────────────────────────────────────────────

/** X base of a column's track area (left edge including OOB) */
export function colXBase(col: number): number {
  return MARGIN + LEFT_GUTTER + col * (TRACK_WIDTH + GUTTER_WIDTH);
}

/** X of the lane left edge within a column */
export function lanLeftX(col: number): number {
  return colXBase(col) + OOB_WIDTH;
}

/** Track center X for a column */
export function trackCenterX(col: number): number {
  return lanLeftX(col) + LANE_WIDTH / 2;
}

/** Y position within a measure span for a given time */
export function yInMeasure(
  span: MeasureSpan,
  time: Time3,
  tm: TimeMapper,
  pxPerSecond: number,
): number {
  const sec = tm.secondsOf(time);

  const epsSec = 0.25 / pxPerSecond;
  if (Math.abs(sec - span.sec0) <= epsSec) return span.y1;
  if (Math.abs(sec - span.sec1) <= epsSec) return span.y0;

  return span.y1 - (sec - span.sec0) * pxPerSecond;
}

/** Laser X position calculation matching backend _calculate_x_position */
export function laserOffsetToX(
  offset: number,
  isOob: boolean,
  laneLeftX: number,
): number {
  const half = LASER_WIDTH / 2;
  if (isOob) {
    const eff = LANE_WIDTH * 2;
    return laneLeftX - LANE_WIDTH * 0.5 + offset * eff;
  }
  const eff = LANE_WIDTH - LASER_WIDTH;
  return laneLeftX + half + offset * eff;
}

/** Find the MeasureSpan that contains a given seconds value */
export function findSpanBySec(
  spans: MeasureSpan[],
  sec: number,
): MeasureSpan | null {
  for (const s of spans) {
    if (sec >= s.sec0 - 1e-9 && sec <= s.sec1 + 1e-9) return s;
  }
  return null;
}

/** Find the MeasureSpan for a given measure number */
export function findSpanByMeasure(
  spans: MeasureSpan[],
  measure: number,
): MeasureSpan | null {
  for (const s of spans) {
    if (s.measure === measure) return s;
  }
  return null;
}

// ── Safe px/sec range ───────────────────────────────────────────

/** WebP hard limit — 16 383 px per dimension. */
const MAX_CANVAS_WIDTH = 16383;

/** Max columns that fit within MAX_CANVAS_WIDTH. */
const MAX_COLUMNS = Math.floor(
  (MAX_CANVAS_WIDTH + GUTTER_WIDTH - 2 * MARGIN - LEFT_GUTTER) / (TRACK_WIDTH + GUTTER_WIDTH),
);

/** Simulate the greedy layout and return the number of columns produced. */
function countColumns(
  durations: number[],
  pxPerSecond: number,
  columnHeight: number,
): number {
  let currentY = columnHeight - MARGIN;
  let col = 0;
  for (const dur of durations) {
    const h = dur * pxPerSecond;
    if (currentY - h < MARGIN) {
      col++;
      currentY = columnHeight - MARGIN;
    }
    currentY -= h;
  }
  return col + 1;
}

/**
 * Compute the maximum px_per_second that satisfies both:
 *  1. No single measure exceeds the column height.
 *  2. The resulting canvas width stays within the WebP dimension limit
 *     (16 383 px), so no format downgrade is needed.
 *
 * If chart data is unavailable or all measures are zero-length, returns Infinity.
 */
export function computeMaxPxPerSecond(
  chartData: ChartData,
  columnHeight: number = DEFAULT_COLUMN_HEIGHT,
): number {
  const tm = new TimeMapper(chartData);
  const endMeasure = chartData.end_position?.measure ?? 1;
  const available = columnHeight - 2 * MARGIN;

  const durations: number[] = [];
  let maxDuration = 0;
  for (let m = 1; m <= endMeasure; m++) {
    const sec0 = tm.secondsOf([m, 1, 0]);
    const sec1 = tm.secondsOf([m + 1, 1, 0]);
    const dur = sec1 - sec0;
    durations.push(dur);
    if (dur > maxDuration) maxDuration = dur;
  }

  if (maxDuration <= 0) return Infinity;

  // Constraint 1: height-based max
  const heightMax = Math.floor(available / maxDuration);

  // Constraint 2: width-based max (binary search)
  if (countColumns(durations, heightMax, columnHeight) <= MAX_COLUMNS) {
    return heightMax;
  }

  let lo = 1;
  let hi = heightMax;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (countColumns(durations, mid, columnHeight) <= MAX_COLUMNS) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

// ── Inverse helpers (chart-space → data) ─────────────────────────

/** Inverse of yInMeasure: pixel Y within a span → seconds */
export function yToSec(y: number, span: MeasureSpan, pxPerSecond: number): number {
  return span.sec0 + (span.y1 - y) / pxPerSecond;
}

/** Inverse of laserOffsetToX: pixel X → laser offset (0-1, clamped) */
export function xToLaserOffset(x: number, laneLeftX: number, isOob = false): number {
  if (isOob) {
    const eff = LANE_WIDTH * 2;
    return Math.max(0, Math.min(1, (x - laneLeftX + LANE_WIDTH * 0.5) / eff));
  }
  const half = LASER_WIDTH / 2;
  const eff = LANE_WIDTH - LASER_WIDTH;
  return Math.max(0, Math.min(1, (x - laneLeftX - half) / eff));
}

/** Find the MeasureSpan at a chart-space point (x, y) */
export function findSpanAtPoint(spans: MeasureSpan[], x: number, y: number): MeasureSpan | null {
  for (const s of spans) {
    const left = colXBase(s.col);
    if (x >= left && x <= left + TRACK_WIDTH && y >= s.y0 && y <= s.y1) return s;
  }
  return null;
}

/** Find span by Y within a specific column (ignores X — used during drag) */
export function findSpanByYInCol(spans: MeasureSpan[], y: number, col: number): MeasureSpan | null {
  for (const s of spans) {
    if (s.col === col && y >= s.y0 && y <= s.y1) return s;
  }
  return null;
}

/** Given chart-space X and column index, return the BT/FX track name hit, or null. */
export function xToTrackName(x: number, col: number): { trackName: string; trackNum: number } | null {
  const cx = trackCenterX(col);
  // Check BT lanes
  for (const [key, offset] of Object.entries(BT_POSITIONS)) {
    const left = cx + offset - BT_WIDTH / 2;
    if (x >= left && x <= left + BT_WIDTH) {
      const name = `BT-${key}`;
      const num = { A: 3, B: 4, C: 5, D: 6 }[key]!;
      return { trackName: name, trackNum: num };
    }
  }
  // Check FX lanes
  for (const [key, offset] of Object.entries(FX_POSITIONS)) {
    const left = cx + offset - FX_WIDTH / 2;
    if (x >= left && x <= left + FX_WIDTH) {
      const name = `FX-${key}`;
      const num = key === "L" ? 2 : 7;
      return { trackName: name, trackNum: num };
    }
  }
  return null;
}
