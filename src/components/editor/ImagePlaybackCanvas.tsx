/**
 * ImagePlaybackCanvas — image-based scrolling playback for non-editable charts.
 *
 * Uses a backend-rendered single-column image instead of client-side canvas rendering.
 * The image scrolls via CSS transform, driven by rAF. Metronome and BGM work
 * identically to PlaybackCanvas.
 */

import { usePlaybackImage, useChartTimingData } from "@/api/chart";
import { computeSingleColumnLayout } from "@/lib/chart-renderer/layout";
import { usePlaybackStore } from "@/lib/playback-store";
import { useEditorStore } from "@/lib/editor-store";
import { useMetronome } from "@/lib/use-metronome";
import { useAudioPlayer } from "@/lib/use-audio-player";
import { PxPerSecondButton } from "./PxPerSecondButton";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;
const PLAYHEAD_RATIO = 0.7;

interface ImagePlaybackCanvasProps {
  musicId: number;
  difstr: string;
  className?: string;
}

export function ImagePlaybackCanvas({
  musicId,
  difstr,
  className,
}: ImagePlaybackCanvasProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number>(0);
  const playStartRef = useRef<{ perfTime: number; chartTime: number } | null>(null);

  // Playback state
  const isPlaying = usePlaybackStore((s) => s.isPlaying);
  const currentTimeSec = usePlaybackStore((s) => s.currentTimeSec);
  const playbackRate = usePlaybackStore((s) => s.playbackRate);
  const totalDurationSec = usePlaybackStore((s) => s.totalDurationSec);
  const setCurrentTime = usePlaybackStore((s) => s.setCurrentTime);
  const setTotalDuration = usePlaybackStore((s) => s.setTotalDuration);
  const pause = usePlaybackStore((s) => s.pause);

  const metronomeEnabled = usePlaybackStore((s) => s.metronomeEnabled);
  const metronomeVolume = usePlaybackStore((s) => s.metronomeVolume);
  const beatSubdivision = usePlaybackStore((s) => s.beatSubdivision);
  const bgmFile = usePlaybackStore((s) => s.bgmFile);
  const bgmOffset = usePlaybackStore((s) => s.bgmOffset);
  const bgmVolume = usePlaybackStore((s) => s.bgmVolume);

  const renderOptions = useEditorStore((s) => s.renderOptions);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  // Fetch timing data (no tracks)
  const timingQuery = useChartTimingData(musicId, difstr);
  const timingData = timingQuery.data ?? null;

  // Fetch single-column image
  const imageQuery = usePlaybackImage(musicId, difstr, renderOptions, true);
  const imageSrc = imageQuery.data ?? null;

  // Compute layout for time→Y mapping
  const layout = useMemo(
    () => timingData ? computeSingleColumnLayout(timingData, renderOptions.pxPerSecond) : null,
    [timingData, renderOptions.pxPerSecond],
  );

  // Set total duration
  useEffect(() => {
    if (layout && layout.spans.length > 0) {
      const lastSpan = layout.spans[layout.spans.length - 1];
      setTotalDuration(lastSpan.sec1);
    }
  }, [layout, setTotalDuration]);

  // Metronome
  useMetronome(
    timingData,
    currentTimeSec,
    isPlaying,
    beatSubdivision,
    metronomeVolume,
    metronomeEnabled,
    playbackRate,
  );

  // BGM
  useAudioPlayer(bgmFile, isPlaying, currentTimeSec, playbackRate, bgmOffset, bgmVolume);
  // Convert seconds to Y in chart space
  const secToY = useCallback(
    (sec: number) => {
      if (!layout || layout.spans.length === 0) return 0;
      for (const span of layout.spans) {
        if (sec >= span.sec0 - 1e-9 && sec <= span.sec1 + 1e-9) {
          return span.y1 - (sec - span.sec0) * layout.pxPerSecond;
        }
      }
      return layout.spans[layout.spans.length - 1].y0;
    },
    [layout],
  );

  // Scroll the image so the playhead line sits at PLAYHEAD_RATIO.
  // Transform is `scale(zoom) translateY(dy)` with origin "top center".
  // CSS applies right-to-left: first translateY, then scale.
  // Screen position of image point y = (y + dy) * zoom.
  // To place chartY at the playhead: dy = playheadScreenY / zoom - chartY.
  const updateScroll = useCallback(
    (timeSec: number) => {
      const img = imgRef.current;
      const container = containerRef.current;
      if (!img || !container || !layout) return;

      const containerH = container.getBoundingClientRect().height;
      const playheadScreenY = containerH * PLAYHEAD_RATIO;
      const chartY = secToY(timeSec);
      const dy = playheadScreenY / zoom - chartY;

      img.style.transform = `scale(${zoom}) translateY(${dy}px)`;
      img.style.transformOrigin = "top center";
    },
    [layout, secToY, zoom],
  );

  // Play start tracking
  useEffect(() => {
    if (isPlaying) {
      playStartRef.current = {
        perfTime: performance.now(),
        chartTime: usePlaybackStore.getState().currentTimeSec,
      };
    } else {
      playStartRef.current = null;
    }
  }, [isPlaying, playbackRate]);

  // Animation loop
  useEffect(() => {
    let running = true;
    const tick = () => {
      if (!running) return;
      if (isPlaying && playStartRef.current) {
        const elapsed =
          ((performance.now() - playStartRef.current.perfTime) / 1000) * playbackRate;
        const newTime = playStartRef.current.chartTime + elapsed;
        if (newTime >= totalDurationSec) {
          setCurrentTime(totalDurationSec);
          pause();
        } else {
          setCurrentTime(newTime);
          updateScroll(newTime);
        }
      } else {
        updateScroll(currentTimeSec);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, playbackRate, totalDurationSec, currentTimeSec, updateScroll, setCurrentTime, pause]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const store = usePlaybackStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        if (store.isPlaying) store.pause();
        else store.play();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        store.seekRelative(-2);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        store.seekRelative(2);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const z = useEditorStore.getState().zoom;
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [setZoom]);

  // Loading states
  const isLoading = timingQuery.isLoading || imageQuery.isLoading;
  const isError = timingQuery.isError || imageQuery.isError;

  if (isLoading) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full gap-3", className)}>
        <Loader2 size={24} className="animate-spin text-accent" />
        <span className="text-sm text-text-muted">{t("chart.loadingChart")}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full gap-3", className)}>
        <span className="text-sm text-diff-exhaust">{t("chart.loadFailed")}</span>
        <button
          onClick={() => { timingQuery.refetch(); imageQuery.refetch(); }}
          className="text-xs text-accent hover:underline"
        >
          {t("chart.retry")}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ touchAction: "none" }}
      tabIndex={0}
    >
      {/* Scrolling chart image */}
      {imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt="chart"
          className="absolute left-1/2 -translate-x-1/2 will-change-transform pointer-events-none select-none"
          draggable={false}
        />
      )}

      {/* Playhead line */}
      <div
        className="absolute left-0 right-0 h-px bg-gold-400/80 pointer-events-none z-10"
        style={{ top: `${PLAYHEAD_RATIO * 100}%` }}
      />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-surface/80 backdrop-blur-sm border border-border text-xs font-mono text-text-muted z-20">
        <button
          onClick={() => {
            const z = useEditorStore.getState().zoom;
            setZoom(Math.max(MIN_ZOOM, z - ZOOM_STEP));
          }}
          className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
        >
          −
        </button>
        <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => {
            const z = useEditorStore.getState().zoom;
            setZoom(Math.min(MAX_ZOOM, z + ZOOM_STEP));
          }}
          className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
        >
          +
        </button>
        <span className="w-px h-4 bg-border mx-0.5" />
        <PxPerSecondButton />
      </div>
    </div>
  );
}
