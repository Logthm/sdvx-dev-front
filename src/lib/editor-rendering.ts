import {
  colXBase,
  computeLayout,
  findSpanByMeasure,
  TRACK_WIDTH,
  yInMeasure,
  type LayoutResult,
} from "@/lib/chart-renderer/layout";
import { resolveEvent } from "@/lib/chart-renderer/laser-drawer";
import { noteX, TAIL_HEIGHT } from "@/lib/chart-renderer/note-drawer";
import type { ViewState } from "@/lib/chart-renderer/renderer";
import {
  HOLD_HEAD_WINDOW,
  HOLD_SUSTAIN_WINDOW,
  type HoldJudgementRun,
} from "@/lib/chart-renderer/hold-judgement";
import {
  DRAG_RANGE_BOUNDS,
  useEditorStore,
  type DragRange,
} from "@/lib/editor-store";
import type { ButtonEvent, ChartData, LaserEvent } from "@/types/chart";
import type { TimePosition } from "@/types/chart-domain";

export interface EditorRenderingInput {
  context: CanvasRenderingContext2D;
  chart: ChartData;
  view: ViewState;
  holdJudgements: readonly HoldJudgementRun[];
  transient: {
    selectedButtonPart: "body" | "tail";
    buttonDragOriginalSeconds?: number;
  };
}

const BUTTON_TRACKS = ["2", "3", "4", "5", "6", "7"] as const;
const MARKER_RGB = "120, 175, 255";

interface HoldWindowStyle {
  fill: string;
  stroke: string;
  point: string;
  dash: number[];
  lineWidth: number;
}

const HEAD_WINDOW_STYLE: HoldWindowStyle = {
  fill: "rgba(96, 165, 250, 0.22)",
  stroke: "rgba(96, 165, 250, 0.8)",
  point: "rgba(191, 219, 254, 0.95)",
  dash: [3, 3],
  lineWidth: 1,
};

const SUSTAIN_WINDOW_STYLE: HoldWindowStyle = {
  fill: "rgba(74, 222, 128, 0.18)",
  stroke: "rgba(74, 222, 128, 0.72)",
  point: "rgba(187, 247, 208, 0.95)",
  dash: [2, 2],
  lineWidth: 0.75,
};

const DRAG_RANGE_RGB: Record<Exclude<DragRange, "off">, string> = {
  "s-critical": "240, 200, 120",
  "critical": "190, 140, 50",
  "near": "74, 222, 128",
  "error": "248, 113, 113",
};

const DRAG_RANGE_DRAW_ORDER: Exclude<DragRange, "off">[] = [
  "error",
  "near",
  "critical",
  "s-critical",
];

function applyView(
  context: CanvasRenderingContext2D,
  view: ViewState,
) {
  context.save();
  context.translate(-view.panX * view.zoom, -view.panY * view.zoom);
  context.scale(view.zoom, view.zoom);
}

function drawNoteMarker(
  context: CanvasRenderingContext2D,
  x: number,
  width: number,
  centerY: number,
  alpha: number,
  lineWidth: number,
) {
  const pad = Math.min(3, width * 0.15);
  context.strokeStyle = `rgba(${MARKER_RGB}, ${alpha})`;
  context.lineWidth = lineWidth;
  context.beginPath();
  context.moveTo(x + pad, centerY);
  context.lineTo(x + width - pad, centerY);
  context.stroke();
}

function drawHoldWindow(
  context: CanvasRenderingContext2D,
  layout: LayoutResult,
  trackName: string,
  time: TimePosition,
  earlySeconds: number,
  lateSeconds: number,
  style: HoldWindowStyle,
) {
  const centerSeconds = layout.timeMapper.secondsOf(time);
  const windowStart = centerSeconds - earlySeconds;
  const windowEnd = centerSeconds + lateSeconds;

  for (const span of layout.spans) {
    const segmentStart = Math.max(windowStart, span.sec0);
    const segmentEnd = Math.min(windowEnd, span.sec1);
    if (segmentEnd <= segmentStart) continue;

    const geometry = noteX(span, trackName);
    if (!geometry) continue;
    const top = span.y1 - (segmentEnd - span.sec0) * layout.pxPerSecond;
    const bottom = span.y1 - (segmentStart - span.sec0) * layout.pxPerSecond;

    context.fillStyle = style.fill;
    context.fillRect(geometry.x, top, geometry.w, bottom - top);
    context.strokeStyle = style.stroke;
    context.lineWidth = style.lineWidth;
    context.setLineDash(style.dash);
    context.strokeRect(geometry.x, top, geometry.w, bottom - top);
  }

  const pointSpan = findSpanByMeasure(layout.spans, time[0]);
  const pointGeometry = pointSpan ? noteX(pointSpan, trackName) : null;
  if (!pointSpan || !pointGeometry) return;

  const y = yInMeasure(
    pointSpan,
    time,
    layout.timeMapper,
    layout.pxPerSecond,
  );
  context.setLineDash([]);
  context.strokeStyle = style.point;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(pointGeometry.x, y);
  context.lineTo(pointGeometry.x + pointGeometry.w, y);
  context.stroke();
}

