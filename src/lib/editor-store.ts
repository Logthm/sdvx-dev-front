/**
 * Zustand store — viewer state for chart rendering.
 *
 * Supports two modes:
 *   - "preview": displays a backend-rendered image (default)
 *   - "edit":    simplified frontend canvas rendering
 */

import { applyEdits, DEFAULT_EDIT_FLAGS, moveLaserPoint, deleteLaserPoint as deleteLP, moveButtonEvent, deleteButtonEvent, addButtonEvent, type EditFlags } from "@/lib/chart-edit";
import type { ButtonEvent, ChartData, TimePos } from "@/types/chart";
import { create } from "zustand";

export type ViewMode = "preview" | "edit";

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
  laserLColor: "BLUE",
  laserRColor: "RED",
  pxPerSecond: 600,
  columnHeight: 2800,
};

export type { EditFlags };

export type DragRange = "off" | "s-critical" | "critical" | "near";

export const DRAG_RANGE_MS: Record<DragRange, number> = {
  "off": Infinity,
  "s-critical": 20.833,
  "critical": 41.667,
  "near": 150,
};

export type MouseTool = "pan" | "add-bt" | "add-fx" | "add-hispeed" | "move";

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

  setOriginalChartData: (data: ChartData) => void;
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
  pushHistory: () => void;
  updateLaserPoint: (track: string, index: number, newTime: TimePos, newOffset: number) => void;
  updateButtonTime: (track: string, index: number, newTime: TimePos) => void;
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
}

export const useEditorStore = create<EditorState>((set) => ({
  originalChartData: null,
  chartData: null,
  editFlags: { ...DEFAULT_EDIT_FLAGS },
  mode: "preview",
  renderOptions: { ...DEFAULT_RENDER_OPTIONS },
  history: [],
  editVersion: 0,
  dragRange: "off" as DragRange,
  mouseTool: "pan" as MouseTool,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  viewInitialized: false,
  mobileFullscreen: false,
  toggleMobileFullscreen: () => set((s) => ({ mobileFullscreen: !s.mobileFullscreen })),

  setOriginalChartData: (data) =>
    set((s) => ({
      originalChartData: data,
      chartData: applyEdits(data, s.editFlags),
      editVersion: 0,
      history: [],
    })),

  setChartData: (data) => set({ chartData: data }),

  toggleEdit: (flag) =>
    set((s) => {
      const newFlags = { ...s.editFlags, [flag]: !s.editFlags[flag] };
      return {
        editFlags: newFlags,
        chartData: s.originalChartData
          ? applyEdits(s.originalChartData, newFlags)
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
      return {
        history: [],
        chartData: applyEdits(s.originalChartData, s.editFlags),
        selectedPoint: null,
        editVersion: 0,
      };
    }),

  resetSelectedPoint: () =>
    set((s) => {
      if (!s.chartData || !s.selectedPoint || !s.originalChartData) return s;
      const { type, track, index } = s.selectedPoint;
      if (type === "button") {
        const origEv = s.originalChartData.tracks[track]?.[index];
        if (!origEv || origEv.type !== "button") return s;
        return {
          history: [...s.history, s.chartData],
          chartData: moveButtonEvent(s.chartData, track, index, origEv.time),
          editVersion: s.editVersion + 1,
        };
      }
      if (type === "laser") {
        const origChart = applyEdits(s.originalChartData, s.editFlags);
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
    set((s) => ({ renderOptions: { ...s.renderOptions, ...opts } })),

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
}));
