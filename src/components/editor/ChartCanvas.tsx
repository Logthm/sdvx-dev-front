import {
  MAX_CHART_ZOOM,
  MIN_CHART_ZOOM,
  type ChartHiSpeedRequest,
} from "@/lib/chart-interaction";
import { computeLayout } from "@/lib/chart-renderer/layout";
import {
  renderChart,
  type ViewState,
} from "@/lib/chart-renderer/renderer";
import { calculateHoldJudgements } from "@/lib/chart-renderer/hold-judgement";
import {
  exportChartImage,
  getChartMaxMeasure,
} from "@/lib/chart-image-export";
import { renderEditorOverlays } from "@/lib/editor-rendering";
import { useEditorStore } from "@/lib/editor-store";
import { useChartInteraction } from "@/lib/use-chart-interaction";
import { cn } from "@/lib/utils";
import type { ChartData } from "@/types/chart";
import { useResponsiveFullscreen } from "@/hooks/useResponsiveFullscreen";
import { ChartPointerToolbar } from "./ChartPointerToolbar";
import { ChartViewToolbar } from "./ChartViewToolbar";
import { ExportDialog } from "./ExportDialog";
import { HiSpeedMarkDialog } from "./HiSpeedMarkDialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ChartCanvasProps {
  chartData: ChartData;
  className?: string;
}

const ZOOM_STEP = 0.1;

