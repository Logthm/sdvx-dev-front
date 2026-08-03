import { drawGridWithBpm, drawHiSpeedMarks } from "@/lib/chart-renderer/grid-drawer";
import { drawLasers } from "@/lib/chart-renderer/laser-drawer";
import {
  colXBase,
  computeLayout,
  GUTTER_WIDTH,
  MARGIN,
  TRACK_WIDTH,
  type LayoutResult,
} from "@/lib/chart-renderer/layout";
import { drawNotes } from "@/lib/chart-renderer/note-drawer";
import type {
  BpmDisplayMode,
  HiSpeedMark,
  RenderOptions,
} from "@/lib/editor-store";
import type { ButtonEvent, ChartData, LaserEvent } from "@/types/chart";
import type { TimePosition } from "@/types/chart-domain";

export interface ChartImageExportRequest {
  chart: ChartData;
  renderOptions: RenderOptions;
  hiSpeedMarks: readonly HiSpeedMark[];
  speed: number;
  bpmDisplayMode: BpmDisplayMode;
  startMeasure: number;
  endMeasure: number;
}

export function getChartMaxMeasure(chart: ChartData): number {
  let maxMeasure = chart.end_position?.measure ?? 0;
  for (const events of Object.values(chart.tracks)) {
    for (const event of events) {
      maxMeasure = Math.max(maxMeasure, event.time[0]);
    }
  }
  for (const entry of chart.beat_info) {
    maxMeasure = Math.max(maxMeasure, entry.measure);
  }
  for (const entry of chart.bpm_info) {
    maxMeasure = Math.max(maxMeasure, entry.measure);
  }
  return Math.max(1, maxMeasure);
}

function downloadCanvas(
  canvas: HTMLCanvasElement,
  filename: string,
) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

