import { computeLayout } from "@/lib/chart-renderer/layout";
import type { ChartData } from "@/types/chart";
import { describe, expect, it } from "vitest";
import { useEditorStore, type HiSpeedMark } from "./editor-store";
import {
  createChartInteractionSession,
  createChartViewportGestureSession,
  findChartInteractionTarget,
} from "./chart-interaction";

function createChart(tracks: ChartData["tracks"]): ChartData {
  return {
    format_version: 12,
    beat_resolution: 48,
    bpm_info: [{ measure: 1, beat: 1, cell: 0, bpm: 120 }],
    beat_info: [
      { measure: 1, beat: 1, cell: 0, numerator: 4, denominator: 4 },
    ],
    end_position: { measure: 2, beat: 1, cell: 0 },
    max_measure: 2,
    tracks,
  };
}

describe("chart interaction targeting", () => {
  it("targets a BT note body under the pointer", () => {
    const chart = createChart({
      "3": [
        {
          type: "button",
          track_name: "BT-A",
          time: [1, 2, 0],
          hold_len: 0,
        },
      ],
    });

    expect(findChartInteractionTarget({
      point: { x: 111, y: 440 },
      pointer: { type: "mouse", zoom: 1 },
      tool: "move",
      simplifyLasers: false,
      chart,
      layout: computeLayout(chart, 100, 500),
      hiSpeedMarks: [],
    })).toEqual({ type: "button", track: "3", index: 0, col: 0 });
  });

  it("targets a simplified laser node under the pointer", () => {
    const chart = createChart({
      "1": [
        {
          type: "laser",
          track_name: "LASER-L",
          time: [1, 2, 0],
          offset: 0.5,
          flag: 1,
          is_out_of_bounds: false,
        },
      ],
    });

    expect(findChartInteractionTarget({
      point: { x: 136.5, y: 440 },
      pointer: { type: "mouse", zoom: 1 },
      tool: "move",
      simplifyLasers: true,
      chart,
      layout: computeLayout(chart, 100, 500),
      hiSpeedMarks: [],
    })).toEqual({ type: "laser", track: "1", index: 0, col: 0 });
  });

  it("targets the tail of a hold note", () => {
    const chart = createChart({
      "3": [
        {
          type: "button",
          track_name: "BT-A",
          time: [1, 2, 0],
          hold_len: 48,
        },
      ],
    });

    expect(findChartInteractionTarget({
      point: { x: 111, y: 390 },
      pointer: { type: "mouse", zoom: 1 },
      tool: "move",
      simplifyLasers: false,
      chart,
      layout: computeLayout(chart, 100, 500),
      hiSpeedMarks: [],
    })).toEqual({ type: "hold-tail", track: "3", index: 0, col: 0 });
  });

  it("targets a hi-speed text label", () => {
    const chart = createChart({});

    expect(findChartInteractionTarget({
      point: { x: 20, y: 430 },
      pointer: { type: "mouse", zoom: 1 },
      tool: "move",
      simplifyLasers: false,
      chart,
      layout: computeLayout(chart, 100, 500),
      hiSpeedMarks: [{ time: [1, 2, 0] }],
    })).toEqual({ type: "hispeed-text", index: 0, col: 0 });
  });

  it("targets a hi-speed marker line", () => {
    const chart = createChart({});

    expect(findChartInteractionTarget({
      point: { x: 100, y: 440 },
      pointer: { type: "mouse", zoom: 1 },
      tool: "move",
      simplifyLasers: false,
      chart,
      layout: computeLayout(chart, 100, 500),
      hiSpeedMarks: [{ time: [1, 2, 0] }],
    })).toEqual({ type: "hispeed-line", index: 0, col: 0 });
  });

  it("uses button-body priority for touch when a hold tail overlaps", () => {
    const chart = createChart({
      "3": [
        {
          type: "button",
          track_name: "BT-A",
          time: [1, 1, 0],
          hold_len: 48,
        },
        {
          type: "button",
          track_name: "BT-A",
          time: [1, 2, 0],
          hold_len: 0,
        },
      ],
    });

    expect(findChartInteractionTarget({
      point: { x: 111, y: 440 },
      pointer: { type: "touch", zoom: 1 },
      tool: "move",
      simplifyLasers: false,
      chart,
      layout: computeLayout(chart, 100, 500),
      hiSpeedMarks: [],
    })).toEqual({ type: "button", track: "3", index: 1, col: 0 });
  });

  it("targets editable notes instead of laser nodes with the hi-speed tool", () => {
    const chart = createChart({
      "1": [
        {
          type: "laser",
          track_name: "LASER-L",
          time: [1, 2, 0],
          offset: 0.5,
          flag: 1,
          is_out_of_bounds: false,
        },
      ],
      "2": [
        {
          type: "button",
          track_name: "FX-L",
          time: [1, 2, 0],
          hold_len: 0,
        },
      ],
    });

    expect(findChartInteractionTarget({
      point: { x: 136.5, y: 440 },
      pointer: { type: "mouse", zoom: 1 },
      tool: "edit-hs",
      simplifyLasers: true,
      chart,
      layout: computeLayout(chart, 100, 500),
      hiSpeedMarks: [],
    })).toEqual({ type: "button", track: "2", index: 0, col: 0 });
  });
});