export function ChartCanvas({ chartData, className }: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  const editorChartData = useEditorStore((s) => s.chartData);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const mode = useEditorStore((s) => s.mode);
  const selectedPoint = useEditorStore((s) => s.selectedPoint);
  const simplifyLasers = useEditorStore((s) => s.editFlags.simplifyLasers);
  const speed = useEditorStore((s) => s.speed);
  const dragRange = useEditorStore((s) => s.dragRange);
  const mouseTool = useEditorStore((s) => s.mouseTool);
  const hiSpeedMarks = useEditorStore((s) => s.hiSpeedMarks);
  const bpmDisplayMode = useEditorStore((s) => s.bpmDisplayMode);
  const renderOptions = useEditorStore((s) => s.renderOptions);
  const showHoldJudgement = useEditorStore((s) => s.showHoldJudgement);

  const [hiSpeedDialog, setHiSpeedDialog] =
    useState<ChartHiSpeedRequest | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const closeHiSpeedDialog = useCallback(() => setHiSpeedDialog(null), []);

  const activeChart = editorChartData ?? chartData;
  const holdJudgements = useMemo(
    () => calculateHoldJudgements(activeChart),
    [activeChart],
  );

  const clampedPan = useCallback((x: number, y: number, z: number) => {
    const container = containerRef.current;
    if (!container) { setPan(Math.max(0, x), Math.max(0, y)); return; }
    const rect = container.getBoundingClientRect();
    const layout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);
    const maxX = Math.max(0, layout.canvasWidth - rect.width / z);
    const maxY = Math.max(0, layout.canvasHeight - rect.height / z);
    setPan(Math.max(0, Math.min(maxX, x)), Math.max(0, Math.min(maxY, y)));
  }, [activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight, setPan]);

  const getInteractionRenderingTransient = useChartInteraction({
    containerRef,
    canvasRef,
    clampPan: clampedPan,
    onHiSpeedRequest: setHiSpeedDialog,
  });

  const fitHeight = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const layout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);
    const z = Math.max(
      MIN_CHART_ZOOM,
      Math.min(MAX_CHART_ZOOM, rect.height / layout.canvasHeight),
    );
    setZoom(z);
    const { panX: px, panY: py } = useEditorStore.getState();
    clampedPan(px, py, z);
  }, [activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight, setZoom, clampedPan]);

  const adjustZoom = useCallback((delta: number) => {
    const { zoom: currentZoom, panX: currentPanX, panY: currentPanY } =
      useEditorStore.getState();
    const nextZoom = Math.max(
      MIN_CHART_ZOOM,
      Math.min(MAX_CHART_ZOOM, currentZoom + delta),
    );
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const chartX = currentPanX + centerX / currentZoom;
      const chartY = currentPanY + centerY / currentZoom;
      clampedPan(
        chartX - centerX / nextZoom,
        chartY - centerY / nextZoom,
        nextZoom,
      );
    }
    setZoom(nextZoom);
  }, [clampedPan, setZoom]);

  const handleExport = useCallback((startMeasure: number, endMeasure: number) => {
    exportChartImage({
      chart: activeChart,
      renderOptions,
      hiSpeedMarks,
      speed,
      bpmDisplayMode,
      startMeasure,
      endMeasure,
    });
  }, [activeChart, renderOptions, hiSpeedMarks, speed, bpmDisplayMode]);

  const mobileFs = useEditorStore((s) => s.mobileFullscreen);
  const toggleMobileFs = useEditorStore((s) => s.toggleMobileFullscreen);
  const { isFullscreen, toggleFullscreen } = useResponsiveFullscreen(
    mobileFs,
    toggleMobileFs,
  );

  // ── Drawing ──
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const state: ViewState = { panX, panY, zoom };

    const hiSpeed = speed > 0 ? speed : undefined;

    renderChart(
      ctx,
      activeChart,
      w,
      h,
      state,
      renderOptions.pxPerSecond,
      renderOptions.columnHeight,
      hiSpeed,
      hiSpeedMarks,
      bpmDisplayMode,
      renderOptions.laserLColor,
      renderOptions.laserRColor,
    );

    if (mode === "edit") {
      renderEditorOverlays({
        context: ctx,
        chart: activeChart,
        view: state,
        holdJudgements,
        transient: getInteractionRenderingTransient(),
      });
    }

  }, [activeChart, zoom, panX, panY, mode, selectedPoint, simplifyLasers, dragRange, mouseTool, speed, hiSpeedMarks, bpmDisplayMode, renderOptions.laserLColor, renderOptions.laserRColor, renderOptions.pxPerSecond, renderOptions.columnHeight, showHoldJudgement, holdJudgements, getInteractionRenderingTransient]);

  const requestDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => {
    requestDraw();
  }, [requestDraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => requestDraw());
    obs.observe(container);
    return () => obs.disconnect();
  }, [requestDraw]);

  // ── Initial fit: only on first mount across modes ──
  useEffect(() => {
    if (useEditorStore.getState().viewInitialized) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const layout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);

    const fitZoom = rect.height / layout.canvasHeight;
    const initialZoom = Math.max(
      MIN_CHART_ZOOM,
      Math.min(MAX_CHART_ZOOM, fitZoom),
    );

    setZoom(initialZoom);
    setPan(0, 0);
    useEditorStore.getState().setViewInitialized(true);
  }, [activeChart, setZoom, setPan]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ cursor: mode === "edit" ? (mouseTool === "pan" ? "grab" : mouseTool === "move" ? "crosshair" : mouseTool === "edit-hs" ? "crosshair" : "cell") : "grab", touchAction: "none" }}
      tabIndex={0}
    >
      <canvas ref={canvasRef} className="block" style={{ touchAction: "none" }} />

      {mode === "edit" && <ChartPointerToolbar />}

      <ChartViewToolbar
        zoom={zoom}
        isFullscreen={isFullscreen}
        onZoomOut={() => adjustZoom(-ZOOM_STEP)}
        onZoomIn={() => adjustZoom(ZOOM_STEP)}
        onExport={() => setExportDialogOpen(true)}
        onFitHeight={fitHeight}
        onToggleFullscreen={toggleFullscreen}
      />

      <HiSpeedMarkDialog
        request={hiSpeedDialog}
        onClose={closeHiSpeedDialog}
      />

      {/* Export dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        maxMeasure={getChartMaxMeasure(activeChart)}
      />
    </div>
  );
}
