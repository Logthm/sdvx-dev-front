import {
  colXBase,
  findSpanBySec,
  findSpanByMeasure,
  findSpanByYInCol,
  lanLeftX,
  TRACK_WIDTH,
  xToLaserOffset,
  yToSec,
  yInMeasure,
  type LayoutResult,
} from "@/lib/chart-renderer/layout";
import { CHIP_HEIGHT, noteX } from "@/lib/chart-renderer/note-drawer";
import { resolveEvent } from "@/lib/chart-renderer/laser-drawer";
import { calculateInterval } from "@/lib/chart-edit";
import { clampDragSec, useEditorStore } from "@/lib/editor-store";
import type { ButtonEvent, ChartData, LaserEvent } from "@/types/chart";
import type { TimePosition } from "@/types/chart-domain";

const BUTTON_TRACKS = ["3", "4", "5", "6", "2", "7"] as const;
const LASER_TRACKS = ["1", "8"] as const;

export const MIN_CHART_ZOOM = 0.2;
export const MAX_CHART_ZOOM = 3;

export type ChartHiSpeedRequest =
  | { type: "add"; time: TimePosition }
  | { type: "edit"; index: number };

export interface ChartInteractionInput {
  point: { x: number; y: number };
  pointer: { type: "mouse" | "pen" | "touch"; zoom: number };
  tool: "move" | "edit-hs";
  simplifyLasers: boolean;
  chart: ChartData;
  layout: LayoutResult;
  hiSpeedMarks: readonly { time: TimePosition }[];
}

export type ChartInteractionTarget =
  | {
      type: "laser";
      track: (typeof LASER_TRACKS)[number];
      index: number;
      col: number;
    }
  | {
      type: "button";
      track: (typeof BUTTON_TRACKS)[number];
      index: number;
      col: number;
    }
  | {
      type: "hold-tail";
      track: (typeof BUTTON_TRACKS)[number];
      index: number;
      col: number;
    }
  | { type: "hispeed-text"; index: number; col: number }
  | { type: "hispeed-line"; index: number; col: number }
  | { type: "canvas" };

type HitTarget = Exclude<ChartInteractionTarget, { type: "canvas" }>;

function hitLaser(
  input: ChartInteractionInput,
  margin: number,
): Extract<HitTarget, { type: "laser" }> | null {
  if (!input.simplifyLasers) return null;

  const hitRadius = 10 + margin;
  let closest: (Extract<HitTarget, { type: "laser" }> & {
    distance: number;
  }) | null = null;

  for (const track of LASER_TRACKS) {
    const events = (input.chart.tracks[track] ?? []).filter(
      (event): event is LaserEvent => event.type === "laser",
    );
    for (let index = 0; index < events.length; index++) {
      const resolved = resolveEvent(
        events[index],
        input.layout.timeMapper,
        input.layout.spans,
        input.layout.pxPerSecond,
      );
      if (!resolved) continue;

      const distance = Math.hypot(
        input.point.x - resolved.x,
        input.point.y - resolved.y,
      );
      if (
        distance <= hitRadius
        && (!closest || distance < closest.distance)
      ) {
        closest = {
          type: "laser",
          track,
          index,
          col: resolved.col,
          distance,
        };
      }
    }
  }

  if (!closest) return null;
  return {
    type: "laser",
    track: closest.track,
    index: closest.index,
    col: closest.col,
  };
}

function hitButton(
  input: ChartInteractionInput,
  margin: number,
): Extract<HitTarget, { type: "button" }> | null {
  for (const track of BUTTON_TRACKS) {
    const events = input.chart.tracks[track] ?? [];
    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      if (event.type !== "button") continue;

      const span = findSpanByMeasure(input.layout.spans, event.time[0]);
      if (!span) continue;

      const geometry = noteX(span, event.track_name);
      if (!geometry) continue;

      const y = yInMeasure(
        span,
        event.time,
        input.layout.timeMapper,
        input.layout.pxPerSecond,
      );
      if (
        input.point.x >= geometry.x
        && input.point.x <= geometry.x + geometry.w
        && input.point.y >= y - CHIP_HEIGHT / 2 - margin
        && input.point.y <= y + CHIP_HEIGHT / 2 + margin
      ) {
        return { type: "button", track, index, col: span.col };
      }
    }
  }
  return null;
}

