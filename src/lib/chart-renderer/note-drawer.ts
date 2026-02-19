/**
 * Draws BT and FX notes as simple solid rectangles.
 *
 * Drawing order: FX holds -> FX chips/caps -> BT holds -> BT chips/caps
 * Hold notes that span multiple measures are drawn segment-by-segment,
 * matching the backend's _draw_hold_segments logic.
 */

import type { ButtonEvent, ChartData } from "@/types/chart";
import { C } from "./colors";
import type { Time3 } from "./time-mapper";
import {
  BT_POSITIONS,
  BT_WIDTH,
  FX_POSITIONS,
  FX_WIDTH,
  findSpanByMeasure,
  trackCenterX,
  yInMeasure,
  type LayoutResult,
  type MeasureSpan,
} from "./layout";

export const CHIP_HEIGHT = 4;

export function noteX(span: MeasureSpan, trackName: string): { x: number; w: number } | null {
  const cx = trackCenterX(span.col);

  if (trackName.startsWith("BT-")) {
    const key = trackName.slice(3); // "A", "B", "C", "D"
    const offset = BT_POSITIONS[key];
    if (offset === undefined) return null;
    return { x: cx + offset - BT_WIDTH / 2, w: BT_WIDTH };
  }

  if (trackName.startsWith("FX-")) {
    const key = trackName.slice(3); // "L", "R"
    const offset = FX_POSITIONS[key];
    if (offset === undefined) return null;
    return { x: cx + offset - FX_WIDTH / 2, w: FX_WIDTH };
  }

  return null;
}

function isFx(trackName: string): boolean {
  return trackName === "FX-L" || trackName === "FX-R";
}

function drawChip(
  ctx: CanvasRenderingContext2D,
  ev: ButtonEvent,
  layout: LayoutResult,
  fx: boolean,
) {
  const span = findSpanByMeasure(layout.spans, ev.time[0]);
  if (!span) return;

  const geo = noteX(span, ev.track_name);
  if (!geo) return;

  const y = yInMeasure(
    span,
    ev.time as Time3,
    layout.timeMapper,
    layout.pxPerSecond,
  );

  ctx.fillStyle = fx ? C.FX_CHIP : C.BT_CHIP;
  ctx.fillRect(geo.x, y - CHIP_HEIGHT / 2, geo.w, CHIP_HEIGHT);
}

function drawHoldSegments(
  ctx: CanvasRenderingContext2D,
  ev: ButtonEvent,
  layout: LayoutResult,
  fx: boolean,
) {
  const startTime = ev.time as Time3;
  const endTime = layout.timeMapper.advanceUnits(startTime, ev.hold_len);
  const startMeasure = startTime[0];
  const endMeasure = endTime[0];

  for (let m = startMeasure; m <= endMeasure; m++) {
    const span = findSpanByMeasure(layout.spans, m);
    if (!span) continue;

    const geo = noteX(span, ev.track_name);
    if (!geo) continue;

    const segStart: Time3 =
      m === startMeasure ? startTime : [m, 1, 0];
    const segEnd: Time3 =
      m === endMeasure ? endTime : [m + 1, 1, 0];

    const y1 = yInMeasure(span, segStart, layout.timeMapper, layout.pxPerSecond);
    // For the end at next measure boundary, use span top
    let y2: number;
    if (segEnd[0] === m + 1 && segEnd[1] === 1 && segEnd[2] === 0) {
      y2 = span.y0;
    } else {
      y2 = yInMeasure(span, segEnd, layout.timeMapper, layout.pxPerSecond);
    }

    if (y1 <= y2) continue; // should flow bottom-to-top

    const yTop = Math.min(y1, y2);
    const yBottom = Math.max(y1, y2);
    const h = Math.max(1, yBottom - yTop);

    // Recompute x for this column (hold may span columns)
    const colGeo = noteX(span, ev.track_name);
    if (!colGeo) continue;

    ctx.fillStyle = fx ? C.FX_HOLD : C.BT_HOLD;
    ctx.fillRect(colGeo.x, yTop, colGeo.w, h);
  }
}

function collectButtonEvents(
  chartData: ChartData,
  trackNums: number[],
): ButtonEvent[] {
  const events: ButtonEvent[] = [];
  for (const t of trackNums) {
    for (const ev of chartData.tracks[String(t)] ?? []) {
      if (ev.type === "button") events.push(ev);
    }
  }
  return events;
}

export function drawNotes(
  ctx: CanvasRenderingContext2D,
  chartData: ChartData,
  layout: LayoutResult,
) {
  // Layer 1: FX holds
  const fxEvents = collectButtonEvents(chartData, [2, 7]);
  for (const ev of fxEvents) {
    if (ev.hold_len > 0) drawHoldSegments(ctx, ev, layout, true);
  }

  // Layer 2: FX chips + FX hold caps
  for (const ev of fxEvents) {
    if (ev.hold_len <= 0) drawChip(ctx, ev, layout, true);
  }
  for (const ev of fxEvents) {
    if (ev.hold_len > 0) drawChip(ctx, ev, layout, true);
  }

  // Layer 3: BT holds
  const btEvents = collectButtonEvents(chartData, [3, 4, 5, 6]);
  for (const ev of btEvents) {
    if (ev.hold_len > 0) drawHoldSegments(ctx, ev, layout, false);
  }

  // Layer 4: BT chips + BT hold caps
  for (const ev of btEvents) {
    if (ev.hold_len <= 0) drawChip(ctx, ev, layout, false);
  }
  for (const ev of btEvents) {
    if (ev.hold_len > 0) drawChip(ctx, ev, layout, false);
  }
}
