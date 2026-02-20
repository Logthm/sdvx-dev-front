/**
 * Displays a backend-rendered chart image.
 *
 * Default behaviour: image height fits the container, user scrolls
 * horizontally (wheel = horizontal pan). Ctrl+wheel to zoom,
 * drag to pan freely.
 */

import { useChartImage, useEditedChartImage } from "@/api/chart";
import type { RenderOptions } from "@/lib/editor-store";
import { useEditorStore } from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import { Loader2, Maximize, Minimize, UnfoldVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ChartPreviewProps {
  musicId: number;
  difstr: string;
  renderOptions: RenderOptions;
  className?: string;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

export function ChartPreview({
  musicId,
  difstr,
  renderOptions,
  className,
}: ChartPreviewProps) {
  const { t } = useTranslation();
  const chartData = useEditorStore((s) => s.chartData);
  const editFlags = useEditorStore((s) => s.editFlags);
  const editVersion = useEditorStore((s) => s.editVersion);
  const hasEdits = Object.values(editFlags).some(Boolean) || editVersion > 0;

  const normalQuery = useChartImage(musicId, difstr, renderOptions);
  const editedQuery = useEditedChartImage(chartData, editFlags, editVersion, renderOptions);
  const imageQuery = hasEdits ? editedQuery : normalQuery;

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const setViewInitialized = useEditorStore((s) => s.setViewInitialized);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const clampedPan = useCallback((x: number, y: number, z: number) => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) { setPan(Math.max(0, x), Math.max(0, y)); return; }
    const rect = container.getBoundingClientRect();
    const maxX = Math.max(0, img.naturalWidth - rect.width / z);
    const maxY = Math.max(0, img.naturalHeight - rect.height / z);
    setPan(Math.max(0, Math.min(maxX, x)), Math.max(0, Math.min(maxY, y)));
  }, [setPan]);

  const dragRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
  }>({ active: false, lastX: 0, lastY: 0 });

  // Fit image height to container height on first load
  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (useEditorStore.getState().viewInitialized) return;

      const img = e.currentTarget;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      const fitZoom = rect.height / img.naturalHeight;
      const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));
      setZoom(z);
      setPan(0, 0);
      setViewInitialized(true);
    },
    [setZoom, setPan, setViewInitialized],
  );

  const fitHeight = useCallback(() => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, container.getBoundingClientRect().height / img.naturalHeight));
    setZoom(z);
    const { panX: px, panY: py } = useEditorStore.getState();
    clampedPan(px, py, z);
  }, [setZoom, clampedPan]);

  const mobileFs = useEditorStore((s) => s.mobileFullscreen);
  const toggleMobileFs = useEditorStore((s) => s.toggleMobileFullscreen);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (window.innerWidth < 768) {
      toggleMobileFs();
      return;
    }
    const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (!fsEl) {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    }
  }, [toggleMobileFs]);

  // Wheel: horizontal scroll by default, Ctrl+wheel to zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();

      const { zoom: z, panX: px, panY: py } = useEditorStore.getState();
      if (e.ctrlKey || e.metaKey) {
        const rect = container!.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta));

        const chartX = px + cursorX / z;
        const chartY = py + cursorY / z;
        clampedPan(chartX - cursorX / next, chartY - cursorY / next, next);
        setZoom(next);
      } else if (e.shiftKey) {
        clampedPan(px, py + e.deltaY / z, z);
      } else {
        clampedPan(px + e.deltaY / z, py, z);
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [clampedPan, setZoom]);

  // Mouse drag to pan
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMouseDown(e: MouseEvent) {
      if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
      }
    }

    function handleMouseMove(e: MouseEvent) {
      if (!dragRef.current.active) return;
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;

      const { zoom: z, panX: px, panY: py } = useEditorStore.getState();
      clampedPan(px - dx / z, py - dy / z, z);
    }

    function handleMouseUp() {
      dragRef.current.active = false;
    }

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [clampedPan]);

  // Touch: pan + pinch-to-zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastX = 0, lastY = 0;
    let lastDist = 0;
    let fingers = 0;

    function onStart(e: TouchEvent) {
      fingers = e.touches.length;
      if (fingers === 1) {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (fingers === 2) {
        lastX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        lastY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        lastDist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY,
        );
      }
    }

    function onMove(e: TouchEvent) {
      e.preventDefault();
      const rect = container!.getBoundingClientRect();
      const s = useEditorStore.getState();

      if (e.touches.length === 1 && fingers === 1) {
        const dx = e.touches[0].clientX - lastX;
        const dy = e.touches[0].clientY - lastY;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        clampedPan(s.panX - dx / s.zoom, s.panY - dy / s.zoom, s.zoom);
      } else if (e.touches.length === 2) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY,
        );
        const dx = midX - lastX;
        const dy = midY - lastY;
        const scale = lastDist > 0 ? dist / lastDist : 1;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s.zoom * scale));
        const cx = midX - rect.left;
        const cy = midY - rect.top;
        const chartX = s.panX + cx / s.zoom;
        const chartY = s.panY + cy / s.zoom;
        setZoom(newZoom);
        clampedPan(
          chartX - cx / newZoom - dx / newZoom,
          chartY - cy / newZoom - dy / newZoom,
          newZoom,
        );
        lastX = midX;
        lastY = midY;
        lastDist = dist;
      }
    }

    function onEnd(e: TouchEvent) {
      fingers = e.touches.length;
      if (fingers === 1) {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    }

    container.addEventListener("touchstart", onStart, { passive: true });
    container.addEventListener("touchmove", onMove, { passive: false });
    container.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onStart);
      container.removeEventListener("touchmove", onMove);
      container.removeEventListener("touchend", onEnd);
    };
  }, [clampedPan, setZoom]);

  const isReady = imageQuery.data && !imageQuery.isLoading;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-[#080c18] select-none",
        className,
      )}
      style={{ cursor: isReady ? "grab" : "default", touchAction: "none" }}
      onDragStart={(e) => e.preventDefault()}
    >
      {imageQuery.isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="animate-spin text-accent" />
          <span className="text-sm text-text-muted">{t('chart.loadingChart')}</span>
        </div>
      )}

      {imageQuery.isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <span className="text-sm text-diff-exhaust">
            {t('chart.loadFailed')}
          </span>
          <button
            onClick={() => imageQuery.refetch()}
            className="text-xs text-accent hover:underline"
          >
            {t('chart.retry')}
          </button>
        </div>
      )}

      {imageQuery.data && (
        <div
          style={{
            transform: `translate(${-panX * zoom}px, ${-panY * zoom}px) scale(${zoom})`,
            transformOrigin: "0 0",
            willChange: "transform",
            pointerEvents: "none",
          }}
        >
          <img
            ref={imgRef}
            src={imageQuery.data}
            alt={t('chart.chartPreview')}
            onLoad={onImageLoad}
            draggable={false}
            className="block max-w-none"
          />
        </div>
      )}

      {/* Zoom indicator */}
      {isReady && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-surface/80 backdrop-blur-sm border border-border text-xs font-mono text-text-muted">
          <button
            onClick={() => setZoom(Math.max(MIN_ZOOM, useEditorStore.getState().zoom - ZOOM_STEP))}
            className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          >
            −
          </button>
          <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(MAX_ZOOM, useEditorStore.getState().zoom + ZOOM_STEP))}
            className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          >
            +
          </button>
          <span className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={fitHeight}
            className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
            title={t('chart.fitHeight')}
          >
            <UnfoldVertical size={14} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
            title={isFullscreen || mobileFs ? t('chart.exitFullscreen') : t('chart.fullscreen')}
          >
            {isFullscreen || mobileFs ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