describe("chart interaction sessions", () => {
  it("undoes a button drag with several moves as one gesture", () => {
    const chart = createChart({
      "3": [
        {
          type: "button",
          track_name: "BT-A",
          time: [1, 2, 0],
          hold_len: 48,
        },
      ],
    });
    const layout = computeLayout(chart, 100, 500);
    useEditorStore.getState().setOriginalChartData(chart);
    useEditorStore.getState().setMouseTool("move");

    const interaction = createChartInteractionSession();
    interaction.handle({
      type: "pointer-down",
      input: {
        point: { x: 111, y: 440 },
        pointer: { type: "mouse", zoom: 1 },
        tool: "move",
        simplifyLasers: false,
        chart,
        layout,
        hiSpeedMarks: [],
      },
    });
    interaction.handle({ type: "pointer-move", point: { x: 111, y: 430 } });
    interaction.handle({ type: "pointer-move", point: { x: 111, y: 420 } });
    interaction.handle({ type: "pointer-up" });

    expect(useEditorStore.getState().chartData).not.toEqual(chart);

    useEditorStore.getState().undo();

    expect(useEditorStore.getState().chartData).toEqual(chart);
  });

  it("undoes a simplified laser drag with several moves as one gesture", () => {
    const chart = createChart({
      "1": [
        {
          type: "laser",
          track_name: "LASER-L",
          time: [1, 2, 0],
          offset: 0.5,
          flag: 1,
          is_out_of_bounds: false,
        },
      ],
    });
    const layout = computeLayout(chart, 100, 500);
    useEditorStore.getState().setOriginalChartData(chart);
    useEditorStore.getState().setMouseTool("move");

    const interaction = createChartInteractionSession();
    interaction.handle({
      type: "pointer-down",
      input: {
        point: { x: 136.5, y: 440 },
        pointer: { type: "mouse", zoom: 1 },
        tool: "move",
        simplifyLasers: true,
        chart,
        layout,
        hiSpeedMarks: [],
      },
    });
    interaction.handle({ type: "pointer-move", point: { x: 145, y: 430 } });
    interaction.handle({ type: "pointer-move", point: { x: 150, y: 420 } });
    interaction.handle({ type: "pointer-up" });

    expect(useEditorStore.getState().chartData).not.toEqual(chart);

    useEditorStore.getState().undo();

    expect(useEditorStore.getState().chartData).toEqual(chart);
  });

  it("undoes several hold-tail adjustments as one gesture", () => {
    const chart = createChart({
      "3": [
        {
          type: "button",
          track_name: "BT-A",
          time: [1, 2, 0],
          hold_len: 48,
        },
      ],
    });
    const layout = computeLayout(chart, 100, 500);
    useEditorStore.getState().setOriginalChartData(chart);
    useEditorStore.getState().setMouseTool("move");

    const interaction = createChartInteractionSession();
    interaction.handle({
      type: "pointer-down",
      input: {
        point: { x: 111, y: 390 },
        pointer: { type: "mouse", zoom: 1 },
        tool: "move",
        simplifyLasers: false,
        chart,
        layout,
        hiSpeedMarks: [],
      },
    });
    interaction.handle({ type: "pointer-move", point: { x: 111, y: 380 } });
    interaction.handle({ type: "pointer-move", point: { x: 111, y: 370 } });
    interaction.handle({ type: "pointer-up" });

    expect(useEditorStore.getState().chartData).not.toEqual(chart);

    useEditorStore.getState().undo();

    expect(useEditorStore.getState().chartData).toEqual(chart);
  });

  it("undoes several hi-speed marker moves as one gesture", () => {
    const chart = createChart({});
    const mark: HiSpeedMark = {
      time: [1, 2, 0],
      durationMs: 500,
      hiSpeed: 2,
    };
    const layout = computeLayout(chart, 100, 500);
    useEditorStore.getState().setOriginalChartData(chart);
    while (useEditorStore.getState().hiSpeedMarks.length > 0) {
      useEditorStore.getState().removeHiSpeedMark(0);
    }
    useEditorStore.getState().addHiSpeedMark(mark);

    const interaction = createChartInteractionSession();
    interaction.handle({
      type: "pointer-down",
      input: {
        point: { x: 20, y: 430 },
        pointer: { type: "mouse", zoom: 1 },
        tool: "move",
        simplifyLasers: false,
        chart,
        layout,
        hiSpeedMarks: [mark],
      },
    });
    interaction.handle({ type: "pointer-move", point: { x: 20, y: 420 } });
    interaction.handle({ type: "pointer-move", point: { x: 20, y: 410 } });
    interaction.handle({ type: "pointer-up" });

    expect(useEditorStore.getState().hiSpeedMarks[0]?.time).not.toEqual(mark.time);

    useEditorStore.getState().undo();

    expect(useEditorStore.getState().hiSpeedMarks[0]).toEqual(mark);
  });

  it("stops an active drag when the pointer is cancelled", () => {
    const chart = createChart({
      "3": [
        {
          type: "button",
          track_name: "BT-A",
          time: [1, 2, 0],
          hold_len: 0,
        },
      ],
    });
    const layout = computeLayout(chart, 100, 500);
    useEditorStore.getState().setOriginalChartData(chart);

    const interaction = createChartInteractionSession();
    interaction.handle({
      type: "pointer-down",
      input: {
        point: { x: 111, y: 440 },
        pointer: { type: "mouse", zoom: 1 },
        tool: "move",
        simplifyLasers: false,
        chart,
        layout,
        hiSpeedMarks: [],
      },
    });
    interaction.handle({ type: "pointer-move", point: { x: 111, y: 430 } });
    interaction.handle({ type: "pointer-cancel" });
    const chartAfterCancel = useEditorStore.getState().chartData;

    interaction.handle({ type: "pointer-move", point: { x: 111, y: 410 } });

    expect(useEditorStore.getState().chartData).toBe(chartAfterCancel);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().chartData).toEqual(chart);
  });

  it("undoes a touch button drag with several moves as one gesture", () => {
    const chart = createChart({
      "3": [
        {
          type: "button",
          track_name: "BT-A",
          time: [1, 2, 0],
          hold_len: 0,
        },
      ],
    });
    const layout = computeLayout(chart, 100, 500);
    useEditorStore.getState().setOriginalChartData(chart);

    const interaction = createChartInteractionSession();
    interaction.handle({
      type: "pointer-down",
      input: {
        point: { x: 111, y: 440 },
        pointer: { type: "touch", zoom: 1 },
        tool: "move",
        simplifyLasers: false,
        chart,
        layout,
        hiSpeedMarks: [],
      },
    });
    interaction.handle({ type: "pointer-move", point: { x: 111, y: 430 } });
    interaction.handle({ type: "pointer-move", point: { x: 111, y: 420 } });
    interaction.handle({ type: "pointer-up" });

    expect(useEditorStore.getState().chartData).not.toEqual(chart);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().chartData).toEqual(chart);
  });
});

