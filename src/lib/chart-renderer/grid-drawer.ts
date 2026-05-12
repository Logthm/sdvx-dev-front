/**
 * Draws beat grid lines, measure lines, measure numbers, and BPM markers
 * in a multi-column layout.
 */

import type { BpmDisplayMode, HiSpeedMark } from "@/lib/editor-store";
import { C } from "./colors";
import {
  LANE_WIDTH,
  LINE_WIDTH,
  colXBase,
  TRACK_WIDTH,
  lanLeftX,
  trackCenterX,
  yInMeasure,
  type LayoutResult,
} from "./layout";
import type { Time3 } from "./time-mapper";

export function drawGrid(ctx: CanvasRenderingContext2D, layout: LayoutResult, measureOffset: number = 0) {
  const { spans, timeMapper: tm } = layout;

  for (const span of spans) {
    const laneLeft = lanLeftX(span.col);
    const laneRight = laneLeft + LANE_WIDTH;
    const center = trackCenterX(span.col);
    const lineLeft = center - LINE_WIDTH / 2;
    const lineRight = lineLeft + LINE_WIDTH;

    const ts = tm.getTimeSigAt([span.measure, 1, 0]);
    const beatCount = ts[0];

    // Sub-beat lines (quarter subdivisions within each beat)
    ctx.strokeStyle = C.SUB_BEAT_LINE;
    ctx.lineWidth = 0.5;
    for (let b = 0; b < beatCount; b++) {
      for (let sub = 1; sub < 4; sub++) {
        const beatFrac = (b + sub / 4) / beatCount;
        const y = span.y1 - beatFrac * (span.y1 - span.y0);
        ctx.beginPath();
        ctx.moveTo(laneLeft, y);
        ctx.lineTo(laneRight, y);
        ctx.stroke();
      }
    }

    // Beat lines
    ctx.strokeStyle = C.BEAT_LINE;
    ctx.lineWidth = 0.75;
    for (let b = 1; b < beatCount; b++) {
      const beatFrac = b / beatCount;
      const y = span.y1 - beatFrac * (span.y1 - span.y0);
      ctx.beginPath();
      ctx.moveTo(laneLeft, y);
      ctx.lineTo(laneRight, y);
      ctx.stroke();
    }

    // Measure lines (top and bottom of span)
    ctx.strokeStyle = C.MEASURE_LINE;
    ctx.lineWidth = 1;

    // Bottom measure line (start of measure)
    ctx.beginPath();
    ctx.moveTo(lineLeft, span.y1);
    ctx.lineTo(lineRight, span.y1);
    ctx.stroke();

    // Top measure line (end of measure)
    ctx.beginPath();
    ctx.moveTo(lineLeft, span.y0);
    ctx.lineTo(lineRight, span.y0);
    ctx.stroke();

    // Measure number (left of lane) - add measureOffset to display original measure number
    ctx.fillStyle = C.MEASURE_TEXT;
    ctx.font = "600 12px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      String(span.measure + measureOffset).padStart(2, "0"),
      lineLeft - 4,
      span.y1 + 1,
    );
  }
}

/**
 * Extended grid draw that also handles BPM markers from chart data.
 * Called by the renderer which has access to chartData.
 */
export function drawGridWithBpm(
  ctx: CanvasRenderingContext2D,
  layout: LayoutResult,
  bpmInfo: Array<{ measure: number; beat: number; cell: number; bpm: number }>,
  hiSpeed?: number,
  hiSpeedMarks: HiSpeedMark[] = [],
  bpmDisplayMode: BpmDisplayMode = "bpm",
  measureOffset?: number,
) {
  drawGrid(ctx, layout, measureOffset);
  drawBpmMarkersFromData(ctx, layout, bpmInfo, hiSpeed, hiSpeedMarks, bpmDisplayMode);
}