function hitHoldTail(
  input: ChartInteractionInput,
  margin: number,
): Extract<HitTarget, { type: "hold-tail" }> | null {
  for (const track of BUTTON_TRACKS) {
    const events = input.chart.tracks[track] ?? [];
    for (let index = 0; index < events.length; index++) {
      const event = events[index];
      if (event.type !== "button" || event.hold_len <= 0) continue;

      const endTime = input.layout.timeMapper.advanceUnits(
        event.time,
        event.hold_len,
      );
      const span = findSpanByMeasure(input.layout.spans, endTime[0]);
      if (!span) continue;

      const geometry = noteX(span, event.track_name);
      if (!geometry) continue;

      const y = yInMeasure(
        span,
        endTime,
        input.layout.timeMapper,
        input.layout.pxPerSecond,
      );
      if (
        input.point.x >= geometry.x
        && input.point.x <= geometry.x + geometry.w
        && input.point.y >= y - margin
        && input.point.y <= y + margin
      ) {
        return { type: "hold-tail", track, index, col: span.col };
      }
    }
  }
  return null;
}

function hitHiSpeedText(
  input: ChartInteractionInput,
): Extract<HitTarget, { type: "hispeed-text" }> | null {
  for (let index = 0; index < input.hiSpeedMarks.length; index++) {
    const markSec = input.layout.timeMapper.secondsOf(
      input.hiSpeedMarks[index].time,
    );
    for (const span of input.layout.spans) {
      if (markSec < span.sec0 || markSec >= span.sec1) continue;

      const trackLeft = colXBase(span.col);
      const y = span.y1 - (markSec - span.sec0) * input.layout.pxPerSecond;
      if (
        input.point.x >= trackLeft - 84
        && input.point.x <= trackLeft - 4
        && input.point.y >= y - 22
        && input.point.y <= y + 2
      ) {
        return { type: "hispeed-text", index, col: span.col };
      }
    }
  }
  return null;
}

function hitHiSpeedLine(
  input: ChartInteractionInput,
  margin: number,
): Extract<HitTarget, { type: "hispeed-line" }> | null {
  for (let index = 0; index < input.hiSpeedMarks.length; index++) {
    const markSec = input.layout.timeMapper.secondsOf(
      input.hiSpeedMarks[index].time,
    );
    for (const span of input.layout.spans) {
      if (markSec < span.sec0 || markSec >= span.sec1) continue;

      const trackLeft = colXBase(span.col);
      const y = span.y1 - (markSec - span.sec0) * input.layout.pxPerSecond;
      if (
        input.point.x >= trackLeft - 30
        && input.point.x <= trackLeft + TRACK_WIDTH + 30
        && input.point.y >= y - margin
        && input.point.y <= y + margin
      ) {
        return { type: "hispeed-line", index, col: span.col };
      }
    }
  }
  return null;
}

export function findChartInteractionTarget(
  input: ChartInteractionInput,
): ChartInteractionTarget {
  const isTouch = input.pointer.type === "touch";
  const touchMargin = isTouch ? 30 / input.pointer.zoom : 0;
  if (input.tool === "move") {
    const laser = hitLaser(input, touchMargin);
    if (laser) return laser;
  }

  return hitButton(input, touchMargin)
    ?? (input.tool === "move"
      ? hitHoldTail(input, isTouch ? touchMargin : 6)
      : null)
    ?? hitHiSpeedText(input)
    ?? hitHiSpeedLine(input, isTouch ? touchMargin : 6)
    ?? { type: "canvas" };
}

export type ChartInteractionSessionEvent =
  | { type: "pointer-down"; input: ChartInteractionInput }
  | { type: "pointer-move"; point: { x: number; y: number } }
  | { type: "pointer-up" }
  | { type: "pointer-cancel" };

export type ChartInteractionSessionResult = {
  handled: boolean;
  target: ChartInteractionTarget | null;
};

export type ActiveChartInteractionSession = {
  type: "button";
  target: Extract<ChartInteractionTarget, { type: "button" }>;
  originalSeconds: number;
} | {
  type: "laser";
  target: Extract<ChartInteractionTarget, { type: "laser" }>;
  originalSeconds: number;
  originalOffset: number;
} | {
  type: "hold-tail";
  target: Extract<ChartInteractionTarget, { type: "hold-tail" }>;
} | {
  type: "hispeed";
  target: Extract<
    ChartInteractionTarget,
    { type: "hispeed-text" } | { type: "hispeed-line" }
  >;
};

