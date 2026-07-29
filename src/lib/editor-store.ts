/**
 * Zustand store — viewer state for chart rendering.
 *
 * Supports two modes:
 *   - "preview": displays a backend-rendered image (default)
 *   - "edit":    simplified frontend canvas rendering
 */

import { applyEdits, applyArrangement, DEFAULT_EDIT_FLAGS, moveLaserPoint, deleteLaserPoint as deleteLP, moveButtonEvent, deleteButtonEvent, addButtonEvent, updateButtonHoldLen as setHoldLen, type EditFlags } from "@/lib/chart-edit";
import { computeMaxPxPerSecond } from "@/lib/chart-renderer/layout";
import type { ButtonEvent, ChartData, TimePos } from "@/types/chart";
import { create } from "zustand";

export type ViewMode = "preview" | "edit" | "play";

export type LaserColor = "BLUE" | "RED" | "GREEN" | "YELLOW";
export type ArrangementMode = "normal" | "mirror" | "random" | "s-random";
export type BtTrack = "BT-A" | "BT-B" | "BT-C" | "BT-D";

export interface RenderOptions {
  arrangementMode: ArrangementMode;
  /** Explicit BT lane order (positions 0-3 = left to right on screen) */
  btOrder: [BtTrack, BtTrack, BtTrack, BtTrack];
  /** Swap FX-L and FX-R */
  fxSwap: boolean;
  /** Mirror lasers (swap L/R + invert offsets) */
  mirrorLaser: boolean;
  /** Random seed for s-random (ensures preview and edit use the same arrangement) */
  rngSeed: number | null;
  laserLColor: LaserColor;
  laserRColor: LaserColor;
  pxPerSecond: number;
  columnHeight: number;
}

export const DEFAULT_BT_ORDER: [BtTrack, BtTrack, BtTrack, BtTrack] = [
  "BT-A",
  "BT-B",
  "BT-C",
  "BT-D",
];

export const DEFAULT_RENDER_OPTIONS: RenderOptions = {
  arrangementMode: "normal",
  btOrder: [...DEFAULT_BT_ORDER],
  fxSwap: false,
  mirrorLaser: false,
  rngSeed: null,
  laserLColor: "BLUE",
  laserRColor: "RED",
  pxPerSecond: 300,
  columnHeight: 1400,
};

export type { EditFlags };

export type DragRange = "off" | "s-critical" | "critical" | "near" | "error";

/**
 * Allowed drag window relative to a note's original position, in milliseconds.
 *
 * `early` = how far the note may move to an earlier time (dragging down the lane),
 * `late`  = how far it may move to a later time (dragging up).
 *
 * "error" is asymmetric on purpose: only early errors are reproducible by
 * dragging, so the note can be pulled up to 233.33ms earlier and never later.
 */
export interface DragBounds {
  early: number;
  late: number;
}

export const DRAG_RANGE_BOUNDS: Record<DragRange, DragBounds> = {
  "off": { early: Infinity, late: Infinity },
  "s-critical": { early: 20.833, late: 20.833 },
  "critical": { early: 41.667, late: 41.667 },
  "near": { early: 133.33333, late: 133.33333 },
  "error": { early: 233.33333, late: 0 },
};

/** Clamp a dragged timestamp (seconds) to the active drag range around `origSec`. */
export function clampDragSec(sec: number, origSec: number, range: DragRange): number {
  const { early, late } = DRAG_RANGE_BOUNDS[range];
  const lo = early === Infinity ? -Infinity : origSec - early / 1000;
  const hi = late === Infinity ? Infinity : origSec + late / 1000;
  return Math.max(lo, Math.min(hi, sec));
}

export type MouseTool = "pan" | "add-bt" | "add-fx" | "add-hispeed" | "move" | "edit-hs";

export type BpmDisplayMode = "bpm" | "hispeed" | "speed";

export interface HiSpeedMark {
  time: [number, number, number];
  durationMs: number;
  hiSpeed: number;
}

export interface SelectedPoint {
  type: "laser" | "button" | "hispeed";
  track: string;
  index: number;
}

export interface IntervalInfo {
  ms: number;
  notation: string;
}

export interface EditorState {
  originalChartData: ChartData | null;
  /** Backend-arranged chart data (for s-random / backend arrangement modes). */
  arrangedBaseData: ChartData | null;
  chartData: ChartData | null;
  editFlags: EditFlags;
  mode: ViewMode;
  renderOptions: RenderOptions;
  history: ChartData[];
  /** Increments on every manual chart mutation; reset when original data is loaded or chart is fully reset. */
  editVersion: number;