export function exportChartImage(request: ChartImageExportRequest): void {
  const {
    chart,
    renderOptions,
    hiSpeedMarks,
    speed,
    bpmDisplayMode,
    startMeasure,
    endMeasure,
  } = request;
  const measureOffset = startMeasure - 1;
  const filteredTracks: Record<string, (ButtonEvent | LaserEvent)[]> = {};
  const fullLayout = computeLayout(
    chart,
    renderOptions.pxPerSecond,
    renderOptions.columnHeight,
  );

  const lastPositionInMeasure = (measure: number): TimePosition => {
    const [numerator, denominator] = fullLayout.timeMapper.getTimeSigAt([
      measure,
      1,
      0,
    ]);
    const unitsPerBeat = chart.beat_resolution
      ?? 192 / Math.max(1, denominator);
    return [measure, numerator, unitsPerBeat - 1];
  };

  const interpolateLaser = (
    previous: LaserEvent,
    next: LaserEvent,
    boundaryTime: TimePosition,
    flag: number,
  ): LaserEvent => {
    const previousSeconds = fullLayout.timeMapper.secondsOf(previous.time);
    const nextSeconds = fullLayout.timeMapper.secondsOf(next.time);
    const boundarySeconds = fullLayout.timeMapper.secondsOf(boundaryTime);
    const progress = (boundarySeconds - previousSeconds)
      / (nextSeconds - previousSeconds);
    return {
      type: "laser",
      track_name: previous.track_name,
      time: boundaryTime,
      offset: Math.round(
        previous.offset + (next.offset - previous.offset) * progress,
      ),
      flag,
      is_out_of_bounds: previous.is_out_of_bounds,
    };
  };

  for (const [track, events] of Object.entries(chart.tracks)) {
    if (track === "1" || track === "8") {
      const filtered: LaserEvent[] = [];
      let needsStartInterpolation = false;
      let previous: LaserEvent | null = null;
      let lastInRange: LaserEvent | null = null;

      for (const event of events as LaserEvent[]) {
        const measure = event.time[0];
        const inRange = measure >= startMeasure && measure <= endMeasure;
        if (measure < startMeasure) {
          previous = event;
          needsStartInterpolation = event.flag !== 2;
          continue;
        }

        if (inRange) {
          if (needsStartInterpolation && previous && filtered.length === 0) {
            const interpolated = interpolateLaser(
              previous,
              event,
              [startMeasure, 1, 0],
              1,
            );
            filtered.push({
              ...interpolated,
              time: [
                interpolated.time[0] - measureOffset,
                interpolated.time[1],
                interpolated.time[2],
              ],
            });
            needsStartInterpolation = false;
          }
          filtered.push({
            ...event,
            time: [measure - measureOffset, event.time[1], event.time[2]],
          });
          lastInRange = event;
          continue;
        }

        if (measure > endMeasure) {
          if (lastInRange && lastInRange.flag !== 2) {
            const interpolated = interpolateLaser(
              lastInRange,
              event,
              lastPositionInMeasure(endMeasure),
              2,
            );
            filtered.push({
              ...interpolated,
              time: [
                interpolated.time[0] - measureOffset,
                interpolated.time[1],
                interpolated.time[2],
              ],
            });
          }
          break;
        }
      }
      filteredTracks[track] = filtered;
      continue;
    }

    const processed: ButtonEvent[] = [];
    for (const event of events as ButtonEvent[]) {
      const [measure, beat, cell] = event.time;
      if (measure >= startMeasure && measure <= endMeasure) {
        if (event.hold_len > 0) {
          const holdEnd = fullLayout.timeMapper.advanceUnits(
            event.time,
            event.hold_len,
          );
          if (holdEnd[0] > endMeasure) {
            const truncatedLength = fullLayout.timeMapper.unitsBetween(
              event.time,
              [endMeasure + 1, 1, 0],
            );
            processed.push({
              ...event,
              time: [measure - measureOffset, beat, cell],
              hold_len: Math.max(0, truncatedLength),
            });
          } else {
            processed.push({
              ...event,
              time: [measure - measureOffset, beat, cell],
            });
          }
        } else {
          processed.push({
            ...event,
            time: [measure - measureOffset, beat, cell],
          });
        }
        continue;
      }

      if (measure >= startMeasure || event.hold_len <= 0) continue;
      const holdEnd = fullLayout.timeMapper.advanceUnits(
        event.time,
        event.hold_len,
      );
      if (holdEnd[0] < startMeasure) continue;

      const startBoundary: TimePosition = [startMeasure, 1, 0];
      let holdLength = fullLayout.timeMapper.unitsBetween(
        startBoundary,
        holdEnd,
      );
      if (holdEnd[0] > endMeasure) {
        holdLength = fullLayout.timeMapper.unitsBetween(
          startBoundary,
          [endMeasure + 1, 1, 0],
        );
      }
      processed.push({
        ...event,
        time: [1, 1, 0],
        hold_len: Math.max(0, holdLength),
      });
    }
    filteredTracks[track] = processed;
  }

  const filteredBpmInfo = chart.bpm_info
    .filter((entry) =>
      entry.measure >= startMeasure && entry.measure <= endMeasure)
    .map((entry) => ({
      ...entry,
      measure: entry.measure - measureOffset,
    }));
  if (!filteredBpmInfo.some((entry) =>
    entry.measure === 1 && entry.beat === 1 && entry.cell === 0)) {
    let activeBpm = chart.bpm_info[0];
    for (const entry of chart.bpm_info) {
      if (entry.measure < startMeasure
        || (entry.measure === startMeasure
          && (entry.beat < 1 || (entry.beat === 1 && entry.cell <= 0)))) {
        activeBpm = entry;
      } else {
        break;
      }
    }
    filteredBpmInfo.unshift({
      measure: 1,
      beat: 1,
      cell: 0,
      bpm: activeBpm.bpm,
    });
  }

  const filteredBeatInfo = chart.beat_info
    .filter((entry) =>
      entry.measure >= startMeasure && entry.measure <= endMeasure)
    .map((entry) => ({
      ...entry,
      measure: entry.measure - measureOffset,
    }));
  if (!filteredBeatInfo.some((entry) =>
    entry.measure === 1 && entry.beat === 1 && entry.cell === 0)) {
    let activeBeat = chart.beat_info[0];
    for (const entry of chart.beat_info) {
      if (entry.measure < startMeasure
        || (entry.measure === startMeasure
          && (entry.beat < 1 || (entry.beat === 1 && entry.cell <= 0)))) {
        activeBeat = entry;
      } else {
        break;
      }
    }
    filteredBeatInfo.unshift({
      measure: 1,
      beat: 1,
      cell: 0,
      numerator: activeBeat.numerator,
      denominator: activeBeat.denominator,
    });
  }

  const filteredHiSpeedMarks: HiSpeedMark[] = [];
  const rangeStartSeconds = fullLayout.timeMapper.secondsOf([
    startMeasure,
    1,
    0,
  ]);
  for (const mark of hiSpeedMarks) {
    const markStartSeconds = fullLayout.timeMapper.secondsOf(mark.time);
    const markEndSeconds = markStartSeconds + mark.durationMs / 1000;
    if (markEndSeconds < rangeStartSeconds) continue;

    if (mark.time[0] < startMeasure) {
      filteredHiSpeedMarks.push({
        ...mark,
        time: [1, 1, 0],
        durationMs: Math.max(
          0,
          (markEndSeconds - rangeStartSeconds) * 1000,
        ),
      });
    } else if (mark.time[0] <= endMeasure) {
      filteredHiSpeedMarks.push({
        ...mark,
        time: [mark.time[0] - measureOffset, mark.time[1], mark.time[2]],
      });
    }
  }

  const measureCount = endMeasure - startMeasure + 1;
  const exportChart: ChartData = {
    ...chart,
    tracks: filteredTracks,
    bpm_info: filteredBpmInfo,
    beat_info: filteredBeatInfo,
    end_position: { measure: measureCount + 1, beat: 1, cell: 0 },
  };
  const exportLayout = computeLayout(
    exportChart,
    renderOptions.pxPerSecond,
    renderOptions.columnHeight,
  );
  const spans = exportLayout.spans.filter(
    (span) => span.measure <= measureCount,
  );
  if (spans.length === 0) return;

  const minY = Math.min(...spans.map((span) => span.y0));
  const maxY = Math.max(...spans.map((span) => span.y1));
  const height = maxY - minY + 2 * MARGIN;
  const adjustedSpans = spans.map((span) => ({
    ...span,
    y0: span.y0 - minY + MARGIN,
    y1: span.y1 - minY + MARGIN,
  }));
  const maxColumn = Math.max(...spans.map((span) => span.col));
  const width = colXBase(maxColumn)
    + TRACK_WIDTH
    + GUTTER_WIDTH
    + MARGIN;
  const finalLayout: LayoutResult = {
    ...exportLayout,
    spans: adjustedSpans,
    canvasWidth: width,
    canvasHeight: height,
    columnHeight: height,
  };

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = "#080c18";
  context.fillRect(0, 0, width, height);
  for (const span of adjustedSpans) {
    const baseX = colXBase(span.col);
    const oobWidth = (TRACK_WIDTH - 96.5) / 2;
    const laneLeft = baseX + oobWidth;
    const laneWidth = 96.5;
    context.fillStyle = "rgba(8, 12, 24, 0.6)";
    context.fillRect(baseX, span.y0 - 2, oobWidth, span.y1 - span.y0 + 4);
    context.fillRect(
      laneLeft + laneWidth,
      span.y0 - 2,
      oobWidth,
      span.y1 - span.y0 + 4,
    );
    context.fillStyle = "#0a0e1a";
    context.fillRect(
      laneLeft,
      span.y0 - 2,
      laneWidth,
      span.y1 - span.y0 + 4,
    );
    context.strokeStyle = "rgba(255, 255, 255, 0.1)";
    context.lineWidth = 1;
    for (const x of [laneLeft, laneLeft + laneWidth]) {
      context.beginPath();
      context.moveTo(x, span.y0 - 2);
      context.lineTo(x, span.y1 + 2);
      context.stroke();
    }
  }

  if (filteredHiSpeedMarks.length > 0) {
    drawHiSpeedMarks(context, finalLayout, filteredHiSpeedMarks);
  }
  drawGridWithBpm(
    context,
    finalLayout,
    exportChart.bpm_info,
    speed,
    filteredHiSpeedMarks,
    bpmDisplayMode,
    measureOffset,
  );
  drawNotes(context, exportChart, finalLayout);
  drawLasers(
    context,
    exportChart,
    finalLayout,
    renderOptions.laserLColor,
    renderOptions.laserRColor,
  );
  downloadCanvas(
    canvas,
    `chart_measure_${startMeasure}-${endMeasure}.png`,
  );
}