type ButtonDragSession = Extract<ActiveChartInteractionSession, { type: "button" }> & {
  layout: LayoutResult;
  originalTime: TimePosition;
  originalHoldLength: number;
};

type LaserDragSession = Extract<ActiveChartInteractionSession, { type: "laser" }> & {
  layout: LayoutResult;
  isOutOfBounds: boolean;
};

type HoldTailDragSession = Extract<ActiveChartInteractionSession, { type: "hold-tail" }> & {
  layout: LayoutResult;
  startTime: TimePosition;
};

type HiSpeedDragSession = Extract<ActiveChartInteractionSession, { type: "hispeed" }> & {
  layout: LayoutResult;
};

function timeAtSeconds(
  seconds: number,
  layout: LayoutResult,
  fallbackMeasure: number,
): TimePosition {
  const span = findSpanBySec(layout.spans, seconds);
  return layout.timeMapper.secToTime3(
    seconds,
    span?.measure ?? fallbackMeasure,
  );
}

function beginButtonDrag(
  input: ChartInteractionInput,
  target: Extract<ChartInteractionTarget, { type: "button" }>,
): ButtonDragSession {
  const store = useEditorStore.getState();
  const event = (input.chart.tracks[target.track] ?? [])[target.index] as ButtonEvent;
  const originalTrack = store.originalChartData?.tracks[target.track];
  const editedTrack = input.chart.tracks[target.track];
  const originalEvent = originalTrack?.length === editedTrack?.length
    ? originalTrack[target.index]
    : undefined;
  const originalTime = originalEvent?.type === "button"
    ? originalEvent.time
    : event.time;
  const originalSeconds = input.layout.timeMapper.secondsOf(originalTime);

  const first = store.firstSelectedNote;
  if (first && (first.track !== target.track || first.index !== target.index)) {
    const firstEvent = (input.chart.tracks[first.track] ?? [])[first.index];
    if (firstEvent) {
      store.setIntervalInfo(calculateInterval(
        firstEvent.time,
        event.time,
        input.layout.timeMapper,
        input.chart.beat_resolution ?? null,
      ));
    }
    store.setFirstSelectedNote(null);
  } else if (!first) {
    store.setFirstSelectedNote({
      type: "button",
      track: target.track,
      index: target.index,
    });
    store.setIntervalInfo(null);
  }

  store.pushHistory();
  store.setSelectedPoint({
    type: "button",
    track: target.track,
    index: target.index,
  });

  return {
    type: "button",
    target,
    layout: input.layout,
    originalTime,
    originalSeconds,
    originalHoldLength: event.hold_len ?? 0,
  };
}

function beginLaserDrag(
  input: ChartInteractionInput,
  target: Extract<ChartInteractionTarget, { type: "laser" }>,
): LaserDragSession {
  const store = useEditorStore.getState();
  const event = (input.chart.tracks[target.track] ?? [])[target.index] as LaserEvent;
  const originalSeconds = input.layout.timeMapper.secondsOf(event.time);

  const first = store.firstSelectedNote;
  if (first && (first.track !== target.track || first.index !== target.index)) {
    const firstEvent = (input.chart.tracks[first.track] ?? [])[first.index];
    if (firstEvent) {
      store.setIntervalInfo(calculateInterval(
        firstEvent.time,
        event.time,
        input.layout.timeMapper,
        input.chart.beat_resolution ?? null,
      ));
    }
    store.setFirstSelectedNote(null);
  } else if (!first) {
    store.setFirstSelectedNote({
      type: "laser",
      track: target.track,
      index: target.index,
    });
    store.setIntervalInfo(null);
  }

  store.pushHistory();
  store.setSelectedPoint({
    type: "laser",
    track: target.track,
    index: target.index,
  });

  return {
    type: "laser",
    target,
    layout: input.layout,
    originalSeconds,
    originalOffset: event.offset,
    isOutOfBounds: event.is_out_of_bounds,
  };
}

function beginHoldTailDrag(
  input: ChartInteractionInput,
  target: Extract<ChartInteractionTarget, { type: "hold-tail" }>,
): HoldTailDragSession {
  const store = useEditorStore.getState();
  const event = (input.chart.tracks[target.track] ?? [])[target.index] as ButtonEvent;
  store.pushHistory();
  store.setSelectedPoint({
    type: "button",
    track: target.track,
    index: target.index,
  });
  return {
    type: "hold-tail",
    target,
    layout: input.layout,
    startTime: event.time,
  };
}