  zoom: number;
  panX: number;
  panY: number;
  viewInitialized: boolean;

  mobileFullscreen: boolean;
  toggleMobileFullscreen: () => void;

  /** Safe upper bound for px_per_second, computed by the backend from chart BPM data. */
  maxPxPerSecond: number | null;
  setMaxPxPerSecond: (v: number | null) => void;

  setOriginalChartData: (data: ChartData) => void;
  /** Set backend-arranged chart data (e.g. s-random result). Recomputes chartData from this base. */
  setArrangedBaseData: (data: ChartData) => void;
  /** Clear arranged base data (when switching back to normal/frontend-handled modes). */
  clearArrangedBaseData: () => void;
  setChartData: (data: ChartData) => void;
  toggleEdit: (flag: keyof EditFlags) => void;
  setMode: (mode: ViewMode) => void;
  setRenderOptions: (opts: Partial<RenderOptions>) => void;
  selectedPoint: SelectedPoint | null;
  setSelectedPoint: (p: SelectedPoint | null) => void;
  clearSelectedPoint: () => void;
  firstSelectedNote: SelectedPoint | null;
  setFirstSelectedNote: (p: SelectedPoint | null) => void;
  intervalInfo: IntervalInfo | null;
  setIntervalInfo: (info: IntervalInfo | null) => void;
  dragRange: DragRange;
  setDragRange: (r: DragRange) => void;
  mouseTool: MouseTool;
  setMouseTool: (t: MouseTool) => void;
  expandedTool: "drag" | "add" | null;
  setExpandedTool: (t: "drag" | "add" | null) => void;
  pushHistory: () => void;
  updateLaserPoint: (track: string, index: number, newTime: TimePos, newOffset: number) => void;
  updateButtonTime: (track: string, index: number, newTime: TimePos) => void;
  updateButtonHoldLen: (track: string, index: number, holdLen: number) => void;
  deleteSelectedPoint: () => void;
  addButton: (trackNum: number, event: ButtonEvent) => void;
  undo: () => void;
  resetAll: () => void;
  resetSelectedPoint: () => void;

  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  setViewInitialized: (v: boolean) => void;

  speed: number;
  setSpeed: (speed: number) => void;

  hiSpeedMarks: HiSpeedMark[];
  addHiSpeedMark: (mark: HiSpeedMark) => void;
  removeHiSpeedMark: (index: number) => void;
  updateHiSpeedMarkTime: (index: number, time: [number, number, number]) => void;
  updateHiSpeedMark: (index: number, patch: Partial<HiSpeedMark>) => void;

  bpmDisplayMode: BpmDisplayMode;
  setBpmDisplayMode: (mode: BpmDisplayMode) => void;

  previewSimplifyLasers: boolean;
  setPreviewSimplifyLasers: (v: boolean) => void;

  previewIntervalActive: boolean;
  setPreviewIntervalActive: (v: boolean) => void;
  previewIntervalFirstTime: [number, number, number] | null;
  setPreviewIntervalFirstTime: (t: [number, number, number] | null) => void;

