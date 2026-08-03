import {
  computeLayout,
  findSpanAtPoint,
  xToTrackName,
  yToSec,
} from "@/lib/chart-renderer/layout";
import { useEditorStore } from "@/lib/editor-store";
import type { ButtonEvent } from "@/types/chart";
import {
  MAX_CHART_ZOOM,
  MIN_CHART_ZOOM,
  createChartInteractionSession,
  createChartViewportGestureSession,
  findChartInteractionTarget,
  type ChartHiSpeedRequest,
} from "@/lib/chart-interaction";
import {
  useCallback,
  useEffect,
  useRef,
  type RefObject,
} from "react";

interface UseChartInteractionInput {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  clampPan: (x: number, y: number, zoom: number) => void;
  onHiSpeedRequest: (request: ChartHiSpeedRequest) => void;
}

export interface ChartInteractionRenderingTransient {
  selectedButtonPart: "body" | "tail";
  buttonDragOriginalSeconds?: number;
}

export function useChartInteraction({
  containerRef,
  canvasRef,
  clampPan,
  onHiSpeedRequest,
}: UseChartInteractionInput) {
  const chartSessionRef = useRef(createChartInteractionSession());
  const viewportSessionRef = useRef(createChartViewportGestureSession());
  const tailSelectedRef = useRef(false);
  const clampPanRef = useRef(clampPan);
  const hiSpeedRequestRef = useRef(onHiSpeedRequest);
  clampPanRef.current = clampPan;
  hiSpeedRequestRef.current = onHiSpeedRequest;

  const clientToChart = useCallback((clientX: number, clientY: number) => {
    const element = canvasRef.current ?? containerRef.current;
    if (!element) return { x: 0, y: 0 };
    const rect = element.getBoundingClientRect();
    const store = useEditorStore.getState();
    return {
      x: store.panX + (clientX - rect.left) / store.zoom,
      y: store.panY + (clientY - rect.top) / store.zoom,
    };
  }, [canvasRef, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const store = useEditorStore.getState();
      if (event.ctrlKey || event.metaKey) {
        const rect = container!.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;
        const delta = event.deltaY > 0 ? -0.1 : 0.1;
        const nextZoom = Math.max(
          MIN_CHART_ZOOM,
          Math.min(MAX_CHART_ZOOM, store.zoom + delta),
        );
        const chartX = store.panX + cursorX / store.zoom;
        const chartY = store.panY + cursorY / store.zoom;
        store.setZoom(nextZoom);
        clampPanRef.current(
          chartX - cursorX / nextZoom,
          chartY - cursorY / nextZoom,
          nextZoom,
        );
      } else if (event.shiftKey) {
        clampPanRef.current(
          store.panX,
          store.panY + event.deltaY / store.zoom,
          store.zoom,
        );
      } else {
        clampPanRef.current(
          store.panX + event.deltaY / store.zoom,
          store.panY,
          store.zoom,
        );
      }
    }

    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      if (event.button !== 0 && event.button !== 1) return;
      if (event.target !== canvasRef.current) return;
      event.preventDefault();
      container!.setPointerCapture(event.pointerId);

      const store = useEditorStore.getState();
      const viewportGesture = viewportSessionRef.current.handle({
        type: "pointer-down",
        pointerId: event.pointerId,
        point: { x: event.clientX, y: event.clientY },
        mode: event.button === 1
          || store.mode !== "edit"
          || store.mouseTool === "pan"
          ? "pan"
          : "interaction",
      });
      if (viewportGesture.type === "cancel-interaction") {
        chartSessionRef.current.handle({ type: "pointer-cancel" });
        return;
      }
      if (viewportGesture.type !== "start-interaction") return;

      const point = clientToChart(event.clientX, event.clientY);
      if (store.mode !== "edit" || event.button !== 0) return;

      if (store.mouseTool === "move") {
        const chart = store.chartData;
        if (!chart) return;
        const layout = computeLayout(
          chart,
          store.renderOptions.pxPerSecond,
          store.renderOptions.columnHeight,
        );
        const interaction = chartSessionRef.current.handle({
          type: "pointer-down",
          input: {
            point,
            pointer: {
              type: event.pointerType === "pen" ? "pen" : "mouse",
              zoom: store.zoom,
            },
            tool: "move",
            simplifyLasers: store.editFlags.simplifyLasers,
            chart,
            layout,
            hiSpeedMarks: store.hiSpeedMarks,
          },
        });
        if (interaction.handled) {
          tailSelectedRef.current = interaction.target?.type === "hold-tail";
        } else {
          store.clearSelectedPoint();
          store.setFirstSelectedNote(null);
          store.setIntervalInfo(null);
        }
        return;
      }

      if (store.mouseTool === "edit-hs") {
        const chart = store.chartData;
        if (!chart) return;
        const layout = computeLayout(
          chart,
          store.renderOptions.pxPerSecond,
          store.renderOptions.columnHeight,
        );
        const target = findChartInteractionTarget({
          point,
          pointer: {
            type: event.pointerType === "pen" ? "pen" : "mouse",
            zoom: store.zoom,
          },
          tool: "edit-hs",
          simplifyLasers: store.editFlags.simplifyLasers,
          chart,
          layout,
          hiSpeedMarks: store.hiSpeedMarks,
        });
        if (target.type === "button") {
          const button = (chart.tracks[target.track] ?? [])[target.index] as ButtonEvent;
          store.pushHistory();
          if (button.hold_len > 0) {
            store.updateButtonHoldLen(target.track, target.index, 0);
          } else {
            const [numerator, denominator] =
              layout.timeMapper.getTimeSigAt(button.time);
            const unitsPerBeat = chart.beat_resolution ?? (192 / denominator);
            store.updateButtonHoldLen(
              target.track,
              target.index,
              Math.round(numerator * unitsPerBeat / 8),
            );
          }
        } else if (
          target.type === "hispeed-text"
          || target.type === "hispeed-line"
        ) {
          hiSpeedRequestRef.current({ type: "edit", index: target.index });
        }
        return;
      }

      if (store.mouseTool === "add-bt" || store.mouseTool === "add-fx") {
        const chart = store.chartData;
        if (!chart) return;
        const layout = computeLayout(
          chart,
          store.renderOptions.pxPerSecond,
          store.renderOptions.columnHeight,
        );
        const span = findSpanAtPoint(layout.spans, point.x, point.y);
        if (!span) return;
        const lane = xToTrackName(
          point.x,
          span.col,
          store.mouseTool === "add-fx",
        );
        if (!lane) return;
        const isBt = lane.trackName.startsWith("BT-");
        const isFx = lane.trackName.startsWith("FX-");
        if ((store.mouseTool === "add-bt" && !isBt)
          || (store.mouseTool === "add-fx" && !isFx)) {
          return;
        }
        const seconds = yToSec(point.y, span, layout.pxPerSecond);
        store.addButton(lane.trackNum, {
          type: "button",
          track_name: lane.trackName,
          time: layout.timeMapper.secToTime3(seconds, span.measure),
          hold_len: 0,
        });
        return;
      }

      if (store.mouseTool === "add-hispeed") {
        const chart = store.chartData;
        if (!chart) return;
        const layout = computeLayout(
          chart,
          store.renderOptions.pxPerSecond,
          store.renderOptions.columnHeight,
        );
        const span = findSpanAtPoint(layout.spans, point.x, point.y);
        if (!span) return;
        const seconds = yToSec(point.y, span, layout.pxPerSecond);
        hiSpeedRequestRef.current({
          type: "add",
          time: layout.timeMapper.secToTime3(seconds, span.measure),
        });
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      const viewportGesture = viewportSessionRef.current.handle({
        type: "pointer-move",
        pointerId: event.pointerId,
        point: { x: event.clientX, y: event.clientY },
      });
      if (viewportGesture.type === "interaction") {
        chartSessionRef.current.handle({
          type: "pointer-move",
          point: clientToChart(event.clientX, event.clientY),
        });
      } else if (viewportGesture.type === "pan") {
        const store = useEditorStore.getState();
        clampPanRef.current(
          store.panX - viewportGesture.delta.x / store.zoom,
          store.panY - viewportGesture.delta.y / store.zoom,
          store.zoom,
        );
      }
    }

    function finishPointer(event: PointerEvent, cancelled: boolean) {
      if (event.pointerType === "touch") return;
      const viewportGesture = viewportSessionRef.current.handle({
        type: cancelled ? "pointer-cancel" : "pointer-up",
        pointerId: event.pointerId,
      });
      if (viewportGesture.type === "end-interaction") {
        chartSessionRef.current.handle({
          type: cancelled ? "pointer-cancel" : "pointer-up",
        });
      }
      if (container!.hasPointerCapture(event.pointerId)) {
        container!.releasePointerCapture(event.pointerId);
      }
    }

    const onPointerUp = (event: PointerEvent) => finishPointer(event, false);
    const onPointerCancel = (event: PointerEvent) => finishPointer(event, true);
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerCancel);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [canvasRef, clientToChart, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType !== "touch" || event.target !== canvasRef.current) {
        return;
      }
      event.preventDefault();
      container!.setPointerCapture(event.pointerId);
      const store = useEditorStore.getState();
      const viewportGesture = viewportSessionRef.current.handle({
        type: "pointer-down",
        pointerId: event.pointerId,
        point: { x: event.clientX, y: event.clientY },
        mode: store.mode === "edit" && store.mouseTool === "move"
          ? "interaction"
          : "pan",
      });
      if (viewportGesture.type === "cancel-interaction") {
        chartSessionRef.current.handle({ type: "pointer-cancel" });
        return;
      }
      if (viewportGesture.type !== "start-interaction") return;

      const chart = store.chartData;
      if (!chart) return;
      const layout = computeLayout(
        chart,
        store.renderOptions.pxPerSecond,
        store.renderOptions.columnHeight,
      );
      const interaction = chartSessionRef.current.handle({
        type: "pointer-down",
        input: {
          point: clientToChart(event.clientX, event.clientY),
          pointer: { type: "touch", zoom: store.zoom },
          tool: "move",
          simplifyLasers: store.editFlags.simplifyLasers,
          chart,
          layout,
          hiSpeedMarks: store.hiSpeedMarks,
        },
      });
      if (interaction.handled) {
        tailSelectedRef.current = interaction.target?.type === "hold-tail";
      } else {
        store.clearSelectedPoint();
        store.setFirstSelectedNote(null);
        store.setIntervalInfo(null);
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== "touch") return;
      const viewportGesture = viewportSessionRef.current.handle({
        type: "pointer-move",
        pointerId: event.pointerId,
        point: { x: event.clientX, y: event.clientY },
      });
      if (viewportGesture.type !== "none") event.preventDefault();

      if (viewportGesture.type === "interaction") {
        chartSessionRef.current.handle({
          type: "pointer-move",
          point: clientToChart(event.clientX, event.clientY),
        });
      } else if (viewportGesture.type === "pan") {
        const store = useEditorStore.getState();
        clampPanRef.current(
          store.panX - viewportGesture.delta.x / store.zoom,
          store.panY - viewportGesture.delta.y / store.zoom,
          store.zoom,
        );
      } else if (viewportGesture.type === "pinch") {
        const store = useEditorStore.getState();
        const rect = container!.getBoundingClientRect();
        const nextZoom = Math.max(
          MIN_CHART_ZOOM,
          Math.min(MAX_CHART_ZOOM, store.zoom * viewportGesture.scale),
        );
        const cursorX = viewportGesture.center.x - rect.left;
        const cursorY = viewportGesture.center.y - rect.top;
        const chartX = store.panX + cursorX / store.zoom;
        const chartY = store.panY + cursorY / store.zoom;
        store.setZoom(nextZoom);
        clampPanRef.current(
          chartX - cursorX / nextZoom
            - viewportGesture.translation.x / nextZoom,
          chartY - cursorY / nextZoom
            - viewportGesture.translation.y / nextZoom,
          nextZoom,
        );
      }
    }

    function finishPointer(event: PointerEvent, cancelled: boolean) {
      if (event.pointerType !== "touch") return;
      const viewportGesture = viewportSessionRef.current.handle({
        type: cancelled ? "pointer-cancel" : "pointer-up",
        pointerId: event.pointerId,
      });
      if (viewportGesture.type === "end-interaction") {
        chartSessionRef.current.handle({
          type: cancelled ? "pointer-cancel" : "pointer-up",
        });
      }
      if (container!.hasPointerCapture(event.pointerId)) {
        container!.releasePointerCapture(event.pointerId);
      }
    }

    const onPointerUp = (event: PointerEvent) => finishPointer(event, false);
    const onPointerCancel = (event: PointerEvent) => finishPointer(event, true);
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerCancel);
    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [canvasRef, clientToChart, containerRef]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement
        || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace")
        && useEditorStore.getState().selectedPoint) {
        event.preventDefault();
        useEditorStore.getState().deleteSelectedPoint();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return useCallback((): ChartInteractionRenderingTransient => {
    const active = chartSessionRef.current.getActive();
    return {
      selectedButtonPart: tailSelectedRef.current ? "tail" : "body",
      buttonDragOriginalSeconds: active?.type === "button"
        ? active.originalSeconds
        : undefined,
    };
  }, []);
}
