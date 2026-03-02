/**
 * PlaybackCanvas — single-column scrolling chart playback.
 *
 * Notes fall from top to bottom; the playhead sits at ~70% of screen height.
 * Uses requestAnimationFrame for smooth scrolling driven by performance.now().
 */

import { computeSingleColumnLayout } from "@/lib/chart-renderer/layout";
import { renderPlaybackChart } from "@/lib/chart-renderer/renderer";
import { usePlaybackStore } from "@/lib/playback-store";
import { useEditorStore } from "@/lib/editor-store";
import { useMetronome } from "@/lib/use-metronome";
import { useAudioPlayer } from "@/lib/use-audio-player";
import type { ChartData } from "@/types/chart";
import { PxPerSecondButton } from "./PxPerSecondButton";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef } from "react";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

interface PlaybackCanvasProps {
  chartData: ChartData;
  className?: string;
}

const PLAYHEAD_RATIO = 0.7; // playhead at 70% from top

export function PlaybackCanvas({ chartData, className }: PlaybackCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const playStartRef = useRef<{ perfTime: number; chartTime: number } | null>(
    null,
  );

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

  const hiSpeedMarks = useEditorStore((s) => s.hiSpeedMarks);
  const bpmDisplayMode = useEditorStore((s) => s.bpmDisplayMode);
  const renderOptions = useEditorStore((s) => s.renderOptions);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  // Compute layout and total duration
  const layout = useMemo(
    () => computeSingleColumnLayout(chartData, renderOptions.pxPerSecond),
    [chartData, renderOptions.pxPerSecond],
  );

  useEffect(() => {
    if (layout.spans.length > 0) {
      const lastSpan = layout.spans[layout.spans.length - 1];
      setTotalDuration(lastSpan.sec1);
    }
  }, [layout, setTotalDuration]);

  // Metronome
  useMetronome(
    chartData,
    currentTimeSec,
    isPlaying,
    beatSubdivision,
    metronomeVolume,
    metronomeEnabled,
    playbackRate,
  );

  // BGM player
  useAudioPlayer(bgmFile, isPlaying, currentTimeSec, playbackRate, bgmOffset, bgmVolume);

  // Convert seconds to Y position in chart space (uses yInMeasure convention)
  const secToY = useCallback(
    (sec: number) => {
      if (layout.spans.length === 0) return 0;
      for (const span of layout.spans) {
        if (sec >= span.sec0 - 1e-9 && sec <= span.sec1 + 1e-9) {
          // yInMeasure: y1 - (sec - sec0) * pxPerSecond
          return span.y1 - (sec - span.sec0) * layout.pxPerSecond;
        }
      }
      // Beyond last span — return top of chart
      const last = layout.spans[layout.spans.length - 1];
      return last.y0;
    },
    [layout],
  );

  // Drawing function
  const draw = useCallback(
    (timeSec: number) => {
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

      // Apply zoom: scale content and adjust dimensions so renderer sees logical size
      ctx.scale(zoom, zoom);
      const scaledW = w / zoom;
      const scaledH = h / zoom;

      const playheadScreenY = scaledH * PLAYHEAD_RATIO;
      const scrollY = secToY(timeSec);

      renderPlaybackChart(
        ctx,
        chartData,
        layout,
        scaledW,
        scaledH,
        scrollY,
        playheadScreenY,
        hiSpeedMarks,
        bpmDisplayMode,
        renderOptions.laserLColor,
        renderOptions.laserRColor,
      );
    },
    [chartData, layout, secToY, hiSpeedMarks, bpmDisplayMode, renderOptions.laserLColor, renderOptions.laserRColor, zoom],
  );

  // PLACEHOLDER_ANIMATION_LOOP

  // Animation loop
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

  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;

      if (isPlaying && playStartRef.current) {
        const elapsed =
          ((performance.now() - playStartRef.current.perfTime) / 1000) *
          playbackRate;
        const newTime = playStartRef.current.chartTime + elapsed;

        if (newTime >= totalDurationSec) {
          setCurrentTime(totalDurationSec);
          pause();
        } else {
          setCurrentTime(newTime);
          draw(newTime);
        }
      } else {
        draw(currentTimeSec);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, playbackRate, totalDurationSec, currentTimeSec, draw, setCurrentTime, pause]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new ResizeObserver(() => draw(currentTimeSec));
    obs.observe(container);
    return () => obs.disconnect();
  }, [draw, currentTimeSec]);

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

  // Pinch zoom for mobile
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let initialZoom = 1;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialDistance = Math.sqrt(dx * dx + dy * dy);
        initialZoom = useEditorStore.getState().zoom;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scale = distance / initialDistance;
        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialZoom * scale));
        setZoom(newZoom);
      }
    };

    const onTouchEnd = () => {
      initialDistance = 0;
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [setZoom]);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ touchAction: "none" }}
      tabIndex={0}
    >
      <canvas ref={canvasRef} className="block" />
      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-md bg-surface/80 backdrop-blur-sm border border-border text-xs font-mono text-text-muted">
        <button
          onClick={() => {
            const z = useEditorStore.getState().zoom;
            setZoom(Math.max(MIN_ZOOM, z - ZOOM_STEP));
          }}
          className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors hidden md:block"
        >
          −
        </button>
        <span className="w-10 text-center hidden md:block">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => {
            const z = useEditorStore.getState().zoom;
            setZoom(Math.min(MAX_ZOOM, z + ZOOM_STEP));
          }}
          className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors hidden md:block"
        >
          +
        </button>
        <span className="w-px h-4 bg-border mx-0.5 hidden md:block" />
        <PxPerSecondButton />
      </div>
    </div>
  );
}

