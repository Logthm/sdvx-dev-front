import { describe, expect, it } from "vitest";
import type { ChartData } from "@/types/chart";
import { clampDragSec, useEditorStore } from "./editor-store";

const chart: ChartData = {
  format_version: 12,
  beat_resolution: 48,
  bpm_info: [{ measure: 1, beat: 1, cell: 0, bpm: 120 }],
  beat_info: [
    { measure: 1, beat: 1, cell: 0, numerator: 4, denominator: 4 },
  ],
  end_position: { measure: 2, beat: 1, cell: 0 },
  max_measure: 2,
  tracks: {
    "3": [
      {
        type: "button",
        track_name: "BT-A",
        time: [1, 1, 0],
        hold_len: 0,
      },
    ],
  },
};

describe("drag range constraints", () => {
  it("limits near-range movement on both sides of the original note", () => {
    expect(clampDragSec(0, 1, "near")).toBeCloseTo(0.86666667);
    expect(clampDragSec(2, 1, "near")).toBeCloseTo(1.13333333);
  });

  it("allows an error-range note to move early but never late", () => {
    expect(clampDragSec(0, 1, "error")).toBeCloseTo(0.76666667);
    expect(clampDragSec(2, 1, "error")).toBe(1);
  });
});

describe("editor history", () => {
  it("restores the chart snapshot captured before a note move", () => {
    useEditorStore.getState().setOriginalChartData(chart);
    useEditorStore.getState().pushHistory();
    useEditorStore.getState().updateButtonTime("3", 0, [1, 2, 0]);

    expect(useEditorStore.getState().chartData?.tracks["3"]?.[0]?.time).toEqual([
      1,
      2,
      0,
    ]);

    useEditorStore.getState().undo();

    expect(useEditorStore.getState().chartData?.tracks["3"]?.[0]?.time).toEqual([
      1,
      1,
      0,
    ]);
  });
});