  showHoldJudgement: boolean;
  setShowHoldJudgement: (v: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  originalChartData: null,
  arrangedBaseData: null,
  chartData: null,
  editFlags: { ...DEFAULT_EDIT_FLAGS },
  mode: "preview",
  renderOptions: { ...DEFAULT_RENDER_OPTIONS },
  history: [],
  editVersion: 0,
  dragRange: "off" as DragRange,
  mouseTool: "pan" as MouseTool,
  expandedTool: null,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  viewInitialized: false,
  mobileFullscreen: false,
  toggleMobileFullscreen: () => set((s) => ({ mobileFullscreen: !s.mobileFullscreen })),

  maxPxPerSecond: null,
  setMaxPxPerSecond: (v) =>
    set((s) => {
      const next: Partial<EditorState> = { maxPxPerSecond: v };
      if (v !== null && s.renderOptions.pxPerSecond > v) {
        next.renderOptions = { ...s.renderOptions, pxPerSecond: v };
      }
      return next;
    }),

  setOriginalChartData: (data) =>
    set((s) => {
      const frontendMax = computeMaxPxPerSecond(data, s.renderOptions.columnHeight);
      const effectiveMax = Math.min(frontendMax, 2000);
      const clamped = Math.min(s.renderOptions.pxPerSecond, effectiveMax);
      const renderOptions = clamped !== s.renderOptions.pxPerSecond
        ? { ...s.renderOptions, pxPerSecond: clamped }
        : s.renderOptions;
      return {
        originalChartData: data,
        arrangedBaseData: null,
        chartData: applyArrangement(applyEdits(data, s.editFlags), renderOptions),
        editVersion: 0,
        history: [],
        maxPxPerSecond: null,
        renderOptions,
      };
    }),

  setArrangedBaseData: (data) =>
    set((s) => ({
      arrangedBaseData: data,
      chartData: applyEdits(data, s.editFlags),
      editVersion: 0,
      history: [],
      selectedPoint: null,
    })),

  clearArrangedBaseData: () =>
    set((s) => ({
      arrangedBaseData: null,
      chartData: s.originalChartData
        ? applyArrangement(applyEdits(s.originalChartData, s.editFlags), s.renderOptions)
        : null,
      editVersion: 0,
      history: [],
      selectedPoint: null,
    })),

  setChartData: (data) => set({ chartData: data }),

  toggleEdit: (flag) =>
    set((s) => {
      const newFlags = { ...s.editFlags, [flag]: !s.editFlags[flag] };
      const base = s.arrangedBaseData ?? s.originalChartData;
      return {
        editFlags: newFlags,
        chartData: base
          ? (s.arrangedBaseData
              ? applyEdits(base, newFlags)
              : applyArrangement(applyEdits(base, newFlags), s.renderOptions))
          : null,
        ...(!newFlags.simplifyLasers && { selectedPoint: null, history: [] }),
      };
    }),

  selectedPoint: null,

  setSelectedPoint: (p) => set({ selectedPoint: p }),
  clearSelectedPoint: () => set({ selectedPoint: null }),
  firstSelectedNote: null,
  setFirstSelectedNote: (p) => set({ firstSelectedNote: p }),
  intervalInfo: null,
  setIntervalInfo: (info) => set({ intervalInfo: info }),
  setDragRange: (r) => set({ dragRange: r }),
  setMouseTool: (t) => set({ mouseTool: t }),
  setExpandedTool: (t) => set({ expandedTool: t }),

  pushHistory: () =>
    set((s) => s.chartData ? { history: [...s.history, s.chartData] } : s),

  updateLaserPoint: (track, index, newTime, newOffset) =>
    set((s) => {
      if (!s.chartData) return s;
      const updated = moveLaserPoint(s.chartData, track, index, newTime, newOffset);
      return { chartData: updated, editVersion: s.editVersion + 1 };
    }),

  updateButtonTime: (track, index, newTime) =>
    set((s) => {
      if (!s.chartData) return s;
      return { chartData: moveButtonEvent(s.chartData, track, index, newTime), editVersion: s.editVersion + 1 };
    }),

  updateButtonHoldLen: (track, index, holdLen) =>
    set((s) => {
      if (!s.chartData) return s;
      return { history: [...s.history, s.chartData], chartData: setHoldLen(s.chartData, track, index, holdLen), editVersion: s.editVersion + 1 };
    }),

  deleteSelectedPoint: () =>
    set((s) => {
      if (!s.selectedPoint) return s;
      const { type, index } = s.selectedPoint;
      if (type === "hispeed") {
        return { hiSpeedMarks: s.hiSpeedMarks.filter((_, i) => i !== index), selectedPoint: null };
      }
      if (!s.chartData) return s;
      const { track } = s.selectedPoint;
      const updated = type === "laser"
        ? deleteLP(s.chartData, track, index)
        : deleteButtonEvent(s.chartData, track, index);
      return {
        history: [...s.history, s.chartData],
        chartData: updated, selectedPoint: null,
        editVersion: s.editVersion + 1,
      };
    }),

  addButton: (trackNum, event) =>
    set((s) => {
      if (!s.chartData) return s;
      return {
        history: [...s.history, s.chartData],
        chartData: addButtonEvent(s.chartData, trackNum, event),
        editVersion: s.editVersion + 1,
      };
    }),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return s;
      const prev = s.history[s.history.length - 1];
      return {
        history: s.history.slice(0, -1),
        chartData: prev, selectedPoint: null,
        editVersion: s.editVersion + 1,
      };
    }),

  resetAll: () =>
    set((s) => {
      if (!s.originalChartData || s.history.length === 0) return s;
      const base = s.arrangedBaseData ?? s.originalChartData;
      return {
        history: [],
        chartData: s.arrangedBaseData
          ? applyEdits(base, s.editFlags)
          : applyArrangement(applyEdits(base, s.editFlags), s.renderOptions),
        selectedPoint: null,
        editVersion: 0,
      };
    }),

  resetSelectedPoint: () =>
    set((s) => {
      if (!s.chartData || !s.selectedPoint || !s.originalChartData) return s;
      const base = s.arrangedBaseData ?? s.originalChartData;
      const { type, track, index } = s.selectedPoint;
      if (type === "button") {
        const origEv = base.tracks[track]?.[index];
        if (!origEv || origEv.type !== "button") return s;
        let cd = moveButtonEvent(s.chartData, track, index, origEv.time);
        cd = setHoldLen(cd, track, index, origEv.hold_len);
        return {
          history: [...s.history, s.chartData],
          chartData: cd,
          editVersion: s.editVersion + 1,
        };
      }
      if (type === "laser") {
        const origChart = applyEdits(base, s.editFlags);
        const origLasers = (origChart.tracks[track] ?? []).filter(e => e.type === "laser");
        const origEv = origLasers[index];
        if (!origEv || origEv.type !== "laser") return s;
        return {
          history: [...s.history, s.chartData],
          chartData: moveLaserPoint(s.chartData, track, index, origEv.time, origEv.offset),
          editVersion: s.editVersion + 1,
        };
      }
      return s;
    }),

  setMode: (mode) => set({ mode, selectedPoint: null }),

  setRenderOptions: (opts) =>
    set((s) => {
      const newOpts = { ...s.renderOptions, ...opts };
      // Check if arrangement-related options changed
      const arrChanged =
        newOpts.arrangementMode !== s.renderOptions.arrangementMode ||
        newOpts.mirrorLaser !== s.renderOptions.mirrorLaser ||
        newOpts.fxSwap !== s.renderOptions.fxSwap ||
        newOpts.rngSeed !== s.renderOptions.rngSeed ||
        newOpts.btOrder.some((v, i) => v !== s.renderOptions.btOrder[i]);
      if (arrChanged && s.originalChartData) {
        return {
          renderOptions: newOpts,
          // Clear arranged base — component will re-fetch if needed (e.g. s-random)
          arrangedBaseData: null,
          chartData: applyArrangement(applyEdits(s.originalChartData, s.editFlags), newOpts),
          history: [],
          selectedPoint: null,
          editVersion: 0,
        };
      }
      return { renderOptions: newOpts };
    }),

  setZoom: (zoom) => set({ zoom }),

  setPan: (panX, panY) => set({ panX, panY }),

  setViewInitialized: (v) => set({ viewInitialized: v }),

  speed: 0,
  setSpeed: (speed) => set({ speed }),

  hiSpeedMarks: [],
  addHiSpeedMark: (mark) => set((s) => ({ hiSpeedMarks: [...s.hiSpeedMarks, mark] })),
  removeHiSpeedMark: (index) => set((s) => ({ hiSpeedMarks: s.hiSpeedMarks.filter((_, i) => i !== index) })),
  updateHiSpeedMarkTime: (index, time) => set((s) => ({
    hiSpeedMarks: s.hiSpeedMarks.map((m, i) => i === index ? { ...m, time } : m),
  })),
  updateHiSpeedMark: (index, patch) => set((s) => ({
    hiSpeedMarks: s.hiSpeedMarks.map((m, i) => i === index ? { ...m, ...patch } : m),
  })),

  bpmDisplayMode: "bpm" as BpmDisplayMode,
  setBpmDisplayMode: (mode) => set({ bpmDisplayMode: mode }),

  previewSimplifyLasers: false,
  setPreviewSimplifyLasers: (v) => set({ previewSimplifyLasers: v }),

  previewIntervalActive: false,
  setPreviewIntervalActive: (v) => set({ previewIntervalActive: v, previewIntervalFirstTime: null, intervalInfo: null }),
  previewIntervalFirstTime: null,
  setPreviewIntervalFirstTime: (t) => set({ previewIntervalFirstTime: t }),

  showHoldJudgement: false,
  setShowHoldJudgement: (v) => set({ showHoldJudgement: v }),
}));