function drawBpmMarkersFromData(
  ctx: CanvasRenderingContext2D,
  layout: LayoutResult,
  bpmInfo: Array<{ measure: number; beat: number; cell: number; bpm: number }>,
  hiSpeed?: number,
  hiSpeedMarks: HiSpeedMark[] = [],
  bpmDisplayMode: BpmDisplayMode = "bpm",
) {
  const { spans, timeMapper: tm, pxPerSecond } = layout;

  ctx.font = "500 12px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = C.BPM_TEXT;

  const sorted = [...bpmInfo].sort(
    (a, b) => a.measure - b.measure || a.beat - b.beat || a.cell - b.cell,
  );

  let lastBpm = -1;
  const BPM_EPSILON = 0.001; // Tolerance for floating point comparison

  for (const bpm of sorted) {
    // Skip if BPM is essentially the same as the last one (within epsilon)
    if (Math.abs(bpm.bpm - lastBpm) < BPM_EPSILON) {
      continue;
    }
    lastBpm = bpm.bpm;

    const span = spans.find((s) => s.measure === bpm.measure);
    if (!span) continue;

    const time: Time3 = [bpm.measure, bpm.beat, bpm.cell];
    const y = yInMeasure(span, time, tm, pxPerSecond);

    // Green line across the full track
    const trackLeft = colXBase(span.col);
    ctx.strokeStyle = C.BPM_TEXT;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trackLeft, y);
    ctx.lineTo(trackLeft + TRACK_WIDTH, y);
    ctx.stroke();

    // BPM value text to the right
    const textX = trackLeft + TRACK_WIDTH + 4;
    const hs = effectiveHiSpeedAt(time, tm, hiSpeed, hiSpeedMarks);
    let label: string;
    if (bpmDisplayMode === "hispeed" && hs) {
      label = `x${hs.toFixed(1)}`;
    } else if (bpmDisplayMode === "speed" && hs) {
      label = `${(bpm.bpm * hs / 100).toFixed(2)}`;
    } else {
      label = `${bpm.bpm}`;
    }
    ctx.fillText(label, textX, y + 1);
  }
}

export function effectiveHiSpeedAt(
  time: Time3,
  tm: LayoutResult["timeMapper"],
  baseHiSpeed: number | undefined,
  marks: HiSpeedMark[],
): number | undefined {
  if (!baseHiSpeed && marks.length === 0) return undefined;
  const sec = tm.secondsOf(time);
  let hs = baseHiSpeed;
  let latestSec = -Infinity;
  for (const m of marks) {
    const mEnd = tm.secondsOf(m.time as Time3) + m.durationMs / 1000;
    if (sec >= mEnd && mEnd > latestSec) {
      latestSec = mEnd;
      hs = m.hiSpeed;
    }
  }
  return hs;
}

export function drawHiSpeedMarks(
  ctx: CanvasRenderingContext2D,
  layout: LayoutResult,
  marks: HiSpeedMark[],
) {
  const { spans, timeMapper: tm, pxPerSecond } = layout;

  for (const mark of marks) {
    const markSec = tm.secondsOf(mark.time as Time3);
    const endSec = markSec + mark.durationMs / 1000;

    for (const span of spans) {
      // Check if this span overlaps the mark's time range
      if (span.sec1 <= markSec || span.sec0 >= endSec) continue;

      const trackLeft = colXBase(span.col);
      const clampStart = Math.max(markSec, span.sec0);
      const clampEnd = Math.min(endSec, span.sec1);
      const yStart = span.y1 - (clampStart - span.sec0) * pxPerSecond;
      const yEnd = span.y1 - (clampEnd - span.sec0) * pxPerSecond;

      // Blue shading
      ctx.fillStyle = C.HISPEED_SHADE;
      ctx.fillRect(trackLeft, yEnd, TRACK_WIDTH, yStart - yEnd);

      // Blue line at mark start (only if this span contains the start)
      if (markSec >= span.sec0 && markSec < span.sec1) {
        ctx.strokeStyle = C.HISPEED_LINE;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(trackLeft, yStart);
        ctx.lineTo(trackLeft + TRACK_WIDTH, yStart);
        ctx.stroke();

        // Hi-speed text on the LEFT
        ctx.fillStyle = C.HISPEED_TEXT;
        ctx.font = "500 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "bottom";
        ctx.fillText(`x${mark.hiSpeed.toFixed(1)}`, trackLeft - 4, yStart + 1);
      }
    }
  }
}