function beginHiSpeedDrag(
  input: ChartInteractionInput,
  target: Extract<
    ChartInteractionTarget,
    { type: "hispeed-text" } | { type: "hispeed-line" }
  >,
): HiSpeedDragSession {
  const store = useEditorStore.getState();
  store.pushHistory();
  store.setSelectedPoint({ type: "hispeed", index: target.index });
  return {
    type: "hispeed",
    target,
    layout: input.layout,
  };
}

export function createChartInteractionSession() {
  let active:
    | ButtonDragSession
    | LaserDragSession
    | HoldTailDragSession
    | HiSpeedDragSession
    | null = null;

  return {
    handle(event: ChartInteractionSessionEvent): ChartInteractionSessionResult {
      if (event.type === "pointer-up" || event.type === "pointer-cancel") {
        const handled = active !== null;
        active = null;
        return { handled, target: null };
      }

      if (event.type === "pointer-down") {
        const target = findChartInteractionTarget(event.input);
        if (
          event.input.tool !== "move"
          || (
            target.type !== "button"
            && target.type !== "laser"
            && target.type !== "hold-tail"
            && target.type !== "hispeed-text"
            && target.type !== "hispeed-line"
          )
        ) {
          return { handled: false, target };
        }

        if (target.type === "button") {
          active = beginButtonDrag(event.input, target);
        } else if (target.type === "laser") {
          active = beginLaserDrag(event.input, target);
        } else if (target.type === "hold-tail") {
          active = beginHoldTailDrag(event.input, target);
        } else {
          active = beginHiSpeedDrag(event.input, target);
        }
        return { handled: true, target };
      }

      if (!active) return { handled: false, target: null };

      if (active.type === "laser") {
        const span = findSpanByYInCol(
          active.layout.spans,
          event.point.y,
          active.target.col,
        );
        if (!span) return { handled: true, target: active.target };

        const store = useEditorStore.getState();
        const seconds = yToSec(event.point.y, span, active.layout.pxPerSecond);
        const newTime = timeAtSeconds(seconds, active.layout, span.measure);
        const newOffset = xToLaserOffset(
          event.point.x,
          lanLeftX(active.target.col),
          active.isOutOfBounds,
        );
        store.updateLaserPoint(
          active.target.track,
          active.target.index,
          newTime,
          newOffset,
        );
        return { handled: true, target: active.target };
      }

      if (active.type === "hold-tail") {
        const span = findSpanByYInCol(
          active.layout.spans,
          event.point.y,
          active.target.col,
        );
        if (!span) return { handled: true, target: active.target };

        const seconds = yToSec(event.point.y, span, active.layout.pxPerSecond);
        const endTime = timeAtSeconds(seconds, active.layout, span.measure);
        const units = active.layout.timeMapper.unitsBetween(
          active.startTime,
          endTime,
        );
        if (units > 0) {
          useEditorStore.getState().updateButtonHoldLen(
            active.target.track,
            active.target.index,
            units,
          );
        }
        return { handled: true, target: active.target };
      }

      if (active.type === "hispeed") {
        const span = findSpanByYInCol(
          active.layout.spans,
          event.point.y,
          active.target.col,
        );
        if (!span) return { handled: true, target: active.target };

        const seconds = yToSec(event.point.y, span, active.layout.pxPerSecond);
        const newTime = timeAtSeconds(seconds, active.layout, span.measure);
        useEditorStore.getState().updateHiSpeedMarkTime(
          active.target.index,
          newTime,
        );
        return { handled: true, target: active.target };
      }

      const span = findSpanByYInCol(
        active.layout.spans,
        event.point.y,
        active.target.col,
      );
      if (!span) return { handled: true, target: active.target };

      const store = useEditorStore.getState();
      const seconds = clampDragSec(
        yToSec(event.point.y, span, active.layout.pxPerSecond),
        active.originalSeconds,
        store.dragRange,
      );
      const newTime = timeAtSeconds(seconds, active.layout, span.measure);
      store.updateButtonTime(
        active.target.track,
        active.target.index,
        newTime,
      );

      if (active.originalHoldLength > 0) {
        const delta = active.layout.timeMapper.unitsBetween(
          active.originalTime,
          newTime,
        );
        const newLength = active.originalHoldLength - delta;
        if (newLength > 0) {
          useEditorStore.getState().updateButtonHoldLen(
            active.target.track,
            active.target.index,
            newLength,
          );
        }
      }

      return { handled: true, target: active.target };
    },

    getActive(): ActiveChartInteractionSession | null {
      if (!active) return null;
      if (active.type === "laser") {
        return {
          type: "laser",
          target: active.target,
          originalSeconds: active.originalSeconds,
          originalOffset: active.originalOffset,
        };
      }
      if (active.type === "hold-tail") {
        return {
          type: "hold-tail",
          target: active.target,
        };
      }
      if (active.type === "hispeed") {
        return {
          type: "hispeed",
          target: active.target,
        };
      }
      return {
        type: "button",
        target: active.target,
        originalSeconds: active.originalSeconds,
      };
    },
  };
}