function drawHoldJudgements(
  context: CanvasRenderingContext2D,
  layout: LayoutResult,
  runs: readonly HoldJudgementRun[],
) {
  for (const run of runs) {
    drawHoldWindow(
      context,
      layout,
      run.trackName,
      run.head,
      HOLD_HEAD_WINDOW.earlySeconds,
      HOLD_HEAD_WINDOW.lateSeconds,
      HEAD_WINDOW_STYLE,
    );
    for (const sustain of run.sustain) {
      drawHoldWindow(
        context,
        layout,
        run.trackName,
        sustain,
        HOLD_SUSTAIN_WINDOW.earlySeconds,
        HOLD_SUSTAIN_WINDOW.lateSeconds,
        SUSTAIN_WINDOW_STYLE,
      );
    }
  }
  context.setLineDash([]);
}

function noteKey(track: string, time: TimePosition): string {
  return `${track}:${time[0]},${time[1]},${time[2]}`;
}

function drawEditedButtonMarkers(
  context: CanvasRenderingContext2D,
  chart: ChartData,
  originalChart: ChartData,
  layout: LayoutResult,
) {
  const originalKeys = new Set<string>();
  const originalHoldLengths = new Map<string, number>();

  for (const track of BUTTON_TRACKS) {
    for (const event of originalChart.tracks[track] ?? []) {
      if (event.type !== "button") continue;
      const key = noteKey(track, event.time);
      originalKeys.add(key);
      originalHoldLengths.set(key, event.hold_len);
    }
  }

  for (const track of BUTTON_TRACKS) {
    for (const event of chart.tracks[track] ?? []) {
      if (event.type !== "button") continue;
      const key = noteKey(track, event.time);
      if (!originalKeys.has(key)) {
        const span = findSpanByMeasure(layout.spans, event.time[0]);
        const geometry = span ? noteX(span, event.track_name) : null;
        if (span && geometry) {
          const y = yInMeasure(
            span,
            event.time,
            layout.timeMapper,
            layout.pxPerSecond,
          );
          drawNoteMarker(context, geometry.x, geometry.w, y, 0.8, 1);
        }
      }

      if (event.hold_len <= 0) continue;
      const originalLength = originalHoldLengths.get(key);
      if (originalLength !== undefined && originalLength === event.hold_len) {
        continue;
      }

      const endTime = layout.timeMapper.advanceUnits(event.time, event.hold_len);
      const span = findSpanByMeasure(layout.spans, endTime[0]);
      const geometry = span ? noteX(span, event.track_name) : null;
      if (span && geometry) {
        const y = yInMeasure(
          span,
          endTime,
          layout.timeMapper,
          layout.pxPerSecond,
        );
        drawNoteMarker(
          context,
          geometry.x,
          geometry.w,
          y + TAIL_HEIGHT / 2,
          0.8,
          1,
        );
      }
    }
  }
}

