import type { ChartTimingData } from "@/types/chart";
import type { TimePosition } from "@/types/chart-domain";
import { describe, expect, it } from "vitest";
import { TimeMapper } from "./time-mapper";

const timingData: ChartTimingData = {
  format_version: 12,
  beat_resolution: 48,
  bpm_info: [
    { measure: 1, beat: 1, cell: 0, bpm: 120 },
    { measure: 2, beat: 1, cell: 0, bpm: 60 },
  ],
  beat_info: [
    { measure: 1, beat: 1, cell: 0, numerator: 4, denominator: 4 },
  ],
  end_position: { measure: 3, beat: 1, cell: 0 },
  max_measure: 3,
};

describe("TimeMapper", () => {
  it("maps grid positions across BPM changes to elapsed seconds", () => {
    const mapper = new TimeMapper(timingData);
    const positions: TimePosition[] = [
      [1, 1, 0],
      [1, 3, 0],
      [2, 1, 0],
      [2, 2, 0],
      [3, 1, 0],
    ];

    expect(positions.map((position) => mapper.secondsOf(position))).toEqual([
      0,
      1,
      2,
      3,
      6,
    ]);
  });

  it("converts seconds back to a cell-snapped grid position", () => {
    const mapper = new TimeMapper(timingData);

    expect(mapper.secToTime3(3, 2)).toEqual([2, 2, 0]);
  });
});
