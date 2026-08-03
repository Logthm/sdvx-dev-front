import { TRACK_WIDTH } from "@/lib/chart-renderer/layout";
import type { ChartData } from "@/types/chart";
import { describe, expect, it } from "vitest";
import { useEditorStore, type HiSpeedMark } from "./editor-store";
import { renderEditorOverlays } from "./editor-rendering";

const chart: ChartData = {
  format_version: 12,
  beat_resolution: 48,
  bpm_info: [{ measure: 1, beat: 1, cell: 0, bpm: 120 }],
  beat_info: [
    { measure: 1, beat: 1, cell: 0, numerator: 4, denominator: 4 },
  ],
  end_position: { measure: 2, beat: 1, cell: 0 },
  max_measure: 2,
  tracks: {},
};

describe("editor rendering", () => {
  it("draws a track-wide selection box for a selected hi-speed mark", () => {
    const mark: HiSpeedMark = {
      time: [1, 2, 0],
      durationMs: 500,
      hiSpeed: 2,
    };
    const strokeRects: number[][] = [];
    const context = {
      save() {},
      restore() {},
      translate() {},
      scale() {},
      strokeRect(...args: number[]) {
        strokeRects.push(args);
      },
    } as unknown as CanvasRenderingContext2D;

    useEditorStore.getState().setOriginalChartData(chart);
    while (useEditorStore.getState().hiSpeedMarks.length > 0) {
      useEditorStore.getState().removeHiSpeedMark(0);
    }
    useEditorStore.getState().addHiSpeedMark(mark);
    useEditorStore.getState().setSelectedPoint({ type: "hispeed", index: 0 });
    useEditorStore.getState().setShowHoldJudgement(false);

    renderEditorOverlays({
      context,
      chart,
      view: { panX: 0, panY: 0, zoom: 1 },
      holdJudgements: [],
      transient: { selectedButtonPart: "body" },
    });

    expect(strokeRects).toHaveLength(1);
    expect(strokeRects[0]?.[2]).toBe(TRACK_WIDTH + 4);
    expect(strokeRects[0]?.[3]).toBe(8);
  });
});