function drawLaserPoints(
  context: CanvasRenderingContext2D,
  chart: ChartData,
  layout: LayoutResult,
) {
  for (const [track, color] of [["1", "#0082D9"], ["8", "#BC0088"]] as const) {
    const events = (chart.tracks[track] ?? []).filter(
      (event): event is LaserEvent => event.type === "laser",
    );
    for (const event of events) {
      const point = resolveEvent(
        event,
        layout.timeMapper,
        layout.spans,
        layout.pxPerSecond,
      );
      if (!point) continue;
      context.beginPath();
      context.arc(point.x, point.y, 2.5, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
    }
  }
}

function originalButtonSeconds(
  chart: ChartData,
  originalChart: ChartData | null,
  layout: LayoutResult,
  track: string,
  index: number,
  event: ButtonEvent,
): number {
  const originalTrack = originalChart?.tracks[track];
  const editedTrack = chart.tracks[track];
  const originalEvent = originalTrack?.length === editedTrack?.length
    ? originalTrack[index]
    : undefined;
  return layout.timeMapper.secondsOf(
    originalEvent?.type === "button" ? originalEvent.time : event.time,
  );
}

function drawDragRanges(
  context: CanvasRenderingContext2D,
  layout: LayoutResult,
  geometry: { x: number; w: number },
  span: LayoutResult["spans"][number],
  originalSeconds: number,
  dragRange: DragRange,
) {
  const originalY = span.y1
    - (originalSeconds - span.sec0) * layout.pxPerSecond;
  const bandX = geometry.x - 4;
  const bandWidth = geometry.w + 8;
  const order = [
    ...DRAG_RANGE_DRAW_ORDER.filter((range) => range !== dragRange),
    ...DRAG_RANGE_DRAW_ORDER.filter((range) => range === dragRange),
  ];

  for (const range of order) {
    const bounds = DRAG_RANGE_BOUNDS[range];
    const rgb = DRAG_RANGE_RGB[range];
    const active = range === dragRange;
    const top = originalY - (bounds.late / 1000) * layout.pxPerSecond;
    const bottom = originalY + (bounds.early / 1000) * layout.pxPerSecond;

    context.fillStyle = `rgba(${rgb}, ${active ? 0.22 : 0.08})`;
    context.fillRect(bandX, top, bandWidth, bottom - top);
    context.strokeStyle = `rgba(${rgb}, ${active ? 0.9 : 0.35})`;
    context.lineWidth = active ? 1.5 : 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(bandX, top);
    context.lineTo(bandX + bandWidth, top);
    context.moveTo(bandX, bottom);
    context.lineTo(bandX + bandWidth, bottom);
    context.stroke();
    context.setLineDash([]);
  }
}

function drawSelection(
  input: EditorRenderingInput,
  layout: LayoutResult,
) {
  const { context, chart, transient } = input;
  const store = useEditorStore.getState();
  const selection = store.selectedPoint;
  if (!selection) return;

  if (selection.type === "laser" && store.editFlags.simplifyLasers) {
    const events = (chart.tracks[selection.track] ?? []).filter(
      (event): event is LaserEvent => event.type === "laser",
    );
    const event = events[selection.index];
    if (!event) return;
    const point = resolveEvent(
      event,
      layout.timeMapper,
      layout.spans,
      layout.pxPerSecond,
    );
    if (!point) return;
    context.beginPath();
    context.arc(point.x, point.y, 10, 0, Math.PI * 2);
    context.strokeStyle = "oklch(0.72 0.155 70)";
    context.lineWidth = 1;
    context.stroke();
    return;
  }

  if (selection.type === "button") {
    const events = (chart.tracks[selection.track] ?? []).filter(
      (event): event is ButtonEvent => event.type === "button",
    );
    const event = events[selection.index];
    if (!event) return;
    const span = findSpanByMeasure(layout.spans, event.time[0]);
    const geometry = span ? noteX(span, event.track_name) : null;
    if (!span || !geometry) return;

    if (store.mouseTool === "move") {
      const originalSeconds = transient.buttonDragOriginalSeconds
        ?? originalButtonSeconds(
          chart,
          store.originalChartData,
          layout,
          selection.track,
          selection.index,
          event,
        );
      drawDragRanges(
        context,
        layout,
        geometry,
        span,
        originalSeconds,
        store.dragRange,
      );
    }

    if (transient.selectedButtonPart === "tail" && event.hold_len > 0) {
      const endTime = layout.timeMapper.advanceUnits(event.time, event.hold_len);
      const tailSpan = findSpanByMeasure(layout.spans, endTime[0]);
      const tailGeometry = tailSpan ? noteX(tailSpan, event.track_name) : null;
      if (tailSpan && tailGeometry) {
        const y = yInMeasure(
          tailSpan,
          endTime,
          layout.timeMapper,
          layout.pxPerSecond,
        );
        drawNoteMarker(
          context,
          tailGeometry.x,
          tailGeometry.w,
          y + TAIL_HEIGHT / 2,
          1,
          1.5,
        );
      }
      return;
    }

    const y = yInMeasure(
      span,
      event.time,
      layout.timeMapper,
      layout.pxPerSecond,
    );
    drawNoteMarker(context, geometry.x, geometry.w, y, 1, 1.5);
    return;
  }

  const mark = store.hiSpeedMarks[selection.index];
  if (!mark) return;
  const markSeconds = layout.timeMapper.secondsOf(mark.time);
  for (const span of layout.spans) {
    if (markSeconds < span.sec0 || markSeconds >= span.sec1) continue;
    const trackLeft = colXBase(span.col);
    const y = span.y1 - (markSeconds - span.sec0) * layout.pxPerSecond;
    context.strokeStyle = "#fff";
    context.lineWidth = 2;
    context.strokeRect(trackLeft - 2, y - 4, TRACK_WIDTH + 4, 8);
  }
}

export function renderEditorOverlays(input: EditorRenderingInput): void {
  const { context, chart, view } = input;
  const store = useEditorStore.getState();
  const layout = computeLayout(
    chart,
    store.renderOptions.pxPerSecond,
    store.renderOptions.columnHeight,
  );

  if (store.showHoldJudgement) {
    applyView(context, view);
    drawHoldJudgements(context, layout, input.holdJudgements);
    context.restore();
  }

  if (store.originalChartData) {
    applyView(context, view);
    drawEditedButtonMarkers(
      context,
      chart,
      store.originalChartData,
      layout,
    );
    context.restore();
  }

  if (store.editFlags.simplifyLasers) {
    applyView(context, view);
    drawLaserPoints(context, chart, layout);
    context.restore();
  }

  if (store.selectedPoint) {
    applyView(context, view);
    drawSelection(input, layout);
    context.restore();
  }
}
