/**
 * Multi-column chart renderer — orchestrates grid, notes, and lasers
 * across multiple columns on an HTML5 Canvas.
 */

import type { ChartData } from "@/types/chart";
import { C } from "./colors";
import type { BpmDisplayMode, HiSpeedMark } from "@/lib/editor-store";
import { drawGridWithBpm, drawHiSpeedMarks } from "./grid-drawer";
import { drawLasers } from "./laser-drawer";
import {
  colXBase,
  computeLayout,
  DEFAULT_COLUMN_HEIGHT,
  DEFAULT_PX_PER_SECOND,
  LANE_WIDTH,
  OOB_WIDTH,
  TRACK_WIDTH,
  type LayoutResult,
} from "./layout";
import { TimeMapper } from "./time-mapper";
import { drawNotes } from "./note-drawer";

export interface ViewState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface RenderResult {
  layout: LayoutResult;
}

export function renderChart(
  ctx: CanvasRenderingContext2D,
  chartData: ChartData,
  viewWidth: number,
  viewHeight: number,
  state: ViewState,
  pxPerSecond: number = DEFAULT_PX_PER_SECOND,
  columnHeight: number = DEFAULT_COLUMN_HEIGHT,
  hiSpeed?: number,
  hiSpeedMarks: HiSpeedMark[] = [],
  bpmDisplayMode: BpmDisplayMode = "bpm",
): RenderResult {
  const layout = computeLayout(chartData, pxPerSecond, columnHeight);

  ctx.save();

  // Clear background
  ctx.fillStyle = C.BG;
  ctx.fillRect(0, 0, viewWidth, viewHeight);

  // Apply pan and zoom
  ctx.translate(-state.panX * state.zoom, -state.panY * state.zoom);
  ctx.scale(state.zoom, state.zoom);

  // Visible area in chart-space coordinates
  const visLeft = state.panX;
  const visRight = state.panX + viewWidth / state.zoom;
  const visTop = state.panY;
  const visBottom = state.panY + viewHeight / state.zoom;

  // Draw each visible column
  for (let col = 0; col < layout.numColumns; col++) {
    const xBase = colXBase(col);
    const xRight = xBase + TRACK_WIDTH;

    // Viewport culling: skip columns entirely outside view
    if (xRight < visLeft || xBase > visRight) continue;
    if (layout.columnHeight < visTop || 0 > visBottom) continue;

    drawColumnBackground(ctx, col, layout.columnHeight, layout.spans);
  }

  // Draw hi-speed shading behind grid
  if (hiSpeedMarks.length > 0) drawHiSpeedMarks(ctx, layout, hiSpeedMarks);

  // Draw grid, notes, lasers (they iterate spans internally)
  drawGridWithBpm(ctx, layout, chartData.bpm_info, hiSpeed, hiSpeedMarks, bpmDisplayMode);
  drawNotes(ctx, chartData, layout);
  drawLasers(ctx, chartData, layout);

  ctx.restore();

  return { layout };
}

function drawColumnBackground(
  ctx: CanvasRenderingContext2D,
  col: number,
  _columnHeight: number,
  spans: LayoutResult["spans"],
) {
  const xBase = colXBase(col);
  const laneLeft = xBase + OOB_WIDTH;

  // Find the y-extent of this column's measures
  const colSpans = spans.filter((s) => s.col === col);
  if (colSpans.length === 0) return;

  const minY = Math.min(...colSpans.map((s) => s.y0));
  const maxY = Math.max(...colSpans.map((s) => s.y1));

  // OOB zones (darker)
  ctx.fillStyle = "rgba(8, 12, 24, 0.6)";
  ctx.fillRect(xBase, minY - 2, OOB_WIDTH, maxY - minY + 4);
  ctx.fillRect(laneLeft + LANE_WIDTH, minY - 2, OOB_WIDTH, maxY - minY + 4);

  // Main lane background
  ctx.fillStyle = C.LANE_BG;
  ctx.fillRect(laneLeft, minY - 2, LANE_WIDTH, maxY - minY + 4);

  // Lane border lines
  ctx.strokeStyle = C.LANE_BORDER;
  ctx.lineWidth = 1;
  for (const x of [laneLeft, laneLeft + LANE_WIDTH]) {
    ctx.beginPath();
    ctx.moveTo(x, minY - 2);
    ctx.lineTo(x, maxY + 2);
    ctx.stroke();
  }
}

/** Compute the BPM that occupies the most time in the chart. */
export function computeMainBpm(chartData: ChartData): number {
  const tm = new TimeMapper(chartData);
  const sorted = [...chartData.bpm_info].sort(
    (a, b) => a.measure - b.measure || a.beat - b.beat || a.cell - b.cell,
  );
  if (sorted.length === 0) return 120;

  const endSec = chartData.end_position
    ? tm.secondsOf([chartData.end_position.measure, chartData.end_position.beat, chartData.end_position.cell])
    : tm.secondsOf([sorted[sorted.length - 1].measure + 1, 1, 0]);

  const durations = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const curSec = tm.secondsOf([cur.measure, cur.beat, cur.cell]);
    const nextSec = i + 1 < sorted.length
      ? tm.secondsOf([sorted[i + 1].measure, sorted[i + 1].beat, sorted[i + 1].cell])
      : endSec;
    durations.set(cur.bpm, (durations.get(cur.bpm) ?? 0) + (nextSec - curSec));
  }

  let mainBpm = sorted[0].bpm;
  let maxDur = 0;
  for (const [bpm, dur] of durations) {
    if (dur > maxDur) { maxDur = dur; mainBpm = bpm; }
  }
  return mainBpm;
}
