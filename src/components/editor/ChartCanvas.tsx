import {
  computeLayout,
  findSpanAtPoint,
  findSpanByMeasure,
  findSpanByYInCol,
  lanLeftX,
  xToLaserOffset,
  xToTrackName,
  yInMeasure,
  yToSec,
  colXBase,
  TRACK_WIDTH,
  MARGIN,
  GUTTER_WIDTH,
  type LayoutResult,
} from "@/lib/chart-renderer/layout";
import { resolveEvent, drawLasers } from "@/lib/chart-renderer/laser-drawer";
import { noteX, CHIP_HEIGHT, TAIL_HEIGHT, drawNotes } from "@/lib/chart-renderer/note-drawer";
import { drawGridWithBpm, drawHiSpeedMarks } from "@/lib/chart-renderer/grid-drawer";
import { calculateInterval } from "@/lib/chart-edit";
import {
  renderChart,
  type ViewState,
} from "@/lib/chart-renderer/renderer";
import { DRAG_RANGE_MS, useEditorStore, type HiSpeedMark } from "@/lib/editor-store";
import { cn } from "@/lib/utils";
import type { ButtonEvent, ChartData, LaserEvent } from "@/types/chart";
import type { Time3 } from "@/lib/chart-renderer/time-mapper";
import { PxPerSecondButton } from "./PxPerSecondButton";
import { ExportDialog } from "./ExportDialog";
import { Download, Hand, Maximize, Minimize, Move, Pencil, Plus, RotateCcw, Trash2, UnfoldVertical } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface ChartCanvasProps {
  chartData: ChartData;
  className?: string;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.1;

export function ChartCanvas({ chartData, className }: ChartCanvasProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const dragRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
  }>({ active: false, lastX: 0, lastY: 0 });
  const pointDragRef = useRef<{ active: boolean; track: string; index: number; col: number; isOob: boolean }>({
    active: false, track: "", index: -1, col: 0, isOob: false,
  });
  const btnDragRef = useRef<{ active: boolean; track: string; index: number; col: number; origSec: number; origHoldLen: number; origTime: [number, number, number] }>({
    active: false, track: "", index: -1, col: 0, origSec: 0, origHoldLen: 0, origTime: [0, 0, 0],
  });
  const hsDragRef = useRef<{ active: boolean; index: number; col: number }>({
    active: false, index: -1, col: 0,
  });
  const holdTailDragRef = useRef<{ active: boolean; track: string; index: number; col: number; startTime: [number, number, number] }>({
    active: false, track: "", index: -1, col: 0, startTime: [0, 0, 0],
  });
  const tailSelectedRef = useRef(false);

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
  const setMouseTool = useEditorStore((s) => s.setMouseTool);
  const setDragRange = useEditorStore((s) => s.setDragRange);
  const hiSpeedMarks = useEditorStore((s) => s.hiSpeedMarks);
  const bpmDisplayMode = useEditorStore((s) => s.bpmDisplayMode);
  const renderOptions = useEditorStore((s) => s.renderOptions);

  const resetSelectedPoint = useEditorStore((s) => s.resetSelectedPoint);
  const deleteSelectedPoint = useEditorStore((s) => s.deleteSelectedPoint);

  const expandedTool = useEditorStore((s) => s.expandedTool);
  const setExpandedTool = useEditorStore((s) => s.setExpandedTool);
  const [pendingHs, setPendingHs] = useState<{ time: [number, number, number] } | null>(null);
  const [hsInput, setHsInput] = useState({ hs: "", dur: "" });
  const [editingHs, setEditingHs] = useState<{ index: number } | null>(null);
  const [editHsInput, setEditHsInput] = useState({ hs: "", dur: "" });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const activeChart = editorChartData ?? chartData;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const clampedPan = useCallback((x: number, y: number, z: number) => {
    const container = containerRef.current;
    if (!container) { setPan(Math.max(0, x), Math.max(0, y)); return; }
    const rect = container.getBoundingClientRect();
    const layout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);
    const maxX = Math.max(0, layout.canvasWidth - rect.width / z);
    const maxY = Math.max(0, layout.canvasHeight - rect.height / z);
    setPan(Math.max(0, Math.min(maxX, x)), Math.max(0, Math.min(maxY, y)));
  }, [activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight, setPan]);

  const clampedPanRef = useRef(clampedPan);
  clampedPanRef.current = clampedPan;

  const fitHeight = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const layout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rect.height / layout.canvasHeight));
    setZoom(z);
    const { panX: px, panY: py } = useEditorStore.getState();
    clampedPan(px, py, z);
  }, [activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight, setZoom, clampedPan]);

  // Calculate max measure from chart data
  const getMaxMeasure = useCallback(() => {
    let maxMeasure = 0;

    // Check end_position
    if (activeChart.end_position) {
      maxMeasure = Math.max(maxMeasure, activeChart.end_position.measure);
    }

    // Check all events in tracks
    Object.values(activeChart.tracks).forEach((events) => {
      events.forEach((event) => {
        if (event.time && Array.isArray(event.time)) {
          maxMeasure = Math.max(maxMeasure, event.time[0]);
        }
      });
    });

    // Check beat_info and bpm_info
    activeChart.beat_info?.forEach((beat) => {
      maxMeasure = Math.max(maxMeasure, beat.measure);
    });
    activeChart.bpm_info?.forEach((bpm) => {
      maxMeasure = Math.max(maxMeasure, bpm.measure);
    });

    return Math.max(1, maxMeasure);
  }, [activeChart]);

  // Export chart as image by rendering specified measure range (preserves all edits including HS marks)
  const handleExport = useCallback((startMeasure: number, endMeasure: number) => {
    // Calculate measure offset for remapping
    const measureOffset = startMeasure - 1; // Convert to 0-indexed

    // Create a new chart data containing only the specified measure range
    const filteredTracks: Record<string, (ButtonEvent | LaserEvent)[]> = {};

    // Get the full layout for time calculations
    const fullLayout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);

    // Helper function to get the last position in a measure
    const getLastPositionInMeasure = (measure: number): Time3 => {
      const timeSig = fullLayout.timeMapper.getTimeSigAt([measure, 1, 0] as Time3);
      const [numerator, denominator] = timeSig;

      // Get units per beat
      const beatResolution = activeChart.beat_resolution;
      const unitsPerBeat = beatResolution !== null && beatResolution !== undefined
        ? beatResolution
        : 192 / Math.max(1, denominator);

      // Last position in the measure is at the last beat, last cell
      return [measure, numerator, unitsPerBeat - 1] as Time3;
    };

    // Helper function to interpolate laser point at boundary
    const interpolateLaserAtBoundary = (
      prevPoint: LaserEvent,
      nextPoint: LaserEvent,
      boundaryTime: Time3,
      flag: number,
    ): LaserEvent => {
      const prevSec = fullLayout.timeMapper.secondsOf(prevPoint.time as [number, number, number]);
      const nextSec = fullLayout.timeMapper.secondsOf(nextPoint.time as [number, number, number]);
      const boundarySec = fullLayout.timeMapper.secondsOf(boundaryTime);

      // Linear interpolation
      const t = (boundarySec - prevSec) / (nextSec - prevSec);
      const interpolatedOffset = Math.round(prevPoint.offset + (nextPoint.offset - prevPoint.offset) * t);

      return {
        type: "laser",
        track_name: prevPoint.track_name,
        time: boundaryTime,
        offset: interpolatedOffset,
        flag: flag,
        is_out_of_bounds: prevPoint.is_out_of_bounds,
      };
    };

    // Filter and remap events to start from measure 1
    Object.entries(activeChart.tracks).forEach(([trackName, events]) => {
      // Track names are numeric strings: '1' = LASER-L, '8' = LASER-R
      if (trackName === '1' || trackName === '8') {
        // Special handling for laser tracks
        const laserEvents = events as LaserEvent[];
        const filtered: LaserEvent[] = [];
        let needStartInterpolation = false;
        let prevPoint: LaserEvent | null = null;
        let lastInRangePoint: LaserEvent | null = null; // Track the last point within range

        for (let i = 0; i < laserEvents.length; i++) {
          const event = laserEvents[i];
          const [measure] = event.time as [number, number, number];
          // measure is already 1-indexed

          // Check if this point is within range
          const inRange = measure >= startMeasure && measure <= endMeasure;

          if (measure < startMeasure) {
            // Before range, keep track for potential start interpolation
            prevPoint = event;
            if (event.flag !== 2) {
              needStartInterpolation = true;
            } else {
              needStartInterpolation = false;
            }
          } else if (inRange) {
            // Add interpolated start point if needed
            if (needStartInterpolation && prevPoint && filtered.length === 0) {
              const startBoundary: Time3 = [startMeasure, 1, 0];
              const interpolated = interpolateLaserAtBoundary(prevPoint, event, startBoundary, 1);
              filtered.push({
                ...interpolated,
                time: [interpolated.time[0] - measureOffset, interpolated.time[1], interpolated.time[2]] as [number, number, number],
              });
              needStartInterpolation = false;
            }

            // Add the point
            filtered.push({
              ...event,
              time: [measure - measureOffset, (event.time as [number, number, number])[1], (event.time as [number, number, number])[2]] as [number, number, number],
            });

            lastInRangePoint = event; // Track this as the last in-range point
          } else if (measure > endMeasure) {
            // This point is after the range, check if we need to add an interpolated end point
            if (lastInRangePoint && lastInRangePoint.flag !== 2) {
              const endBoundary = getLastPositionInMeasure(endMeasure);
              const interpolated = interpolateLaserAtBoundary(lastInRangePoint, event, endBoundary, 2);
              filtered.push({
                ...interpolated,
                time: [interpolated.time[0] - measureOffset, interpolated.time[1], interpolated.time[2]] as [number, number, number],
              });
            }
            break; // No need to check further points
          }
        }

        // After loop: if the last point in range is not a terminator and there's no next point,
        // the laser segment ends exactly at or within the range - no interpolation needed

        filteredTracks[trackName] = filtered;
      } else {
        // Regular button events - need to handle hold truncation and adjustment
        const buttonEvents = events as ButtonEvent[];

        // First pass: collect all button events and check for holds that start before range
        const processedEvents: ButtonEvent[] = [];

        buttonEvents.forEach(event => {
          const [measure] = event.time as [number, number, number];
          // measure is already 1-indexed

          // Check if this button is in range
          if (measure >= startMeasure && measure <= endMeasure) {
            const [m, beat, cell] = event.time as [number, number, number];

            // Check if hold extends beyond the export range
            if (event.hold_len && event.hold_len > 0) {
              // Calculate hold end time using advanceUnits
              const holdEndTime = fullLayout.timeMapper.advanceUnits([m, beat, cell], event.hold_len);
              const holdEndMeasure = holdEndTime[0]; // Already 1-indexed

              if (holdEndMeasure > endMeasure) {
                // Hold extends beyond range, need to truncate
                // Note: endMeasure is 1-indexed, so convert to 0-indexed for Time3
                const boundaryTime: [number, number, number] = [endMeasure + 1, 1, 0];
                const truncatedHoldLen = fullLayout.timeMapper.unitsBetween(
                  [m, beat, cell],
                  boundaryTime
                );

                processedEvents.push({
                  ...event,
                  time: [m - measureOffset, beat, cell] as [number, number, number],
                  hold_len: Math.max(0, truncatedHoldLen),
                });
              } else {
                processedEvents.push({
                  ...event,
                  time: [m - measureOffset, beat, cell] as [number, number, number],
                });
              }
            } else {
              processedEvents.push({
                ...event,
                time: [m - measureOffset, beat, cell] as [number, number, number],
              });
            }
          } else if (measure < startMeasure && event.hold_len && event.hold_len > 0) {
            // Button is before range, but check if hold extends into range
            const [m, beat, cell] = event.time as [number, number, number];

            // Calculate hold end time using advanceUnits
            const holdEndTime = fullLayout.timeMapper.advanceUnits([m, beat, cell], event.hold_len);
            const holdEndMeasure = holdEndTime[0]; // Already 1-indexed

            if (holdEndMeasure >= startMeasure) {
              // Hold extends into range, need to create a new button at the start boundary
              // Note: startMeasure is 1-indexed, so convert to 0-indexed for Time3
              const boundaryTime: [number, number, number] = [startMeasure, 1, 0];

              // Calculate new hold length from boundary to original end
              const newHoldLen = fullLayout.timeMapper.unitsBetween(
                boundaryTime,
                holdEndTime
              );

              // Check if hold also extends beyond end range
              let finalHoldLen = newHoldLen;
              if (holdEndMeasure > endMeasure) {
                const endBoundaryTime: [number, number, number] = [endMeasure + 1, 1, 0];
                finalHoldLen = fullLayout.timeMapper.unitsBetween(
                  boundaryTime,
                  endBoundaryTime
                );
              }

              processedEvents.push({
                ...event,
                time: [boundaryTime[0] - measureOffset, boundaryTime[1], boundaryTime[2]] as [number, number, number],
                hold_len: Math.max(0, finalHoldLen),
              });
            }
          }
        });

        filteredTracks[trackName] = processedEvents;
      }
    });

    // Filter and remap BPM info to start from measure 1
    // Strategy:
    // 1. Include all BPM changes within the range (startMeasure to endMeasure)
    // 2. If the first BPM change is not at measure 1, beat 1, cell 0, add the active BPM there

    const filteredBpmInfo = activeChart.bpm_info
      .filter(bpm => {
        // bpm.measure is already 1-indexed
        return bpm.measure >= startMeasure && bpm.measure <= endMeasure;
      })
      .map(bpm => ({
        ...bpm,
        measure: bpm.measure - measureOffset,
      }));

    // Check if we need to add an initial BPM at the start
    const hasInitialBpm = filteredBpmInfo.some(bpm =>
      bpm.measure === 1 && bpm.beat === 1 && bpm.cell === 0
    );

    if (!hasInitialBpm) {
      // Find the active BPM at the start of the range
      let activeBpm = activeChart.bpm_info[0];
      for (const bpm of activeChart.bpm_info) {
        if (bpm.measure < startMeasure ||
            (bpm.measure === startMeasure &&
             (bpm.beat < 1 || (bpm.beat === 1 && bpm.cell <= 0)))) {
          activeBpm = bpm;
        } else {
          break;
        }
      }

      // Add it at the start
      filteredBpmInfo.unshift({
        measure: 1,
        beat: 1,
        cell: 0,
        bpm: activeBpm.bpm,
      });
    }

    // Filter and remap beat info to start from measure 1
    const filteredBeatInfo = activeChart.beat_info
      .filter(beat => {
        // beat.measure is already 1-indexed
        return beat.measure >= startMeasure && beat.measure <= endMeasure;
      })
      .map(beat => ({
        ...beat,
        measure: beat.measure - measureOffset,
      }));

    // Check if we need to add an initial beat signature at the start
    const hasInitialBeat = filteredBeatInfo.some(beat =>
      beat.measure === 1 && beat.beat === 1 && beat.cell === 0
    );

    if (!hasInitialBeat) {
      // Find the active beat signature at the start of the range
      let activeBeat = activeChart.beat_info[0];
      for (const beat of activeChart.beat_info) {
        if (beat.measure < startMeasure ||
            (beat.measure === startMeasure &&
             (beat.beat < 1 || (beat.beat === 1 && beat.cell <= 0)))) {
          activeBeat = beat;
        } else {
          break;
        }
      }

      // Add it at the start
      filteredBeatInfo.unshift({
        measure: 1,
        beat: 1,
        cell: 0,
        numerator: activeBeat.numerator,
        denominator: activeBeat.denominator,
      });
    }

    // Filter and remap hi-speed marks to start from measure 1
    // Include marks that:
    // 1. Start within the export range, OR
    // 2. Start before the range but end within or after the range (their effect carries over)
    const filteredHsMarks: HiSpeedMark[] = [];

    for (const mark of hiSpeedMarks) {
      const [measure] = mark.time as [number, number, number];
      const markStartSec = fullLayout.timeMapper.secondsOf(mark.time as Time3);
      const markEndSec = markStartSec + mark.durationMs / 1000;

      // Get the start and end times of the export range
      const rangeStartTime: Time3 = [startMeasure, 1, 0];
      const rangeStartSec = fullLayout.timeMapper.secondsOf(rangeStartTime);

      // Include mark if it ends at or after the range start
      // (meaning its effect will be active during the exported range)
      if (markEndSec >= rangeStartSec) {
        if (measure < startMeasure) {
          // Mark starts before range - clamp its start to the range start
          filteredHsMarks.push({
            ...mark,
            time: [1, 1, 0] as [number, number, number], // Start at measure 1 in exported chart
            durationMs: Math.max(0, (markEndSec - rangeStartSec) * 1000), // Adjust duration
          });
        } else if (measure <= endMeasure) {
          // Mark starts within range - remap normally
          filteredHsMarks.push({
            ...mark,
            time: [measure - measureOffset, (mark.time as [number, number, number])[1], (mark.time as [number, number, number])[2]] as [number, number, number],
          });
        }
      }
    }

    // Calculate the new end position
    // Note: measure N means content from measure line N to measure line N+1
    // So to include measure 50, we need end_position to be at measure 51
    const newEndMeasure = endMeasure - startMeasure + 1;
    const endPosition = {
      measure: newEndMeasure + 1,
      beat: 1,
      cell: 0,
    };

    // Create a new chart data with filtered and remapped content
    const exportChartData: ChartData = {
      ...activeChart,
      tracks: filteredTracks,
      bpm_info: filteredBpmInfo,
      beat_info: filteredBeatInfo,
      end_position: endPosition,
    };

    // Compute layout for the export chart (will start from column 0)
    const exportLayout = computeLayout(exportChartData, renderOptions.pxPerSecond, renderOptions.columnHeight);

    if (exportLayout.spans.length === 0) return;

    // Filter spans to only include those within the requested measure range (1-indexed in remapped chart)
    // Since we remapped measures, measure 1 = startMeasure, measure N = endMeasure
    const requestedMeasureCount = endMeasure - startMeasure + 1;
    const filteredSpans = exportLayout.spans.filter(span => span.measure <= requestedMeasureCount);

    if (filteredSpans.length === 0) return;

    // Calculate the required canvas dimensions based on filtered spans
    const minY = Math.min(...filteredSpans.map(s => s.y0));
    const maxY = Math.max(...filteredSpans.map(s => s.y1));
    const contentHeight = maxY - minY;

    // Add top and bottom margins
    const height = contentHeight + 2 * MARGIN;

    // Adjust spans coordinates to start from MARGIN (top margin)
    const adjustedSpans = filteredSpans.map(span => ({
      ...span,
      y0: span.y0 - minY + MARGIN,
      y1: span.y1 - minY + MARGIN,
    }));

    // Recalculate canvas width based on filtered columns
    const maxCol = Math.max(...filteredSpans.map(s => s.col));
    const filteredCanvasWidth = colXBase(maxCol) + TRACK_WIDTH + GUTTER_WIDTH + MARGIN;

    // Create the final export layout with adjusted spans
    const finalExportLayout: LayoutResult = {
      ...exportLayout,
      spans: adjustedSpans,
      canvasWidth: filteredCanvasWidth,
      canvasHeight: height,
      columnHeight: height,
    };

    // Create a temporary canvas for export
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = filteredCanvasWidth;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext('2d');

    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#080c18';
    ctx.fillRect(0, 0, filteredCanvasWidth, height);

    // Draw column backgrounds for each span individually
    for (const span of adjustedSpans) {
      const xBase = colXBase(span.col);
      const oobWidth = (TRACK_WIDTH - 96.5) / 2;
      const laneLeft = xBase + oobWidth;
      const laneWidth = 96.5;

      // OOB zones
      ctx.fillStyle = 'rgba(8, 12, 24, 0.6)';
      ctx.fillRect(xBase, span.y0 - 2, oobWidth, span.y1 - span.y0 + 4);
      ctx.fillRect(laneLeft + laneWidth, span.y0 - 2, oobWidth, span.y1 - span.y0 + 4);

      // Main lane background
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(laneLeft, span.y0 - 2, laneWidth, span.y1 - span.y0 + 4);

      // Lane border lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      for (const x of [laneLeft, laneLeft + laneWidth]) {
        ctx.beginPath();
        ctx.moveTo(x, span.y0 - 2);
        ctx.lineTo(x, span.y1 + 2);
        ctx.stroke();
      }
    }

    // Draw hi-speed marks using the standard renderer
    if (filteredHsMarks.length > 0) {
      drawHiSpeedMarks(ctx, finalExportLayout, filteredHsMarks);
    }

    // Draw grid and BPM markers (with original measure numbers for display)
    drawGridWithBpm(ctx, finalExportLayout, exportChartData.bpm_info, speed, filteredHsMarks, bpmDisplayMode, measureOffset);

    // Draw notes
    drawNotes(ctx, exportChartData, finalExportLayout);

    // Draw lasers
    drawLasers(ctx, exportChartData, finalExportLayout, renderOptions.laserLColor, renderOptions.laserRColor);

    // Download the image
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chart_measure_${startMeasure}-${endMeasure}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, [activeChart, renderOptions, hiSpeedMarks, speed, bpmDisplayMode]);

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

    // Draw gold outlines for modified button notes
    const store = useEditorStore.getState();
    if (mode === "edit" && store.originalChartData) {
      const orig = store.originalChartData;
      const layout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);
      ctx.save();
      ctx.translate(-panX * zoom, -panY * zoom);
      ctx.scale(zoom, zoom);

      // Build set of original note keys
      const origKeys = new Set<string>();
      for (const t of ["2", "3", "4", "5", "6", "7"]) {
        for (const ev of orig.tracks[t] ?? []) {
          if (ev.type === "button") origKeys.add(`${t}:${ev.time[0]},${ev.time[1]},${ev.time[2]}`);
        }
      }

      // Stroke modified notes + modified hold tails
      ctx.strokeStyle = "rgba(100, 160, 255, 0.8)";
      ctx.lineWidth = 1;
      // Build original hold_len map
      const origHoldLen = new Map<string, number>();
      for (const t of ["2", "3", "4", "5", "6", "7"]) {
        for (const ev of orig.tracks[t] ?? []) {
          if (ev.type === "button") origHoldLen.set(`${t}:${ev.time[0]},${ev.time[1]},${ev.time[2]}`, ev.hold_len);
        }
      }
      for (const t of ["2", "3", "4", "5", "6", "7"]) {
        for (const ev of activeChart.tracks[t] ?? []) {
          if (ev.type !== "button") continue;
          const key = `${t}:${ev.time[0]},${ev.time[1]},${ev.time[2]}`;
          // Gold border on chip head if position is new
          if (!origKeys.has(key)) {
            const span = findSpanByMeasure(layout.spans, ev.time[0]);
            if (span) {
              const geo = noteX(span, ev.track_name);
              if (geo) {
                const ey = yInMeasure(span, ev.time as Time3, layout.timeMapper, layout.pxPerSecond);
                ctx.strokeRect(geo.x - 1, ey - CHIP_HEIGHT / 2 - 1, geo.w + 2, CHIP_HEIGHT + 2);
              }
            }
          }
          // Gold border on hold tail if hold_len changed
          if (ev.hold_len > 0) {
            const origHL = origHoldLen.get(key);
            if (origHL === undefined || origHL !== ev.hold_len) {
              const endTime = layout.timeMapper.advanceUnits(ev.time as Time3, ev.hold_len);
              const span = findSpanByMeasure(layout.spans, endTime[0]);
              if (span) {
                const geo = noteX(span, ev.track_name);
                if (geo) {
                  const ey = yInMeasure(span, endTime, layout.timeMapper, layout.pxPerSecond);
                  ctx.strokeRect(geo.x - 1, ey - 1, geo.w + 2, TAIL_HEIGHT + 2);
                }
              }
            }
          }
        }
      }
      ctx.restore();
    }

    // Draw laser point markers when simplifyLasers is active
    if (mode === "edit" && simplifyLasers) {
      const layout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);
      ctx.save();
      ctx.translate(-panX * zoom, -panY * zoom);
      ctx.scale(zoom, zoom);
      for (const [track, color] of [["1", "#0082D9"], ["8", "#BC0088"]] as const) {
        const events = (activeChart.tracks[track] ?? []).filter(
          (e): e is LaserEvent => e.type === "laser",
        );
        for (const ev of events) {
          const rp = resolveEvent(ev, layout.timeMapper, layout.spans, layout.pxPerSecond);
          if (!rp) continue;
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Draw selection highlight
    const sel = useEditorStore.getState().selectedPoint;
    if (sel && mode === "edit") {
      const layout = computeLayout(activeChart, renderOptions.pxPerSecond, renderOptions.columnHeight);
      ctx.save();
      ctx.translate(-panX * zoom, -panY * zoom);
      ctx.scale(zoom, zoom);

      if (sel.type === "laser" && simplifyLasers) {
        const events = (activeChart.tracks[sel.track] ?? []).filter(
          (e): e is LaserEvent => e.type === "laser",
        );
        const ev = events[sel.index];
        if (ev) {
          const rp = resolveEvent(ev, layout.timeMapper, layout.spans, layout.pxPerSecond);
          if (rp) {
            ctx.beginPath();
            ctx.arc(rp.x, rp.y, 10, 0, Math.PI * 2);
            ctx.strokeStyle = "oklch(0.72 0.155 70)";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      } else if (sel.type === "button") {
        const btnEvents = (activeChart.tracks[sel.track] ?? []).filter(
          (e): e is ButtonEvent => e.type === "button",
        );
        const bev = btnEvents[sel.index];
        if (bev) {
          const span = findSpanByMeasure(layout.spans, bev.time[0]);
          if (span) {
            const geo = noteX(span, bev.track_name);
            if (geo) {
              // Highlight at tail or head
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 2;
              if (tailSelectedRef.current && bev.hold_len > 0) {
                const endTime = layout.timeMapper.advanceUnits(bev.time as Time3, bev.hold_len);
                const tailSpan = findSpanByMeasure(layout.spans, endTime[0]);
                const tailGeo = tailSpan ? noteX(tailSpan, bev.track_name) : null;
                if (tailSpan && tailGeo) {
                  const ty = yInMeasure(tailSpan, endTime, layout.timeMapper, layout.pxPerSecond);
                  ctx.strokeRect(tailGeo.x - 2, ty - 2, tailGeo.w + 4, TAIL_HEIGHT + 4);
                }
              } else {
                const by = yInMeasure(span, bev.time as Time3, layout.timeMapper, layout.pxPerSecond);
                ctx.strokeRect(geo.x - 2, by - CHIP_HEIGHT / 2 - 2, geo.w + 4, CHIP_HEIGHT + 4);
              }

              // Draw drag range overlay based on original position
              const dr = useEditorStore.getState().dragRange;
              if (dr !== "off") {
                const limitSec = DRAG_RANGE_MS[dr] / 1000;
                // Always use original position from originalChartData
                // When events were added/removed, indices shift so index-based lookup is unreliable
                let origSec: number;
                if (btnDragRef.current.active && btnDragRef.current.track === sel.track && btnDragRef.current.index === sel.index) {
                  origSec = btnDragRef.current.origSec;
                } else {
                  const orig = useEditorStore.getState().originalChartData;
                  const origTrack = orig?.tracks[sel.track];
                  const editedTrack = activeChart.tracks[sel.track];
                  const origEv = origTrack?.length === editedTrack?.length ? origTrack?.[sel.index] : undefined;
                  const origTime = origEv ? origEv.time as Time3 : bev.time as Time3;
                  origSec = layout.timeMapper.secondsOf(origTime);
                }
                const origY = span.y1 - (origSec - span.sec0) * layout.pxPerSecond;
                const yTop = origY - limitSec * layout.pxPerSecond;
                const yBot = origY + limitSec * layout.pxPerSecond;
                ctx.fillStyle = "rgba(255, 255, 0, 0.10)";
                ctx.fillRect(geo.x - 4, yTop, geo.w + 8, yBot - yTop);
                ctx.strokeStyle = "rgba(255, 255, 0, 0.5)";
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(geo.x - 4, yTop);
                ctx.lineTo(geo.x + geo.w + 4, yTop);
                ctx.moveTo(geo.x - 4, yBot);
                ctx.lineTo(geo.x + geo.w + 4, yBot);
                ctx.stroke();
                ctx.setLineDash([]);
              }
            }
          }
        }
      } else if (sel.type === "hispeed") {
        const marks = useEditorStore.getState().hiSpeedMarks;
        const mark = marks[sel.index];
        if (mark) {
          const markSec = layout.timeMapper.secondsOf(mark.time as Time3);
          for (const span of layout.spans) {
            if (markSec < span.sec0 || markSec >= span.sec1) continue;
            const trackLeft = colXBase(span.col);
            const y = span.y1 - (markSec - span.sec0) * layout.pxPerSecond;
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.strokeRect(trackLeft - 2, y - 4, TRACK_WIDTH + 4, 8);
          }
        }
      }
      ctx.restore();
    }
  }, [activeChart, zoom, panX, panY, mode, selectedPoint, simplifyLasers, dragRange, speed, hiSpeedMarks, bpmDisplayMode, renderOptions.laserLColor, renderOptions.laserRColor, renderOptions.pxPerSecond, renderOptions.columnHeight]);

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
    const initialZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));

    setZoom(initialZoom);
    setPan(0, 0);
    useEditorStore.getState().setViewInitialized(true);
  }, [activeChart, setZoom, setPan]);

  // ── Wheel: scroll / zoom ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor
        const rect = container!.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const currentZoom = useEditorStore.getState().zoom;
        const currentPanX = useEditorStore.getState().panX;
        const currentPanY = useEditorStore.getState().panY;

        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, currentZoom + delta),
        );

        // Adjust pan so the point under cursor stays fixed
        const chartX = currentPanX + cursorX / currentZoom;
        const chartY = currentPanY + cursorY / currentZoom;
        const newPanX = chartX - cursorX / newZoom;
        const newPanY = chartY - cursorY / newZoom;

        setZoom(newZoom);
        clampedPan(newPanX, newPanY, newZoom);
      } else if (e.shiftKey) {
        const currentPanY = useEditorStore.getState().panY;
        const currentZoom = useEditorStore.getState().zoom;
        clampedPan(
          useEditorStore.getState().panX,
          currentPanY + e.deltaY / currentZoom,
          currentZoom,
        );
      } else {
        const currentPanX = useEditorStore.getState().panX;
        const currentZoom = useEditorStore.getState().zoom;
        clampedPan(
          currentPanX + e.deltaY / currentZoom,
          useEditorStore.getState().panY,
          currentZoom,
        );
      }
    }

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [setZoom, clampedPan]);

  // ── Shared hit-test helpers ──
  function clientToChart(clientX: number, clientY: number) {
    const rect = (canvasRef.current ?? containerRef.current!).getBoundingClientRect();
    const s = useEditorStore.getState();
    return {
      x: s.panX + (clientX - rect.left) / s.zoom,
      y: s.panY + (clientY - rect.top) / s.zoom,
    };
  }

  function hitTestLaserPoints(cx: number, cy: number, margin = 0) {
    const { chartData: chart, renderOptions: ro } = useEditorStore.getState();
    if (!chart) return null;
    const layout = computeLayout(chart, ro.pxPerSecond, ro.columnHeight);
    const HIT_R = 10 + margin;
    let best: { track: string; index: number; dist: number } | null = null;
    for (const track of ["1", "8"] as const) {
      const events = (chart.tracks[track] ?? []).filter(
        (e): e is LaserEvent => e.type === "laser",
      );
      for (let i = 0; i < events.length; i++) {
        const rp = resolveEvent(events[i], layout.timeMapper, layout.spans, layout.pxPerSecond);
        if (!rp) continue;
        const d = Math.hypot(cx - rp.x, cy - rp.y);
        if (d <= HIT_R && (!best || d < best.dist)) {
          best = { track, index: i, dist: d };
        }
      }
    }
    return best;
  }

  function hitTestButtonNotes(cx: number, cy: number, margin = 0) {
    const { chartData: chart, renderOptions: ro } = useEditorStore.getState();
    if (!chart) return null;
    const layout = computeLayout(chart, ro.pxPerSecond, ro.columnHeight);
    for (const trackNum of ["3", "4", "5", "6", "2", "7"]) {
      const events = chart.tracks[trackNum] ?? [];
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type !== "button") continue;
        const span = findSpanByMeasure(layout.spans, ev.time[0]);
        if (!span) continue;
        const geo = noteX(span, ev.track_name);
        if (!geo) continue;
        const ey = yInMeasure(span, ev.time as Time3, layout.timeMapper, layout.pxPerSecond);
        if (cx >= geo.x && cx <= geo.x + geo.w && cy >= ey - CHIP_HEIGHT / 2 - margin && cy <= ey + CHIP_HEIGHT / 2 + margin) {
          return { track: trackNum, index: i, col: span.col };
        }
      }
    }
    return null;
  }

  function hitTestHiSpeedMarks(cx: number, cy: number, margin = 6) {
    const { hiSpeedMarks: marks, chartData: chart, renderOptions: ro } = useEditorStore.getState();
    if (!chart || marks.length === 0) return null;
    const layout = computeLayout(chart, ro.pxPerSecond, ro.columnHeight);
    const { spans, timeMapper: tm, pxPerSecond } = layout;
    for (let i = 0; i < marks.length; i++) {
      const markSec = tm.secondsOf(marks[i].time as Time3);
      for (const span of spans) {
        if (markSec < span.sec0 || markSec >= span.sec1) continue;
        const trackLeft = colXBase(span.col);
        const y = span.y1 - (markSec - span.sec0) * pxPerSecond;
        if (cx >= trackLeft - 30 && cx <= trackLeft + TRACK_WIDTH + 30 && cy >= y - margin && cy <= y + margin) {
          return { index: i, col: span.col };
        }
      }
    }
    return null;
  }

  function hitTestHiSpeedText(cx: number, cy: number) {
    const { hiSpeedMarks: marks, chartData: chart, renderOptions: ro } = useEditorStore.getState();
    if (!chart || marks.length === 0) return null;
    const layout = computeLayout(chart, ro.pxPerSecond, ro.columnHeight);
    const { spans, timeMapper: tm, pxPerSecond } = layout;
    for (let i = 0; i < marks.length; i++) {
      const markSec = tm.secondsOf(marks[i].time as Time3);
      for (const span of spans) {
        if (markSec < span.sec0 || markSec >= span.sec1) continue;
        const trackLeft = colXBase(span.col);
        const y = span.y1 - (markSec - span.sec0) * pxPerSecond;
        // Text is right-aligned at trackLeft-4, ~22px tall, ~80px wide
        if (cx >= trackLeft - 84 && cx <= trackLeft - 4 && cy >= y - 22 && cy <= y + 2) {
          return { index: i };
        }
      }
    }
    return null;
  }

  function hitTestHoldTail(cx: number, cy: number, margin = 6) {
    const { chartData: chart, renderOptions: ro } = useEditorStore.getState();
    if (!chart) return null;
    const layout = computeLayout(chart, ro.pxPerSecond, ro.columnHeight);
    for (const trackNum of ["3", "4", "5", "6", "2", "7"]) {
      const events = chart.tracks[trackNum] ?? [];
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type !== "button" || ev.hold_len <= 0) continue;
        const endTime = layout.timeMapper.advanceUnits(ev.time as Time3, ev.hold_len);
        const span = findSpanByMeasure(layout.spans, endTime[0]);
        if (!span) continue;
        const geo = noteX(span, ev.track_name);
        if (!geo) continue;
        const y = yInMeasure(span, endTime, layout.timeMapper, layout.pxPerSecond);
        if (cx >= geo.x && cx <= geo.x + geo.w && cy >= y - margin && cy <= y + margin) {
          return { track: trackNum, index: i, col: span.col };
        }
      }
    }
    return null;
  }

  // ── Mouse: pan + point interaction ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMouseDown(e: MouseEvent) {
      if (e.button !== 0 && e.button !== 1) return;
      if (e.target !== canvasRef.current) return;
      e.preventDefault();

      const s = useEditorStore.getState();
      if (s.mode === "edit" && e.button === 0) {
        const { x, y } = clientToChart(e.clientX, e.clientY);

        // Pan mode: only pan, no interaction
        if (s.mouseTool === "pan") {
          dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
          return;
        }

        // Move mode: select and drag
        if (s.mouseTool === "move") {
          // 1) Laser hit test (only when simplifyLasers active)
          if (s.editFlags.simplifyLasers) {
            const hit = hitTestLaserPoints(x, y);
            if (hit) {
              const chart = s.chartData!;
              const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
              const events = (chart.tracks[hit.track] ?? []).filter(
                (ev): ev is LaserEvent => ev.type === "laser",
              );
              const rp = resolveEvent(events[hit.index], layout.timeMapper, layout.spans, layout.pxPerSecond);

              // Check if we should calculate interval
              const first = s.firstSelectedNote;
              if (first && (first.track !== hit.track || first.index !== hit.index)) {
                // Calculate interval between first and current
                const firstEv = (chart.tracks[first.track] ?? [])[first.index] as LaserEvent;
                const currentEv = events[hit.index];
                const interval = calculateInterval(
                  firstEv.time as Time3,
                  currentEv.time as Time3,
                  layout.timeMapper,
                  chart.beat_resolution ?? null,
                );
                s.setIntervalInfo(interval);
                s.setFirstSelectedNote(null);
              } else if (!first) {
                // Set as first selected note
                s.setFirstSelectedNote({ type: "laser", track: hit.track, index: hit.index });
                s.setIntervalInfo(null);
              }

              s.pushHistory();
              s.setSelectedPoint({ type: "laser", track: hit.track, index: hit.index });
              pointDragRef.current = { active: true, track: hit.track, index: hit.index, col: rp?.col ?? 0, isOob: events[hit.index].is_out_of_bounds };
              return;
            }
          }

          // 2) Button hit test (before hold tail so BT chips take priority over FX tails)
          const btnHit = hitTestButtonNotes(x, y);
          if (btnHit) {
            const chart = s.chartData!;
            const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
            const bev = (chart.tracks[btnHit.track] ?? [])[btnHit.index] as ButtonEvent;
            const origTrack = s.originalChartData?.tracks[btnHit.track];
            const editedTrack = chart.tracks[btnHit.track];
            const origEv = origTrack?.length === editedTrack?.length ? origTrack?.[btnHit.index] : undefined;
            const origTime = origEv ? origEv.time as Time3 : bev.time as Time3;
            const origSec = layout.timeMapper.secondsOf(origTime);

            // Check if we should calculate interval
            const first = s.firstSelectedNote;
            if (first && (first.track !== btnHit.track || first.index !== btnHit.index)) {
              // Calculate interval between first and current
              const firstEv = (chart.tracks[first.track] ?? [])[first.index];
              const firstTime = firstEv.type === "laser"
                ? (firstEv as LaserEvent).time
                : (firstEv as ButtonEvent).time;
              const interval = calculateInterval(
                firstTime as Time3,
                bev.time as Time3,
                layout.timeMapper,
                chart.beat_resolution ?? null,
              );
              s.setIntervalInfo(interval);
              s.setFirstSelectedNote(null);
            } else if (!first) {
              // Set as first selected note
              s.setFirstSelectedNote({ type: "button", track: btnHit.track, index: btnHit.index });
              s.setIntervalInfo(null);
            }

            s.pushHistory();
            s.setSelectedPoint({ type: "button", track: btnHit.track, index: btnHit.index });
            tailSelectedRef.current = false;
            btnDragRef.current = { active: true, track: btnHit.track, index: btnHit.index, col: btnHit.col, origSec, origHoldLen: bev.hold_len ?? 0, origTime: bev.time as [number, number, number] };
            return;
          }

          // 3) Hold tail hit test
          const tailHit = hitTestHoldTail(x, y);
          if (tailHit) {
            const chart = s.chartData!;
            const bev = (chart.tracks[tailHit.track] ?? [])[tailHit.index] as ButtonEvent;
            s.pushHistory();
            s.setSelectedPoint({ type: "button", track: tailHit.track, index: tailHit.index });
            tailSelectedRef.current = true;
            holdTailDragRef.current = { active: true, track: tailHit.track, index: tailHit.index, col: tailHit.col, startTime: bev.time as [number, number, number] };
            return;
          }

          // 3a) Hi-speed text label click → drag
          const hsTextHit = hitTestHiSpeedText(x, y);
          if (hsTextHit) {
            const chart = s.chartData!;
            const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
            const markSec = layout.timeMapper.secondsOf(s.hiSpeedMarks[hsTextHit.index].time as Time3);
            // Find the column for this mark
            let col = 0;
            for (const span of layout.spans) {
              if (markSec >= span.sec0 && markSec < span.sec1) { col = span.col; break; }
            }
            s.setSelectedPoint({ type: "hispeed", track: "", index: hsTextHit.index });
            hsDragRef.current = { active: true, index: hsTextHit.index, col };
            return;
          }

          // 3b) Hi-speed mark line hit test → drag
          const hsHit = hitTestHiSpeedMarks(x, y);
          if (hsHit) {
            s.setSelectedPoint({ type: "hispeed", track: "", index: hsHit.index });
            hsDragRef.current = { active: true, index: hsHit.index, col: hsHit.col };
            return;
          }

          // Clear selections when clicking empty space
          s.clearSelectedPoint();
          s.setFirstSelectedNote(null);
          s.setIntervalInfo(null);
          return;
        }

        // Edit mode: toggle hold, edit HS
        if (s.mouseTool === "edit-hs") {
          // Button hit: toggle chip <-> hold
          const btnHit = hitTestButtonNotes(x, y);
          if (btnHit) {
            const chart = s.chartData!;
            const bev = (chart.tracks[btnHit.track] ?? [])[btnHit.index] as ButtonEvent;
            if (bev.hold_len > 0) {
              s.updateButtonHoldLen(btnHit.track, btnHit.index, 0);
            } else {
              const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
              const [num, den] = layout.timeMapper.getTimeSigAt(bev.time as Time3);
              const upb = chart.beat_resolution ?? (192 / den);
              const holdLen = Math.round(num * upb / 8);
              s.updateButtonHoldLen(btnHit.track, btnHit.index, holdLen);
            }
            return;
          }
          // HS text or line: open edit dialog
          const hsTextHit = hitTestHiSpeedText(x, y);
          if (hsTextHit) {
            const mark = s.hiSpeedMarks[hsTextHit.index];
            setEditingHs({ index: hsTextHit.index });
            setEditHsInput({ hs: mark.hiSpeed.toFixed(1), dur: String(mark.durationMs) });
            return;
          }
          const hsHit = hitTestHiSpeedMarks(x, y);
          if (hsHit) {
            const mark = s.hiSpeedMarks[hsHit.index];
            setEditingHs({ index: hsHit.index });
            setEditHsInput({ hs: mark.hiSpeed.toFixed(1), dur: String(mark.durationMs) });
            return;
          }
          return;
        }

        // Add modes: only add notes
        if (s.mouseTool === "add-bt" || s.mouseTool === "add-fx") {
          const chart = s.chartData;
          if (chart) {
            const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
            const span = findSpanAtPoint(layout.spans, x, y);
            if (span) {
              const lane = xToTrackName(x, span.col, s.mouseTool === "add-fx");
              if (lane) {
                // Check if lane matches tool mode
                const isBt = lane.trackName.startsWith("BT-");
                const isFx = lane.trackName.startsWith("FX-");
                if ((s.mouseTool === "add-bt" && isBt) || (s.mouseTool === "add-fx" && isFx)) {
                  const sec = yToSec(y, span, layout.pxPerSecond);
                  const time = layout.timeMapper.secToTime3(sec, span.measure);
                  s.addButton(lane.trackNum, {
                    type: "button",
                    track_name: lane.trackName,
                    time,
                    hold_len: 0,
                  });
                  return;
                }
              }
            }
          }
          return;
        }

        // Add hi-speed mark
        if (s.mouseTool === "add-hispeed") {
          const chart = s.chartData;
          if (chart) {
            const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
            const span = findSpanAtPoint(layout.spans, x, y);
            if (span) {
              const sec = yToSec(y, span, layout.pxPerSecond);
              const time = layout.timeMapper.secToTime3(sec, span.measure);
              setPendingHs({ time });
              setHsInput({ hs: "", dur: "" });
            }
          }
          return;
        }
      }

      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
    }

    function handleMouseMove(e: MouseEvent) {
      // Laser point drag
      if (pointDragRef.current.active) {
        const s = useEditorStore.getState();
        const chart = s.chartData;
        if (!chart) return;
        const { x, y } = clientToChart(e.clientX, e.clientY);
        const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
        const col = pointDragRef.current.col;
        const span = findSpanByYInCol(layout.spans, y, col);
        if (!span) return;
        const sec = yToSec(y, span, layout.pxPerSecond);
        const newTime = layout.timeMapper.secToTime3(sec, span.measure);
        const offset = xToLaserOffset(x, lanLeftX(col), pointDragRef.current.isOob);
        s.updateLaserPoint(pointDragRef.current.track, pointDragRef.current.index, newTime, offset);
        return;
      }
      // Button drag (vertical only, with range limit)
      if (btnDragRef.current.active) {
        const s = useEditorStore.getState();
        const chart = s.chartData;
        if (!chart) return;
        const { y } = clientToChart(e.clientX, e.clientY);
        const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
        const col = btnDragRef.current.col;
        const span = findSpanByYInCol(layout.spans, y, col);
        if (!span) return;
        let sec = yToSec(y, span, layout.pxPerSecond);
        // Clamp to drag range
        const limitMs = DRAG_RANGE_MS[s.dragRange];
        if (limitMs !== Infinity) {
          const limitSec = limitMs / 1000;
          const orig = btnDragRef.current.origSec;
          sec = Math.max(orig - limitSec, Math.min(orig + limitSec, sec));
        }
        const newTime = layout.timeMapper.secToTime3(sec, span.measure);
        s.updateButtonTime(btnDragRef.current.track, btnDragRef.current.index, newTime);
        if (btnDragRef.current.origHoldLen > 0) {
          const delta = layout.timeMapper.unitsBetween(btnDragRef.current.origTime as Time3, newTime);
          const newLen = btnDragRef.current.origHoldLen - delta;
          if (newLen > 0) s.updateButtonHoldLen(btnDragRef.current.track, btnDragRef.current.index, newLen);
        }
        return;
      }
      // Hi-speed mark drag (vertical only)
      if (hsDragRef.current.active) {
        const s = useEditorStore.getState();
        const chart = s.chartData;
        if (!chart) return;
        const { y } = clientToChart(e.clientX, e.clientY);
        const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
        const span = findSpanByYInCol(layout.spans, y, hsDragRef.current.col);
        if (!span) return;
        const sec = yToSec(y, span, layout.pxPerSecond);
        const newTime = layout.timeMapper.secToTime3(sec, span.measure);
        s.updateHiSpeedMarkTime(hsDragRef.current.index, newTime);
        return;
      }
      // Hold tail drag (vertical only)
      if (holdTailDragRef.current.active) {
        const s = useEditorStore.getState();
        const chart = s.chartData;
        if (!chart) return;
        const { y } = clientToChart(e.clientX, e.clientY);
        const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
        const span = findSpanByYInCol(layout.spans, y, holdTailDragRef.current.col);
        if (!span) return;
        const sec = yToSec(y, span, layout.pxPerSecond);
        const endTime = layout.timeMapper.secToTime3(sec, span.measure);
        const units = layout.timeMapper.unitsBetween(holdTailDragRef.current.startTime as Time3, endTime);
        if (units > 0) s.updateButtonHoldLen(holdTailDragRef.current.track, holdTailDragRef.current.index, units);
        return;
      }
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
      pointDragRef.current.active = false;
      btnDragRef.current.active = false;
      hsDragRef.current.active = false;
      holdTailDragRef.current.active = false;
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

  // ── Touch: pan + pinch-to-zoom + move-mode drag ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastX = 0, lastY = 0;
    let lastDist = 0;
    let fingers = 0;
    let touchPanning = false;

    function onStart(e: TouchEvent) {
      if (e.target !== canvasRef.current) return;
      fingers = e.touches.length;
      if (fingers === 1) {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        const s = useEditorStore.getState();

        if (s.mode === "edit" && s.mouseTool === "move") {
          e.preventDefault();
          const { x, y } = clientToChart(lastX, lastY);
          const TOUCH_MARGIN = 30 / s.zoom;
          if (s.editFlags.simplifyLasers) {
            const hit = hitTestLaserPoints(x, y, TOUCH_MARGIN);
            if (hit) {
              e.preventDefault();
              const chart = s.chartData!;
              const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
              const events = (chart.tracks[hit.track] ?? []).filter(
                (ev): ev is LaserEvent => ev.type === "laser",
              );
              const rp = resolveEvent(events[hit.index], layout.timeMapper, layout.spans, layout.pxPerSecond);

              const first = s.firstSelectedNote;
              if (first && (first.track !== hit.track || first.index !== hit.index)) {
                const firstEv = (chart.tracks[first.track] ?? [])[first.index] as LaserEvent;
                const interval = calculateInterval(firstEv.time as Time3, events[hit.index].time as Time3, layout.timeMapper, chart.beat_resolution ?? null);
                s.setIntervalInfo(interval);
                s.setFirstSelectedNote(null);
              } else if (!first) {
                s.setFirstSelectedNote({ type: "laser", track: hit.track, index: hit.index });
                s.setIntervalInfo(null);
              }

              s.pushHistory();
              s.setSelectedPoint({ type: "laser", track: hit.track, index: hit.index });
              pointDragRef.current = { active: true, track: hit.track, index: hit.index, col: rp?.col ?? 0, isOob: events[hit.index].is_out_of_bounds };
              return;
            }
          }
          const tailHit = hitTestHoldTail(x, y, TOUCH_MARGIN);
          if (tailHit) {
            e.preventDefault();
            const chart = s.chartData!;
            const bev = (chart.tracks[tailHit.track] ?? [])[tailHit.index] as ButtonEvent;
            s.pushHistory();
            s.setSelectedPoint({ type: "button", track: tailHit.track, index: tailHit.index });
            tailSelectedRef.current = true;
            holdTailDragRef.current = { active: true, track: tailHit.track, index: tailHit.index, col: tailHit.col, startTime: bev.time as [number, number, number] };
            return;
          }
          const btnHit = hitTestButtonNotes(x, y, TOUCH_MARGIN);
          if (btnHit) {
            e.preventDefault();
            const chart = s.chartData!;
            const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
            const bev = (chart.tracks[btnHit.track] ?? [])[btnHit.index] as ButtonEvent;
            const origTrack = s.originalChartData?.tracks[btnHit.track];
            const editedTrack = chart.tracks[btnHit.track];
            const origEv = origTrack?.length === editedTrack?.length ? origTrack?.[btnHit.index] : undefined;
            const origTime = origEv ? origEv.time as Time3 : bev.time as Time3;
            const origSec = layout.timeMapper.secondsOf(origTime);

            const first = s.firstSelectedNote;
            if (first && (first.track !== btnHit.track || first.index !== btnHit.index)) {
              const firstEv = (chart.tracks[first.track] ?? [])[first.index];
              const firstTime = firstEv.type === "laser" ? (firstEv as LaserEvent).time : (firstEv as ButtonEvent).time;
              const interval = calculateInterval(firstTime as Time3, bev.time as Time3, layout.timeMapper, chart.beat_resolution ?? null);
              s.setIntervalInfo(interval);
              s.setFirstSelectedNote(null);
            } else if (!first) {
              s.setFirstSelectedNote({ type: "button", track: btnHit.track, index: btnHit.index });
              s.setIntervalInfo(null);
            }

            s.pushHistory();
            s.setSelectedPoint({ type: "button", track: btnHit.track, index: btnHit.index });
            tailSelectedRef.current = false;
            btnDragRef.current = { active: true, track: btnHit.track, index: btnHit.index, col: btnHit.col, origSec, origHoldLen: bev.hold_len ?? 0, origTime: bev.time as [number, number, number] };
            return;
          }
          const hsHit = hitTestHiSpeedMarks(x, y, TOUCH_MARGIN);
          if (hsHit) {
            e.preventDefault();
            s.setSelectedPoint({ type: "hispeed", track: "", index: hsHit.index });
            hsDragRef.current = { active: true, index: hsHit.index, col: hsHit.col };
            return;
          }
          s.clearSelectedPoint();
          s.setFirstSelectedNote(null);
          s.setIntervalInfo(null);
          return;
        }

        touchPanning = true;
      } else if (fingers === 2) {
        // Stop any single-finger drag
        touchPanning = false;
        pointDragRef.current.active = false;
        btnDragRef.current.active = false;
        hsDragRef.current.active = false;
        holdTailDragRef.current.active = false;
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
      const s = useEditorStore.getState();

      // Drag refs survive effect re-runs; check them first
      if (e.touches.length === 1 && pointDragRef.current.active) {
        const { x, y } = clientToChart(e.touches[0].clientX, e.touches[0].clientY);
        const chart = s.chartData;
        if (!chart) return;
        const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
        const col = pointDragRef.current.col;
        const span = findSpanByYInCol(layout.spans, y, col);
        if (!span) return;
        const sec = yToSec(y, span, layout.pxPerSecond);
        const newTime = layout.timeMapper.secToTime3(sec, span.measure);
        const offset = xToLaserOffset(x, lanLeftX(col), pointDragRef.current.isOob);
        s.updateLaserPoint(pointDragRef.current.track, pointDragRef.current.index, newTime, offset);
        return;
      }
      if (e.touches.length === 1 && btnDragRef.current.active) {
        const { y } = clientToChart(e.touches[0].clientX, e.touches[0].clientY);
        const chart = s.chartData;
        if (!chart) return;
        const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
        const col = btnDragRef.current.col;
        const span = findSpanByYInCol(layout.spans, y, col);
        if (!span) return;
        let sec = yToSec(y, span, layout.pxPerSecond);
        const limitMs = DRAG_RANGE_MS[s.dragRange];
        if (limitMs !== Infinity) {
          const limitSec = limitMs / 1000;
          const orig = btnDragRef.current.origSec;
          sec = Math.max(orig - limitSec, Math.min(orig + limitSec, sec));
        }
        const newTime = layout.timeMapper.secToTime3(sec, span.measure);
        s.updateButtonTime(btnDragRef.current.track, btnDragRef.current.index, newTime);
        if (btnDragRef.current.origHoldLen > 0) {
          const delta = layout.timeMapper.unitsBetween(btnDragRef.current.origTime as Time3, newTime);
          const newLen = btnDragRef.current.origHoldLen - delta;
          if (newLen > 0) s.updateButtonHoldLen(btnDragRef.current.track, btnDragRef.current.index, newLen);
        }
        return;
      }
      if (e.touches.length === 1 && hsDragRef.current.active) {
        const { y } = clientToChart(e.touches[0].clientX, e.touches[0].clientY);
        const chart = s.chartData;
        if (!chart) return;
        const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
        const span = findSpanByYInCol(layout.spans, y, hsDragRef.current.col);
        if (!span) return;
        const sec = yToSec(y, span, layout.pxPerSecond);
        const newTime = layout.timeMapper.secToTime3(sec, span.measure);
        s.updateHiSpeedMarkTime(hsDragRef.current.index, newTime);
        return;
      }
      if (e.touches.length === 1 && holdTailDragRef.current.active) {
        const { y } = clientToChart(e.touches[0].clientX, e.touches[0].clientY);
        const chart = s.chartData;
        if (!chart) return;
        const layout = computeLayout(chart, s.renderOptions.pxPerSecond, s.renderOptions.columnHeight);
        const span = findSpanByYInCol(layout.spans, y, holdTailDragRef.current.col);
        if (!span) return;
        const sec = yToSec(y, span, layout.pxPerSecond);
        const endTime = layout.timeMapper.secToTime3(sec, span.measure);
        const units = layout.timeMapper.unitsBetween(holdTailDragRef.current.startTime as Time3, endTime);
        if (units > 0) s.updateButtonHoldLen(holdTailDragRef.current.track, holdTailDragRef.current.index, units);
        return;
      }
      if (e.touches.length === 1 && fingers === 1 && touchPanning) {
        const cx = e.touches[0].clientX;
        const cy = e.touches[0].clientY;
        const dx = cx - lastX;
        const dy = cy - lastY;
        lastX = cx; lastY = cy;
        clampedPanRef.current(s.panX - dx / s.zoom, s.panY - dy / s.zoom, s.zoom);
      } else if (e.touches.length === 2) {
        const rect = container!.getBoundingClientRect();
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
        clampedPanRef.current(chartX - cx / newZoom - dx / newZoom, chartY - cy / newZoom - dy / newZoom, newZoom);
        lastX = midX; lastY = midY; lastDist = dist;
      }
    }

    function onEnd(e: TouchEvent) {
      if (e.touches.length === 0) {
        touchPanning = false;
        pointDragRef.current.active = false;
        btnDragRef.current.active = false;
        hsDragRef.current.active = false;
        holdTailDragRef.current.active = false;
      }
      fingers = e.touches.length;
      if (fingers === 1) {
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      }
    }

    container.addEventListener("touchstart", onStart, { passive: false });
    container.addEventListener("touchmove", onMove, { passive: false });
    container.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      container.removeEventListener("touchstart", onStart);
      container.removeEventListener("touchmove", onMove);
      container.removeEventListener("touchend", onEnd);
    };
  }, [setZoom]);

  // ── Keyboard: delete selected point ──
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === "Delete" || e.key === "Backspace") && useEditorStore.getState().selectedPoint) {
        e.preventDefault();
        useEditorStore.getState().deleteSelectedPoint();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden", className)}
      style={{ cursor: mode === "edit" ? (mouseTool === "pan" ? "grab" : mouseTool === "move" ? "crosshair" : mouseTool === "edit-hs" ? "crosshair" : "cell") : "grab", touchAction: "none" }}
      tabIndex={0}
    >
      <canvas ref={canvasRef} className="block" style={{ touchAction: "none" }} />

      {/* Mouse tool selector (left side) */}
      {mode === "edit" && (
        <div className="absolute top-3 left-3 flex flex-col gap-1 px-2 py-1 rounded-md bg-surface/80 backdrop-blur-sm border border-border" data-tutorial="chart-pointer-tools">
          {/* Pan */}
          <button
            onClick={() => { setMouseTool("pan"); setExpandedTool(null); }}
            className={cn(
              "p-3 md:p-1.5 rounded transition-colors touch-manipulation",
              mouseTool === "pan"
                ? "bg-gold-400/15 text-gold-400"
                : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
            )}
            title={t('chart.panView')}
          >
            <Hand size={16} />
          </button>
          {/* Drag / Move */}
          <button
            onClick={() => {
              setMouseTool("move");
              setExpandedTool(expandedTool === "drag" ? null : "drag");
            }}
            className={cn(
              "p-3 md:p-1.5 rounded transition-colors touch-manipulation",
              mouseTool === "move"
                ? dragRange === "s-critical" ? "bg-gold-300/15 text-gold-300"
                  : dragRange === "critical" ? "bg-gold-600/15 text-gold-600"
                  : dragRange === "near" ? "bg-green-400/15 text-green-400"
                  : "bg-gold-400/15 text-gold-400"
                : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
            )}
            title={t('chart.moveSelect')}
          >
            <Move size={16} />
          </button>
          {expandedTool === "drag" && (
            <div className={cn("flex flex-col gap-0.5 pl-1 border-l-2 ml-1",
              dragRange === "s-critical" ? "border-gold-300/30"
                : dragRange === "critical" ? "border-gold-600/30"
                : dragRange === "near" ? "border-green-400/30"
                : "border-gold-400/30",
            )}>
              {([["off", "Off", "bg-gold-400/15 text-gold-400"], ["s-critical", "S-Crit", "bg-gold-300/15 text-gold-300"], ["critical", "Crit", "bg-gold-600/15 text-gold-600"], ["near", "Near", "bg-green-400/15 text-green-400"]] as const).map(([v, l, ac]) => (
                <button
                  key={v}
                  onClick={() => setDragRange(v)}
                  className={cn(
                    "px-2 py-1 rounded text-[10px] font-medium transition-colors text-left",
                    dragRange === v
                      ? ac
                      : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
          {/* Edit HS */}
          <button
            onClick={() => { setMouseTool("edit-hs"); setExpandedTool(null); }}
            className={cn(
              "p-3 md:p-1.5 rounded transition-colors touch-manipulation",
              mouseTool === "edit-hs"
                ? "bg-gold-400/15 text-gold-400"
                : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
            )}
            title={t('chart.editHs')}
          >
            <Pencil size={16} />
          </button>
          {/* Add */}
          <button
            onClick={() => setExpandedTool(expandedTool === "add" ? null : "add")}
            className={cn(
              "p-3 md:p-1.5 rounded transition-colors touch-manipulation",
              (mouseTool === "add-bt" || mouseTool === "add-fx" || mouseTool === "add-hispeed")
                ? mouseTool === "add-bt" ? "bg-slate-200/15 text-slate-200"
                  : mouseTool === "add-fx" ? "bg-orange-400/15 text-orange-400"
                  : "bg-blue-400/15 text-blue-400"
                : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
            )}
            title={t('chart.addNotes')}
          >
            <Plus size={16} />
          </button>
          {expandedTool === "add" && (
            <div className={cn("flex flex-col gap-0.5 pl-1 border-l-2 ml-1",
              mouseTool === "add-bt" ? "border-slate-200/30"
                : mouseTool === "add-fx" ? "border-orange-400/30"
                : mouseTool === "add-hispeed" ? "border-blue-400/30"
                : "border-gold-400/30",
            )}>
              <button
                onClick={() => { setMouseTool("add-bt"); setExpandedTool(null); }}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium transition-colors text-left",
                  mouseTool === "add-bt"
                    ? "bg-slate-200/15 text-slate-200"
                    : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
                )}
              >
                BT
              </button>
              <button
                onClick={() => { setMouseTool("add-fx"); setExpandedTool(null); }}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium transition-colors text-left",
                  mouseTool === "add-fx"
                    ? "bg-orange-400/15 text-orange-400"
                    : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
                )}
              >
                FX
              </button>
              <button
                onClick={() => { setMouseTool("add-hispeed"); setExpandedTool(null); }}
                className={cn(
                  "px-2 py-1 rounded text-[10px] font-medium transition-colors text-left",
                  mouseTool === "add-hispeed"
                    ? "bg-blue-400/15 text-blue-400"
                    : "text-text-muted hover:text-text-primary hover:bg-cosmos-700",
                )}
              >
                HS
              </button>
            </div>
          )}
          {/* Reset selected */}
          {selectedPoint && (
            <button
              onClick={() => resetSelectedPoint()}
              className="p-3 md:p-1.5 rounded transition-colors touch-manipulation text-blue-400 hover:bg-blue-500/15"
              title={t('chart.resetToOriginal')}
              data-tutorial="chart-reset-selected"
            >
              <RotateCcw size={16} />
            </button>
          )}
          {/* Delete selected */}
          {selectedPoint && (
            <button
              onClick={() => deleteSelectedPoint()}
              className="p-3 md:p-1.5 rounded transition-colors touch-manipulation text-red-400 hover:bg-red-500/15"
              title={t('chart.deleteSelected')}
              data-tutorial="chart-delete-selected"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      )}

      {/* Zoom indicator */}
      <div className="absolute top-3 right-3 flex flex-row items-center gap-1 px-2 py-1 rounded-md bg-surface/80 backdrop-blur-sm border border-border text-xs font-mono text-text-muted" data-tutorial="chart-zoom-controls">
        <button
          onClick={() => {
            const { zoom: z, panX: px, panY: py } = useEditorStore.getState();
            const next = Math.max(MIN_ZOOM, z - ZOOM_STEP);
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const cx = rect.width / 2, cy = rect.height / 2;
              const chartX = px + cx / z, chartY = py + cy / z;
              clampedPan(chartX - cx / next, chartY - cy / next, next);
            }
            setZoom(next);
          }}
          className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors hidden sm:block"
        >
          −
        </button>
        <span className="w-10 text-center hidden sm:block">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => {
            const { zoom: z, panX: px, panY: py } = useEditorStore.getState();
            const next = Math.min(MAX_ZOOM, z + ZOOM_STEP);
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const cx = rect.width / 2, cy = rect.height / 2;
              const chartX = px + cx / z, chartY = py + cy / z;
              clampedPan(chartX - cx / next, chartY - cy / next, next);
            }
            setZoom(next);
          }}
          className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors hidden sm:block"
        >
          +
        </button>
        <span className="w-px h-4 bg-border mx-0.5 hidden sm:block" />
        <PxPerSecondButton />
        <span className="w-px h-4 bg-border mx-0.5" />
        <button
          onClick={() => setExportDialogOpen(true)}
          className="px-2 py-1 rounded hover:text-text-primary hover:bg-cosmos-700 transition-colors"
          title={t('chart.exportChart')}
        >
          <Download size={14} />
        </button>
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

      {/* Hi-Speed mark dialog */}
      {pendingHs && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <div className="bg-cosmos-800 border border-cosmos-600 rounded-lg p-4 flex flex-col gap-3 min-w-[200px]">
            <div className="text-xs font-medium text-text-primary">Add Speed Change Mark</div>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-text-muted">Hi-Speed</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.1"
                max="20.0"
                step="0.1"
                autoFocus
                value={hsInput.hs}
                onChange={(e) => setHsInput((p) => ({ ...p, hs: e.target.value }))}
                onBlur={() => { const v = parseFloat(hsInput.hs); if (!isNaN(v)) setHsInput((p) => ({ ...p, hs: Math.min(20, Math.max(0.1, v)).toFixed(1) })); }}
                className="px-2 py-1 rounded bg-cosmos-900 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-blue-400/50"
                placeholder="0.1-20.0"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-text-muted">Speed Change Duration (ms)</span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                value={hsInput.dur}
                onChange={(e) => setHsInput((p) => ({ ...p, dur: e.target.value }))}
                className="px-2 py-1 rounded bg-cosmos-900 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-blue-400/50"
                placeholder="e.g. 500"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingHs(null)}
                className="px-3 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const hs = parseFloat(hsInput.hs);
                  const dur = parseFloat(hsInput.dur);
                  if (!isNaN(hs) && hs >= 0.1 && hs <= 20 && !isNaN(dur) && dur > 0) {
                    useEditorStore.getState().addHiSpeedMark({ time: pendingHs.time, durationMs: dur, hiSpeed: Math.min(20, Math.max(0.1, hs)) });
                  }
                  setPendingHs(null);
                }}
                className="px-3 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hi-Speed mark edit dialog */}
      {editingHs && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
          <div className="bg-cosmos-800 border border-cosmos-600 rounded-lg p-4 flex flex-col gap-3 min-w-[200px]">
            <div className="text-xs font-medium text-text-primary">Edit Speed Change Mark</div>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-text-muted">Hi-Speed</span>
              <input
                type="number"
                inputMode="decimal"
                min="0.1"
                max="20.0"
                step="0.1"
                autoFocus
                value={editHsInput.hs}
                onChange={(e) => setEditHsInput((p) => ({ ...p, hs: e.target.value }))}
                onBlur={() => { const v = parseFloat(editHsInput.hs); if (!isNaN(v)) setEditHsInput((p) => ({ ...p, hs: Math.min(20, Math.max(0.1, v)).toFixed(1) })); }}
                className="px-2 py-1 rounded bg-cosmos-900 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-blue-400/50"
                placeholder="0.1-20.0"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-text-muted">Speed Change Duration (ms)</span>
              <input
                type="number"
                inputMode="numeric"
                step="1"
                value={editHsInput.dur}
                onChange={(e) => setEditHsInput((p) => ({ ...p, dur: e.target.value }))}
                className="px-2 py-1 rounded bg-cosmos-900 border border-cosmos-600 text-base font-mono text-text-primary outline-none focus:border-blue-400/50"
                placeholder="e.g. 500"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingHs(null)}
                className="px-3 py-1 rounded text-xs text-text-muted hover:text-text-primary hover:bg-cosmos-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const hs = parseFloat(editHsInput.hs);
                  const dur = parseFloat(editHsInput.dur);
                  if (!isNaN(hs) && hs >= 0.1 && hs <= 20 && !isNaN(dur) && dur > 0) {
                    useEditorStore.getState().updateHiSpeedMark(editingHs.index, { hiSpeed: Math.min(20, Math.max(0.1, hs)), durationMs: dur });
                  }
                  setEditingHs(null);
                }}
                className="px-3 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export dialog */}
      <ExportDialog
        isOpen={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        maxMeasure={getMaxMeasure()}
      />
    </div>
  );
}