export type ChartViewportGestureEvent =
  | {
      type: "pointer-down";
      pointerId: number;
      point: { x: number; y: number };
      mode: "interaction" | "pan";
    }
  | {
      type: "pointer-move";
      pointerId: number;
      point: { x: number; y: number };
    }
  | { type: "pointer-up"; pointerId: number }
  | { type: "pointer-cancel"; pointerId: number };

export type ChartViewportGestureResult =
  | { type: "none" }
  | { type: "start-interaction" }
  | { type: "start-pan" }
  | { type: "interaction" }
  | { type: "cancel-interaction" }
  | { type: "end-interaction"; cancelled: boolean }
  | { type: "pan"; delta: { x: number; y: number } }
  | {
      type: "pinch";
      center: { x: number; y: number };
      translation: { x: number; y: number };
      scale: number;
    };

export function createChartViewportGestureSession() {
  const pointers = new Map<number, { x: number; y: number }>();
  let primaryPointerId: number | null = null;
  let primaryMode: "interaction" | "pan" | null = null;
  let primaryPoint = { x: 0, y: 0 };
  let multiPointer = false;
  let pinch: { x: number; y: number; distance: number } | null = null;

  return {
    handle(event: ChartViewportGestureEvent): ChartViewportGestureResult {
      if (event.type === "pointer-down") {
        pointers.set(event.pointerId, event.point);
        if (pointers.size === 1) {
          primaryPointerId = event.pointerId;
          primaryMode = event.mode;
          primaryPoint = event.point;
          return event.mode === "pan"
            ? { type: "start-pan" }
            : { type: "start-interaction" };
        }

        if (pointers.size === 2) {
          multiPointer = true;
          const [first, second] = [...pointers.values()];
          pinch = {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
            distance: Math.hypot(second.x - first.x, second.y - first.y),
          };
          const shouldCancelInteraction = primaryMode === "interaction";
          primaryMode = null;
          return shouldCancelInteraction
            ? { type: "cancel-interaction" }
            : { type: "none" };
        }

        return { type: "none" };
      }

      if (!pointers.has(event.pointerId)) {
        return { type: "none" };
      }

      if (event.type === "pointer-move") {
        pointers.set(event.pointerId, event.point);
        if (multiPointer) {
          if (pointers.size !== 2 || !pinch) return { type: "none" };
          const [first, second] = [...pointers.values()];
          const center = {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
          };
          const distance = Math.hypot(
            second.x - first.x,
            second.y - first.y,
          );
          const result: ChartViewportGestureResult = {
            type: "pinch",
            center,
            translation: {
              x: center.x - pinch.x,
              y: center.y - pinch.y,
            },
            scale: pinch.distance > 0 ? distance / pinch.distance : 1,
          };
          pinch = { ...center, distance };
          return result;
        }

        if (primaryPointerId !== event.pointerId) return { type: "none" };
        const delta = {
          x: event.point.x - primaryPoint.x,
          y: event.point.y - primaryPoint.y,
        };
        primaryPoint = event.point;
        if (primaryMode === "pan") return { type: "pan", delta };
        return primaryMode === "interaction"
          ? { type: "interaction" }
          : { type: "none" };
      }

      pointers.delete(event.pointerId);
      if (multiPointer) {
        if (pointers.size === 0) {
          multiPointer = false;
          pinch = null;
          primaryPointerId = null;
          primaryMode = null;
        }
        return { type: "none" };
      }

      if (primaryPointerId !== event.pointerId) return { type: "none" };
      const wasInteraction = primaryMode === "interaction";
      primaryPointerId = null;
      primaryMode = null;
      return wasInteraction
        ? {
            type: "end-interaction",
            cancelled: event.type === "pointer-cancel",
          }
        : { type: "none" };
    },
  };
}