describe("chart viewport gesture sessions", () => {
  it("reports pan deltas across a single-pointer gesture", () => {
    const gestures = createChartViewportGestureSession();

    expect(gestures.handle({
      type: "pointer-down",
      pointerId: 7,
      point: { x: 100, y: 100 },
      mode: "pan",
    })).toEqual({ type: "start-pan" });

    expect(gestures.handle({
      type: "pointer-move",
      pointerId: 7,
      point: { x: 80, y: 130 },
    })).toEqual({
      type: "pan",
      delta: { x: -20, y: 30 },
    });

    expect(gestures.handle({ type: "pointer-up", pointerId: 7 })).toEqual({
      type: "none",
    });
  });

  it("cancels a single-pointer interaction and reports pinch changes", () => {
    const gestures = createChartViewportGestureSession();
    expect(gestures.handle({
      type: "pointer-down",
      pointerId: 1,
      point: { x: 0, y: 0 },
      mode: "interaction",
    })).toEqual({ type: "start-interaction" });

    expect(gestures.handle({
      type: "pointer-down",
      pointerId: 2,
      point: { x: 100, y: 0 },
      mode: "interaction",
    })).toEqual({ type: "cancel-interaction" });

    expect(gestures.handle({
      type: "pointer-move",
      pointerId: 2,
      point: { x: 120, y: 0 },
    })).toEqual({
      type: "pinch",
      center: { x: 60, y: 0 },
      translation: { x: 10, y: 0 },
      scale: 1.2,
    });
  });
});
